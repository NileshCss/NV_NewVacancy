import React, { useState, useEffect } from 'react'
import { useRouter } from '../../context/RouterContext'
import { fetchStudentMockTests, fetchExams } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  Loader2, Search, BookOpen, Clock, AlertCircle, Award, CheckCircle,
  ChevronRight, Play, RefreshCw, BarChart2, X, Sparkles, PlusCircle,
  CalendarClock, Target
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function MockTestList() {
  const { navigate, page } = useRouter()
  const { user, isAdmin } = useAuth()

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

  const hasActiveFilters = selectedExamId || selectedSubjectId || selectedStatus || search

  const clearFilters = () => {
    setSelectedExamId('')
    setSelectedSubjectId('')
    setSelectedStatus('')
    setSearch('')
    setSearchInput('')
  }

  if (loading) return (
    <div className="flex justify-center items-center h-[50vh]">
      <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
    </div>
  )

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

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="text-center mb-10">
        {/* Badge — styled to match nav badges: small, uppercase, pill */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200 dark:border-green-800/50">
            🎉 Currently Free Access
          </span>
        </div>

        <h1 className="text-4xl font-extrabold text-[var(--text-primary)] mb-3 leading-tight">
          Exam Mock Tests
        </h1>

        <p className="text-base text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
          Practice under real exam conditions. Timed sessions, live tab-switch tracking,
          detailed performance breakdowns and full explanations.
        </p>
      </div>

      {/* ── FILTERS ────────────────────────────────────────── */}
      <div
        className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border)] mb-8 shadow-sm"
        style={{ animation: 'slideUp .3s ease forwards' }}
      >
        {/* Grid layout: search takes 2 columns worth on desktop, dropdowns share remaining */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >

          {/* Search — spans 2 columns on wider screens */}
          <div style={{ gridColumn: 'span 2' }}>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search test names..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5 rounded"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Exam filter (hidden when in exam context) */}
          {!examSlug && (
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Exam</label>
              <select
                value={selectedExamId}
                onChange={e => { setSelectedExamId(e.target.value); setSelectedSubjectId('') }}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">All Exams</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}

          {/* Subject filter */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 cursor-pointer"
            >
              <option value="">All Subjects / Full Length</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Attempt Status filter */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Attempt Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 cursor-pointer"
            >
              <option value="">All Tests</option>
              <option value="not_attempted">Not Attempted</option>
              <option value="in_progress">In Progress / Resumable</option>
              <option value="completed">Completed / View Result</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div style={{ alignSelf: 'end' }}>
              <button
                onClick={clearFilters}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-muted)] hover:text-red-500 hover:border-red-400/40 transition-all duration-200"
              >
                <X size={13} />
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MOCK TEST CARDS ─────────────────────────────────── */}
      {tests.length === 0 ? (
        <EmptyState
          hasFilters={!!hasActiveFilters}
          isAdmin={isAdmin}
          onClearFilters={clearFilters}
          onGoAdmin={() => navigate('admin')}
        />
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
                  {/* Exam badge + Attempt status */}
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold">
                      {test.exams?.name || 'Exam Prep'}
                    </span>
                    {isCompleted ? (
                      <span className="px-2.5 py-0.5 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-lg text-xs font-bold flex items-center gap-1">
                        <CheckCircle size={11} /> Score: {attempt.score}/{test.total_marks}
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

                  {/* Test Name */}
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                    {test.name}
                  </h3>

                  {/* Subject */}
                  <div className="text-sm text-[var(--text-secondary)] mb-5">
                    📚 <span className="font-semibold text-[var(--text-primary)]">{test.subjects?.name || 'Full-Length Test'}</span>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-[var(--border)] text-center bg-[var(--bg-surface)]/50 rounded-xl">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Time</div>
                      <div className="text-sm font-bold text-[var(--text-primary)] flex items-center justify-center gap-1">
                        <Clock size={12} className="text-blue-500" />
                        {test.duration_minutes}m
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Questions</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">{test.total_questions}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Marks</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">{test.total_marks}</div>
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="px-6 pb-6">
                  <button
                    onClick={() => handleActionClick(test)}
                    className={`w-full py-3 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                      isCompleted
                        ? 'bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)]'
                        : isInProgress
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg shadow-yellow-500/25'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25'
                    }`}
                  >
                    {isCompleted ? (
                      <><BarChart2 size={15} /> View Scorecard & Solutions</>
                    ) : isInProgress ? (
                      <><Play size={15} /> Resume Test</>
                    ) : (
                      <><Play size={15} /> Start Mock Test</>
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

/* ── Empty State Component ─────────────────────────────── */
function EmptyState({ hasFilters, isAdmin, onClearFilters, onGoAdmin }) {
  if (hasFilters) {
    // Filtered empty state — show a clear-filters nudge
    return (
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-12 text-center">
        <div className="inline-flex p-4 rounded-full bg-[var(--bg-surface)] mb-5">
          <Target className="w-10 h-10 text-[var(--text-muted)]" />
        </div>
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          No Tests Match This Filter
        </h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-6">
          Try a different exam, subject, or attempt status — or clear all filters to see everything.
        </p>
        <button
          onClick={onClearFilters}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/20"
        >
          <X size={14} />
          Clear Filters
        </button>
      </div>
    )
  }

  // True empty state — no published tests at all
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
      {/* Decorative top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 opacity-60" />

      <div className="p-12 text-center">
        <div className="inline-flex p-4 rounded-full bg-blue-50 dark:bg-blue-950/20 mb-5">
          <BookOpen className="w-10 h-10 text-blue-500" />
        </div>

        <h3 className="text-2xl font-extrabold text-[var(--text-primary)] mb-2">
          Mock Tests Coming Soon
        </h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-2 leading-relaxed">
          We're building high-quality, exam-aligned mock tests for you.
        </p>
        <p className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-1.5 mb-8">
          <CalendarClock size={13} className="text-[var(--text-muted)]" />
          Check back soon — new tests are added regularly.
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 max-w-xs mx-auto mb-8">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)] font-medium">While you wait</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* CTA cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-blue-400/40 hover:bg-blue-50/5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200"
          >
            <RefreshCw size={15} className="text-blue-500" />
            Refresh page
          </button>

          {isAdmin ? (
            <button
              onClick={onGoAdmin}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-orange-400/30 bg-orange-50/10 hover:bg-orange-50/20 text-sm font-semibold text-orange-500 dark:text-orange-400 transition-all duration-200"
            >
              <PlusCircle size={15} />
              Create Mock Test
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-muted)]">
              <Sparkles size={15} className="text-purple-400" />
              AI-curated tests
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
