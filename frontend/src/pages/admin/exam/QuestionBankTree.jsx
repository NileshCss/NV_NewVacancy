import React, { useState, useEffect } from 'react'
import { fetchExams, fetchSubjects, fetchChapters, fetchTopics, fetchTopicQuestionCounts } from '../../../services/api'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Book, BookOpen, FileText, Search, Loader2, Maximize2, Minimize2, Layers } from 'lucide-react'

export default function QuestionBankTree({ selectedTopic, onSelectTopic }) {
  const [exams, setExams] = useState([])
  const [loadingExams, setLoadingExams] = useState(true)
  const [search, setSearch] = useState('')

  // Map of parentId -> children array
  const [subjectsMap, setSubjectsMap] = useState({})
  const [chaptersMap, setChaptersMap] = useState({})
  const [topicsMap, setTopicsMap] = useState({})
  const [topicCounts, setTopicCounts] = useState({})

  // Expanded node sets
  const [expandedExams, setExpandedExams] = useState(new Set())
  const [expandedSubjects, setExpandedSubjects] = useState(new Set())
  const [expandedChapters, setExpandedChapters] = useState(new Set())

  // Loading indicators per node ID
  const [loadingNodes, setLoadingNodes] = useState(new Set())

  // Load Exams on mount
  useEffect(() => {
    fetchExams()
      .then(data => {
        setExams(data || [])
        setLoadingExams(false)
      })
      .catch(() => setLoadingExams(false))
  }, [])

  const setNodeLoading = (id, isLoading) => {
    setLoadingNodes(prev => {
      const next = new Set(prev)
      if (isLoading) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // Toggle Exam Expansion
  const toggleExam = async (exam) => {
    const examId = exam.id
    const isExpanding = !expandedExams.has(examId)

    setExpandedExams(prev => {
      const next = new Set(prev)
      if (isExpanding) next.add(examId)
      else next.delete(examId)
      return next
    })

    if (isExpanding && !subjectsMap[examId]) {
      setNodeLoading(examId, true)
      try {
        const subs = await fetchSubjects(examId)
        setSubjectsMap(prev => ({ ...prev, [examId]: subs || [] }))
      } catch (err) {
        console.error('Failed to load subjects:', err)
      } finally {
        setNodeLoading(examId, false)
      }
    }
  }

  // Toggle Subject Expansion
  const toggleSubject = async (subject) => {
    const subId = subject.id
    const isExpanding = !expandedSubjects.has(subId)

    setExpandedSubjects(prev => {
      const next = new Set(prev)
      if (isExpanding) next.add(subId)
      else next.delete(subId)
      return next
    })

    if (isExpanding && !chaptersMap[subId]) {
      setNodeLoading(subId, true)
      try {
        const chaps = await fetchChapters(subId)
        setChaptersMap(prev => ({ ...prev, [subId]: chaps || [] }))
      } catch (err) {
        console.error('Failed to load chapters:', err)
      } finally {
        setNodeLoading(subId, false)
      }
    }
  }

  // Toggle Chapter Expansion
  const toggleChapter = async (chapter) => {
    const chapId = chapter.id
    const isExpanding = !expandedChapters.has(chapId)

    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (isExpanding) next.add(chapId)
      else next.delete(chapId)
      return next
    })

    if (isExpanding && !topicsMap[chapId]) {
      setNodeLoading(chapId, true)
      try {
        const tops = await fetchTopics(chapId)
        setTopicsMap(prev => ({ ...prev, [chapId]: tops || [] }))

        // Fetch question counts for these topics
        if (tops && tops.length > 0) {
          const tIds = tops.map(t => t.id)
          const counts = await fetchTopicQuestionCounts(tIds)
          setTopicCounts(prev => ({ ...prev, ...counts }))
        }
      } catch (err) {
        console.error('Failed to load topics:', err)
      } finally {
        setNodeLoading(chapId, false)
      }
    }
  }

  // Expand All visible nodes recursively
  const handleExpandAll = async () => {
    setLoadingExams(true)
    try {
      const eMap = new Set(exams.map(e => e.id))
      setExpandedExams(eMap)

      const sMap = {}
      const cMap = {}
      const tMap = {}
      const allSubIds = new Set()
      const allChapIds = new Set()
      let allTopicsList = []

      for (const e of exams) {
        const subs = await fetchSubjects(e.id)
        sMap[e.id] = subs || []
        for (const s of (subs || [])) {
          allSubIds.add(s.id)
          const chaps = await fetchChapters(s.id)
          cMap[s.id] = chaps || []
          for (const c of (chaps || [])) {
            allChapIds.add(c.id)
            const tops = await fetchTopics(c.id)
            tMap[c.id] = tops || []
            allTopicsList = [...allTopicsList, ...(tops || [])]
          }
        }
      }

      setSubjectsMap(sMap)
      setChaptersMap(cMap)
      setTopicsMap(tMap)
      setExpandedSubjects(allSubIds)
      setExpandedChapters(allChapIds)

      if (allTopicsList.length > 0) {
        const tIds = allTopicsList.map(t => t.id)
        const counts = await fetchTopicQuestionCounts(tIds)
        setTopicCounts(counts)
      }
    } catch (err) {
      console.error('Expand All error:', err)
    } finally {
      setLoadingExams(false)
    }
  }

  // Collapse All
  const handleCollapseAll = () => {
    setExpandedExams(new Set())
    setExpandedSubjects(new Set())
    setExpandedChapters(new Set())
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col h-full overflow-hidden select-none">
      {/* Tree Header */}
      <div className="p-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-primary)]">
            <Layers size={16} className="text-[var(--brand)]" />
            <span>Syllabus Hierarchy</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExpandAll}
              title="Expand All"
              className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={handleCollapseAll}
              title="Collapse All"
              className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition"
            >
              <Minimize2 size={13} />
            </button>
          </div>
        </div>

        {/* Quick Search inside Tree */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search hierarchy..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)]"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
        </div>
      </div>

      {/* Tree Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
        {loadingExams ? (
          <div className="p-6 text-center text-[var(--text-muted)] flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-[var(--brand)]" size={20} />
            <span>Loading Syllabus...</span>
          </div>
        ) : exams.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)]">No exams configured yet.</div>
        ) : (
          exams.map(exam => {
            if (search && !exam.name.toLowerCase().includes(search.toLowerCase())) {
              // Simple check if exam matches or if its children match
            }
            const isExamExpanded = expandedExams.has(exam.id)
            const isExamLoading = loadingNodes.has(exam.id)
            const subjects = subjectsMap[exam.id] || []

            return (
              <div key={exam.id} className="space-y-0.5">
                {/* Exam Node */}
                <div
                  onClick={() => toggleExam(exam)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] cursor-pointer font-bold text-[var(--text-primary)] transition"
                >
                  <span className="text-[var(--text-muted)]">
                    {isExamLoading ? (
                      <Loader2 className="animate-spin text-[var(--brand)]" size={13} />
                    ) : isExamExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                  <Book size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="truncate flex-1">{exam.name}</span>
                </div>

                {/* Exam Children (Subjects) */}
                {isExamExpanded && (
                  <div className="pl-4 space-y-0.5 border-l border-[var(--border)] ml-3.5">
                    {subjects.length === 0 && !isExamLoading ? (
                      <div className="py-1 px-2 text-[var(--text-muted)] italic text-[11px]">No subjects</div>
                    ) : (
                      subjects.map(subject => {
                        const isSubExpanded = expandedSubjects.has(subject.id)
                        const isSubLoading = loadingNodes.has(subject.id)
                        const chapters = chaptersMap[subject.id] || []

                        return (
                          <div key={subject.id} className="space-y-0.5">
                            {/* Subject Node */}
                            <div
                              onClick={() => toggleSubject(subject)}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] cursor-pointer font-semibold text-[var(--text-primary)] transition"
                            >
                              <span className="text-[var(--text-muted)]">
                                {isSubLoading ? (
                                  <Loader2 className="animate-spin text-[var(--brand)]" size={13} />
                                ) : isSubExpanded ? (
                                  <ChevronDown size={13} />
                                ) : (
                                  <ChevronRight size={13} />
                                )}
                              </span>
                              <BookOpen size={13} className="text-blue-400 flex-shrink-0" />
                              <span className="truncate flex-1">{subject.name}</span>
                            </div>

                            {/* Subject Children (Chapters) */}
                            {isSubExpanded && (
                              <div className="pl-4 space-y-0.5 border-l border-[var(--border)] ml-3">
                                {chapters.length === 0 && !isSubLoading ? (
                                  <div className="py-1 px-2 text-[var(--text-muted)] italic text-[11px]">No chapters</div>
                                ) : (
                                  chapters.map(chapter => {
                                    const isChapExpanded = expandedChapters.has(chapter.id)
                                    const isChapLoading = loadingNodes.has(chapter.id)
                                    const topics = topicsMap[chapter.id] || []

                                    return (
                                      <div key={chapter.id} className="space-y-0.5">
                                        {/* Chapter Node */}
                                        <div
                                          onClick={() => toggleChapter(chapter)}
                                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] cursor-pointer font-medium text-[var(--text-secondary)] transition"
                                        >
                                          <span className="text-[var(--text-muted)]">
                                            {isChapLoading ? (
                                              <Loader2 className="animate-spin text-[var(--brand)]" size={13} />
                                            ) : isChapExpanded ? (
                                              <ChevronDown size={13} />
                                            ) : (
                                              <ChevronRight size={13} />
                                            )}
                                          </span>
                                          {isChapExpanded ? (
                                            <FolderOpen size={13} className="text-purple-400 flex-shrink-0" />
                                          ) : (
                                            <Folder size={13} className="text-purple-400 flex-shrink-0" />
                                          )}
                                          <span className="truncate flex-1">{chapter.name}</span>
                                        </div>

                                        {/* Chapter Children (Topics) */}
                                        {isChapExpanded && (
                                          <div className="pl-4 space-y-0.5 border-l border-[var(--border)] ml-3">
                                            {topics.length === 0 && !isChapLoading ? (
                                              <div className="py-1 px-2 text-[var(--text-muted)] italic text-[11px]">No topics</div>
                                            ) : (
                                              topics.map(topic => {
                                                const isSelected = selectedTopic?.id === topic.id
                                                const qCount = topicCounts[topic.id]

                                                return (
                                                  <div
                                                    key={topic.id}
                                                    onClick={() => onSelectTopic({
                                                      ...topic,
                                                      chapterName: chapter.name,
                                                      subjectName: subject.name,
                                                      examName: exam.name,
                                                      examId: exam.id,
                                                      subjectId: subject.id,
                                                      chapterId: chapter.id,
                                                    })}
                                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition font-medium ${
                                                      isSelected
                                                        ? 'bg-[var(--brand)] text-white shadow-md font-bold'
                                                        : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                                                    }`}
                                                  >
                                                    <FileText size={13} className={isSelected ? 'text-white' : 'text-emerald-400'} />
                                                    <span className="truncate flex-1">{topic.name}</span>
                                                    {qCount !== undefined && (
                                                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                                        isSelected ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                                                      }`}>
                                                        {qCount}
                                                      </span>
                                                    )}
                                                  </div>
                                                )
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
