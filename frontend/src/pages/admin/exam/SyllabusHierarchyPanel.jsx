import React, { useState, useEffect } from 'react'
import { fetchExams, fetchSubjects, fetchChapters, fetchTopics, fetchTopicQuestionCounts } from '../../../services/api'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Book, BookOpen, FileText, Search, Loader2, Maximize2, Minimize2, Layers, List } from 'lucide-react'

export default function SyllabusHierarchyPanel({ selectedTopic, onSelectTopic }) {
  const [exams, setExams] = useState([])
  const [loadingExams, setLoadingExams] = useState(true)
  const [search, setSearch] = useState('')

  const [subjectsMap, setSubjectsMap]   = useState({})
  const [chaptersMap, setChaptersMap]   = useState({})
  const [topicsMap, setTopicsMap]       = useState({})
  const [topicCounts, setTopicCounts]   = useState({})

  const [expandedExams,     setExpandedExams]     = useState(new Set())
  const [expandedSubjects,  setExpandedSubjects]  = useState(new Set())
  const [expandedChapters,  setExpandedChapters]  = useState(new Set())
  const [loadingNodes,      setLoadingNodes]       = useState(new Set())

  useEffect(() => {
    fetchExams()
      .then(data => { setExams(data || []); setLoadingExams(false) })
      .catch(() => setLoadingExams(false))
  }, [])

  const setNodeLoading = (id, isLoading) =>
    setLoadingNodes(prev => { const n = new Set(prev); isLoading ? n.add(id) : n.delete(id); return n })

  const toggleExam = async (exam) => {
    const isExpanding = !expandedExams.has(exam.id)
    setExpandedExams(prev => { const n = new Set(prev); isExpanding ? n.add(exam.id) : n.delete(exam.id); return n })
    if (isExpanding && !subjectsMap[exam.id]) {
      setNodeLoading(exam.id, true)
      try {
        const subs = await fetchSubjects(exam.id)
        setSubjectsMap(prev => ({ ...prev, [exam.id]: subs || [] }))
      } catch {} finally { setNodeLoading(exam.id, false) }
    }
  }

  const toggleSubject = async (subject) => {
    const isExpanding = !expandedSubjects.has(subject.id)
    setExpandedSubjects(prev => { const n = new Set(prev); isExpanding ? n.add(subject.id) : n.delete(subject.id); return n })
    if (isExpanding && !chaptersMap[subject.id]) {
      setNodeLoading(subject.id, true)
      try {
        const chaps = await fetchChapters(subject.id)
        setChaptersMap(prev => ({ ...prev, [subject.id]: chaps || [] }))
      } catch {} finally { setNodeLoading(subject.id, false) }
    }
  }

  const toggleChapter = async (chapter) => {
    const isExpanding = !expandedChapters.has(chapter.id)
    setExpandedChapters(prev => { const n = new Set(prev); isExpanding ? n.add(chapter.id) : n.delete(chapter.id); return n })
    if (isExpanding && !topicsMap[chapter.id]) {
      setNodeLoading(chapter.id, true)
      try {
        const tops = await fetchTopics(chapter.id)
        setTopicsMap(prev => ({ ...prev, [chapter.id]: tops || [] }))
        if (tops?.length > 0) {
          const counts = await fetchTopicQuestionCounts(tops.map(t => t.id))
          setTopicCounts(prev => ({ ...prev, ...counts }))
        }
      } catch {} finally { setNodeLoading(chapter.id, false) }
    }
  }

  const handleExpandAll = async () => {
    setLoadingExams(true)
    try {
      const eMap = new Set(exams.map(e => e.id))
      setExpandedExams(eMap)
      const sMap = {}, cMap = {}, tMap = {}
      const allSubIds = new Set(), allChapIds = new Set()
      let allTopics = []
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
            allTopics = [...allTopics, ...(tops || [])]
          }
        }
      }
      setSubjectsMap(sMap); setChaptersMap(cMap); setTopicsMap(tMap)
      setExpandedSubjects(allSubIds); setExpandedChapters(allChapIds)
      if (allTopics.length > 0) {
        const counts = await fetchTopicQuestionCounts(allTopics.map(t => t.id))
        setTopicCounts(counts)
      }
    } catch {} finally { setLoadingExams(false) }
  }

  const handleCollapseAll = () => {
    setExpandedExams(new Set()); setExpandedSubjects(new Set()); setExpandedChapters(new Set())
  }

  const selectExamAll = (exam) => onSelectTopic({
    type: 'exam', id: exam.id, name: exam.name, examId: exam.id, examName: exam.name
  })
  const selectSubjectAll = (exam, subject) => onSelectTopic({
    type: 'subject', id: subject.id, name: subject.name,
    subjectId: subject.id, examId: exam.id,
    subjectName: subject.name, examName: exam.name
  })
  const selectChapterAll = (exam, subject, chapter) => onSelectTopic({
    type: 'chapter', id: chapter.id, name: chapter.name,
    chapterId: chapter.id, subjectId: subject.id, examId: exam.id,
    chapterName: chapter.name, subjectName: subject.name, examName: exam.name
  })

  const isNodeSelected = (type, id) => selectedTopic?.type === type && selectedTopic?.id === id

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl flex flex-col h-full overflow-hidden select-none shadow-xs">
      {/* Sticky Panel Header */}
      <div className="sticky top-0 z-10 p-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-primary)]">
            <Layers size={16} className="text-orange-500" />
            <span>Syllabus Hierarchy</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleExpandAll} title="Expand All Nodes" aria-label="Expand All" className="p-1.5 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition">
              <Maximize2 size={13} />
            </button>
            <button onClick={handleCollapseAll} title="Collapse All Nodes" aria-label="Collapse All" className="p-1.5 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition">
              <Minimize2 size={13} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search hierarchy..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
        </div>
      </div>

      {/* Independently Scrollable Tree Body */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1 text-xs">
        {loadingExams ? (
          <div className="p-8 text-center text-[var(--text-muted)] flex flex-col items-center gap-2.5">
            <Loader2 className="animate-spin text-orange-500" size={22} />
            <span className="font-semibold text-xs">Loading Syllabus...</span>
          </div>
        ) : exams.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)]">No exams configured yet.</div>
        ) : (
          exams.map(exam => {
            if (search && !exam.name.toLowerCase().includes(search.toLowerCase())) return null
            const isExamExpanded = expandedExams.has(exam.id)
            const isExamLoading  = loadingNodes.has(exam.id)
            const subjects = subjectsMap[exam.id] || []
            const examSelected = isNodeSelected('exam', exam.id)

            return (
              <div key={exam.id} className="space-y-0.5">
                {/* EXAM Node */}
                <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl cursor-pointer font-bold text-[var(--text-primary)] transition-all group ${examSelected ? 'bg-orange-500 text-white shadow-xs' : 'hover:bg-[var(--bg-surface)]'}`}>
                  <span onClick={() => toggleExam(exam)} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                    {isExamLoading ? <Loader2 className="animate-spin text-orange-500" size={13} /> : isExamExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <Book size={14} className="text-amber-500 flex-shrink-0" onClick={() => toggleExam(exam)} />
                  <span className="truncate flex-1" onClick={() => toggleExam(exam)}>{exam.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); selectExamAll(exam) }}
                    className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition flex items-center gap-0.5 ${examSelected ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'}`}
                    title={`View all questions under ${exam.name} across all subjects`}
                    aria-label={`View all questions under ${exam.name}`}
                  >
                    <List size={10} /> All
                  </button>
                </div>

                {/* Subjects */}
                {isExamExpanded && (
                  <div className="pl-3.5 space-y-0.5 border-l border-[var(--border)] ml-3">
                    {subjects.length === 0 && !isExamLoading && (
                      <div className="py-1 px-2 text-[var(--text-muted)] italic text-[11px]">No subjects</div>
                    )}
                    {subjects.map(subject => {
                      const isSubExpanded = expandedSubjects.has(subject.id)
                      const isSubLoading  = loadingNodes.has(subject.id)
                      const chapters = chaptersMap[subject.id] || []
                      const subSelected = isNodeSelected('subject', subject.id)

                      return (
                        <div key={subject.id} className="space-y-0.5">
                          {/* SUBJECT Node */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer font-semibold text-[var(--text-primary)] transition-all group ${subSelected ? 'bg-orange-500 text-white shadow-xs' : 'hover:bg-[var(--bg-surface)]'}`}>
                            <span onClick={() => toggleSubject(subject)} className="text-[var(--text-muted)]">
                              {isSubLoading ? <Loader2 className="animate-spin text-orange-500" size={13} /> : isSubExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </span>
                            <BookOpen size={13} className="text-blue-400 flex-shrink-0" onClick={() => toggleSubject(subject)} />
                            <span className="truncate flex-1" onClick={() => toggleSubject(subject)}>{subject.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); selectSubjectAll(exam, subject) }}
                              className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition flex items-center gap-0.5 ${subSelected ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'}`}
                              title={`View all questions under ${subject.name} across all chapters`}
                              aria-label={`View all questions under ${subject.name}`}
                            >
                              <List size={10} /> All
                            </button>
                          </div>

                          {/* Chapters */}
                          {isSubExpanded && (
                            <div className="pl-3.5 space-y-0.5 border-l border-[var(--border)] ml-3">
                              {chapters.length === 0 && !isSubLoading && (
                                <div className="py-1 px-2 text-[var(--text-muted)] italic text-[11px]">No chapters</div>
                              )}
                              {chapters.map(chapter => {
                                const isChapExpanded = expandedChapters.has(chapter.id)
                                const isChapLoading  = loadingNodes.has(chapter.id)
                                const topics = topicsMap[chapter.id] || []
                                const chapSelected = isNodeSelected('chapter', chapter.id)

                                return (
                                  <div key={chapter.id} className="space-y-0.5">
                                    {/* CHAPTER Node */}
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer font-medium text-[var(--text-secondary)] transition-all group ${chapSelected ? 'bg-orange-500 text-white shadow-xs' : 'hover:bg-[var(--bg-surface)]'}`}>
                                      <span onClick={() => toggleChapter(chapter)} className="text-[var(--text-muted)]">
                                        {isChapLoading ? <Loader2 className="animate-spin text-orange-500" size={13} /> : isChapExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                      </span>
                                      {isChapExpanded
                                        ? <FolderOpen size={13} className="text-purple-400 flex-shrink-0" onClick={() => toggleChapter(chapter)} />
                                        : <Folder size={13} className="text-purple-400 flex-shrink-0" onClick={() => toggleChapter(chapter)} />}
                                      <span className="truncate flex-1" onClick={() => toggleChapter(chapter)}>{chapter.name}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); selectChapterAll(exam, subject, chapter) }}
                                        className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition flex items-center gap-0.5 ${chapSelected ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'}`}
                                        title={`View all questions under ${chapter.name} across all topics`}
                                        aria-label={`View all questions under ${chapter.name}`}
                                      >
                                        <List size={10} /> All
                                      </button>
                                    </div>

                                    {/* Topics */}
                                    {isChapExpanded && (
                                      <div className="pl-3.5 space-y-0.5 border-l border-[var(--border)] ml-3">
                                        {topics.length === 0 && !isChapLoading && (
                                          <div className="py-1 px-2 text-[var(--text-muted)] italic text-[11px]">No topics</div>
                                        )}
                                        {topics.map(topic => {
                                          const isSelected = selectedTopic?.id === topic.id && (selectedTopic?.type === 'topic' || !selectedTopic?.type)
                                          const qCount = topicCounts[topic.id]
                                          return (
                                            <div
                                              key={topic.id}
                                              onClick={() => onSelectTopic({
                                                type: 'topic',
                                                ...topic,
                                                chapterName: chapter.name, subjectName: subject.name, examName: exam.name,
                                                examId: exam.id, subjectId: subject.id, chapterId: chapter.id,
                                              })}
                                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer transition font-medium ${isSelected ? 'bg-orange-500 text-white shadow-xs font-bold' : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'}`}
                                            >
                                              <FileText size={13} className={isSelected ? 'text-white' : 'text-emerald-400'} />
                                              <span className="truncate flex-1">{topic.name}</span>
                                              {qCount !== undefined && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
                                                  {qCount}
                                                </span>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
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
