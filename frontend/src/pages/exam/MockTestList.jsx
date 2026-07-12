import React, { useState, useEffect } from 'react'
import { useRouter } from '../../context/RouterContext'
import { fetchStudentMockTests, fetchExams } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Loader2, Search, BookOpen, Clock, AlertCircle, Award, CheckCircle, ChevronRight, Play, RefreshCw, BarChart2, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MockTestList() {
  const { navigate, page } = useRouter()
  const { user } = useAuth()
  
  // URL format could be "mock-tests" or "exams/:slug/mock-tests"
  const urlParts = page.split('/')
  const isExamContext = urlParts[0] === 'exams'
  const examSlug = isExamContext ? urlParts[1] : null

  const [tests, setTests] = useState([])
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Debounce search input to prevent DB load spikes on every keystroke
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearch(searchInput)
    }, 400)

    return () => clearTimeout(delayDebounceFn)
  }, [searchInput])

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true)
        const allExams = await fetchExams()
        const publishedExams = allExams.filter(e => e.status === 'published')
        setExams(publishedExams)

        let examId = ''
        if (examSlug) {
          const matchedExam = publishedExams.find(e => e.slug === examSlug)
          if (matchedExam) {
            examId = matchedExam.id
            setSelectedExamId(matchedExam.id)
          }
        }

        await loadTests(examId)
      } catch (err) {
        setError(err.message || 'Failed to load mock tests')
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [examSlug, page])

  const loadTests = async (examIdFilter = '') => {
    try {
      const params = {}
      if (examIdFilter || selectedExamId) {
        params.exam_id = examIdFilter || selectedExamId
      }
      if (selectedSubjectId) {
        params.subject_id = selectedSubjectId
      }
      if (selectedStatus) {
        params.status = selectedStatus
      }
      if (search) {
        params.search = search
      }

      const data = await fetchStudentMockTests(params)
      setTests(data || [])

      // Populate subjects list from the fetched tests for simple dynamic filtering
      const uniqueSubjectsMap = {}
      data.forEach(t => {
        if (t.subjects) {
          uniqueSubjectsMap[t.subjects.id] = t.subjects.name
        }
      })
      const subsList = Object.entries(uniqueSubjectsMap).map(([id, name]) => ({ id, name }))
      setSubjects(subsList)
    } catch (err) {
      toast.error('Failed to reload tests')
    }
  }

  // Trigger reload when filter state changes
  useEffect(() => {
    if (!loading) {
      loadTests()
    }
  }, [selectedExamId, selectedSubjectId, selectedStatus, search])

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center">
      <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Error Loading Mock Tests</h2>
      <p className="text-[var(--text-muted)]">{error}</p>
    </div>
  )

  const handleActionClick = (test) => {
    if (!user) {
      toast.error('Please sign in to take mock tests')
      navigate('login')
      return
    }

    const latest = test.latest_attempt
    if (latest) {
      if (latest.status === 'in_progress') {
        navigate(`mock-tests/take/${test.id}`)
      } else {
        navigate(`mock-tests/result/${latest.id}`)
      }
    } else {
      navigate(`mock-tests/take/${test.id}`)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Award className="text-blue-500 w-8 h-8" />
          <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full text-xs font-semibold uppercase tracking-wider">
            🎉 Currently Free Access
          </span>
        </div>
        <h1 className="text-4xl font-extrabold text-[var(--text-primary)] mb-3">Exam Mock Tests</h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
          Practice under real test conditions, log tab switches, review detailed performance breakdowns, and view explanations.
        </p>
      </div>

      {/* FILTERS */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border)] mb-8 flex flex-wrap gap-4 items-end shadow-sm animate-fade-in">
        {/* Search Input */}
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Search</label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search test names..." 
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl pl-9 pr-9 py-2 text-sm text-[var(--text-primary)] placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 shadow-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            {searchInput && (
              <button 
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg"
                aria-label="Clear search"
              >
                <X size={14} className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {!examSlug && (
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Exam</label>
            <select
              value={selectedExamId}
              onChange={e => { setSelectedExamId(e.target.value); setSelectedSubjectId('') }}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 shadow-sm cursor-pointer"
            >
              <option value="">All Exams</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Subject</label>
          <select
            value={selectedSubjectId}
            onChange={e => setSelectedSubjectId(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 shadow-sm cursor-pointer"
          >
            <option value="">All Subjects / Full Length</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Attempt Status</label>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 shadow-sm cursor-pointer"
          >
            <option value="">All Tests</option>
            <option value="not_attempted">Not Attempted</option>
            <option value="in_progress">In Progress / Resumable</option>
            <option value="completed">Completed / View Result</option>
          </select>
        </div>
      </div>

      {/* MOCK TEST CARDS */}
      {tests.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <BookOpen className="mx-auto w-12 h-12 text-[var(--text-muted)] mb-4" />
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Mock Tests Available</h3>
          <p className="text-[var(--text-secondary)]">There are no published mock tests matching your filter criteria at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tests.map(test => {
            const attempt = test.latest_attempt
            const hasStarted = !!attempt
            const isCompleted = attempt?.status === 'completed'
            const isInProgress = attempt?.status === 'in_progress'

            return (
              <div 
                key={test.id} 
                className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden relative group"
              >
                {/* Upper portion */}
                <div className="p-6">
                  {/* Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold">
                      {test.exams?.name || 'Exam Prep'}
                    </span>
                    {isCompleted ? (
                      <span className="px-2.5 py-0.5 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-lg text-xs font-bold flex items-center gap-1">
                        <CheckCircle size={12} /> Score: {attempt.score}/{test.total_marks}
                      </span>
                    ) : isInProgress ? (
                      <span className="px-2.5 py-0.5 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 rounded-lg text-xs font-bold animate-pulse">
                        ⏳ In Progress
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-[var(--bg-surface)] text-[var(--text-muted)] rounded-lg text-xs font-medium">
                        Not Started
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {test.name}
                  </h3>
                  
                  {/* Subject details */}
                  <div className="text-sm text-[var(--text-secondary)] mb-6">
                    📚 Subject: <span className="font-semibold text-[var(--text-primary)]">{test.subjects?.name || 'Full-Length Test'}</span>
                  </div>

                  {/* Stats list */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-[var(--border)] text-center bg-[var(--bg-surface)]/50 rounded-xl">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Time</div>
                      <div className="text-sm font-bold text-[var(--text-primary)] flex items-center justify-center gap-1 mt-0.5">
                        <Clock size={12} className="text-blue-500" />
                        {test.duration_minutes}m
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Questions</div>
                      <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {test.total_questions}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Marks</div>
                      <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        {test.total_marks}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer action button */}
                <div className="p-6 pt-0">
                  <button 
                    onClick={() => handleActionClick(test)}
                    className={`w-full py-3 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                      isCompleted 
                        ? 'bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)]'
                        : isInProgress
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg shadow-yellow-500/25'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25'
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <BarChart2 size={16} /> View Scorecard & Solutions
                      </>
                    ) : isInProgress ? (
                      <>
                        <Play size={16} /> Resume Test
                      </>
                    ) : (
                      <>
                        <Play size={16} /> Start Mock Test
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
