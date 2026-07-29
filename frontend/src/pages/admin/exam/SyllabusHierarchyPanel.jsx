import React, { useState, useEffect } from 'react'
import { fetchExams, fetchSubjects, fetchChapters, fetchTopics, fetchTopicQuestionCounts } from '../../../services/api'
import HierarchyToolbar from './HierarchyToolbar'
import HierarchyTree from './HierarchyTree'

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

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl flex flex-col h-full overflow-hidden select-none shadow-xs">
      {/* Hierarchy Header & Search Toolbar */}
      <HierarchyToolbar
        search={search}
        onSearchChange={setSearch}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />

      {/* Scrollable Tree */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <HierarchyTree
          exams={exams}
          loadingExams={loadingExams}
          search={search}
          subjectsMap={subjectsMap}
          chaptersMap={chaptersMap}
          topicsMap={topicsMap}
          topicCounts={topicCounts}
          expandedExams={expandedExams}
          expandedSubjects={expandedSubjects}
          expandedChapters={expandedChapters}
          loadingNodes={loadingNodes}
          selectedTopic={selectedTopic}
          onToggleExam={toggleExam}
          onToggleSubject={toggleSubject}
          onToggleChapter={toggleChapter}
          onSelectTopic={onSelectTopic}
          onSelectExamAll={selectExamAll}
          onSelectSubjectAll={selectSubjectAll}
          onSelectChapterAll={selectChapterAll}
        />
      </div>
    </div>
  )
}
