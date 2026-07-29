import React from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Book, BookOpen, FileText, Loader2, List } from 'lucide-react'

export default function HierarchyTree({
  exams,
  loadingExams,
  search,
  subjectsMap,
  chaptersMap,
  topicsMap,
  topicCounts,
  expandedExams,
  expandedSubjects,
  expandedChapters,
  loadingNodes,
  selectedTopic,
  onToggleExam,
  onToggleSubject,
  onToggleChapter,
  onSelectTopic,
  onSelectExamAll,
  onSelectSubjectAll,
  onSelectChapterAll
}) {
  const isNodeSelected = (type, id) => selectedTopic?.type === type && selectedTopic?.id === id

  if (loadingExams) {
    return (
      <div className="p-8 text-center text-[var(--text-muted)] flex flex-col items-center gap-2.5">
        <Loader2 className="animate-spin text-orange-500" size={22} />
        <span className="font-semibold text-xs">Loading Syllabus Tree...</span>
      </div>
    )
  }

  if (!exams || exams.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-[var(--text-muted)]">
        No exams configured yet.
      </div>
    )
  }

  return (
    <div className="space-y-1 text-xs">
      {exams.map((exam) => {
        if (search && !exam.name.toLowerCase().includes(search.toLowerCase())) return null
        const isExamExpanded = expandedExams.has(exam.id)
        const isExamLoading  = loadingNodes.has(exam.id)
        const subjects       = subjectsMap[exam.id] || []
        const examSelected   = isNodeSelected('exam', exam.id)

        return (
          <div key={exam.id} className="space-y-0.5">
            {/* EXAM Node */}
            <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl cursor-pointer font-bold text-[var(--text-primary)] transition-all group ${examSelected ? 'bg-orange-500 text-white shadow-xs' : 'hover:bg-[var(--bg-surface)]'}`}>
              <span onClick={() => onToggleExam(exam)} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                {isExamLoading ? <Loader2 className="animate-spin text-orange-500" size={13} /> : isExamExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <Book size={14} className="text-amber-500 shrink-0" onClick={() => onToggleExam(exam)} />
              <span className="truncate flex-1" onClick={() => onToggleExam(exam)}>{exam.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onSelectExamAll(exam) }}
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
                {subjects.map((subject) => {
                  const isSubExpanded = expandedSubjects.has(subject.id)
                  const isSubLoading  = loadingNodes.has(subject.id)
                  const chapters      = chaptersMap[subject.id] || []
                  const subSelected   = isNodeSelected('subject', subject.id)

                  return (
                    <div key={subject.id} className="space-y-0.5">
                      {/* SUBJECT Node */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer font-semibold text-[var(--text-primary)] transition-all group ${subSelected ? 'bg-orange-500 text-white shadow-xs' : 'hover:bg-[var(--bg-surface)]'}`}>
                        <span onClick={() => onToggleSubject(subject)} className="text-[var(--text-muted)]">
                          {isSubLoading ? <Loader2 className="animate-spin text-orange-500" size={13} /> : isSubExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </span>
                        <BookOpen size={13} className="text-blue-400 shrink-0" onClick={() => onToggleSubject(subject)} />
                        <span className="truncate flex-1" onClick={() => onToggleSubject(subject)}>{subject.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectSubjectAll(exam, subject) }}
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
                          {chapters.map((chapter) => {
                            const isChapExpanded = expandedChapters.has(chapter.id)
                            const isChapLoading  = loadingNodes.has(chapter.id)
                            const topics         = topicsMap[chapter.id] || []
                            const chapSelected   = isNodeSelected('chapter', chapter.id)

                            return (
                              <div key={chapter.id} className="space-y-0.5">
                                {/* CHAPTER Node */}
                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer font-medium text-[var(--text-secondary)] transition-all group ${chapSelected ? 'bg-orange-500 text-white shadow-xs' : 'hover:bg-[var(--bg-surface)]'}`}>
                                  <span onClick={() => onToggleChapter(chapter)} className="text-[var(--text-muted)]">
                                    {isChapLoading ? <Loader2 className="animate-spin text-orange-500" size={13} /> : isChapExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  </span>
                                  {isChapExpanded
                                    ? <FolderOpen size={13} className="text-purple-400 shrink-0" onClick={() => onToggleChapter(chapter)} />
                                    : <Folder size={13} className="text-purple-400 shrink-0" onClick={() => onToggleChapter(chapter)} />}
                                  <span className="truncate flex-1" onClick={() => onToggleChapter(chapter)}>{chapter.name}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onSelectChapterAll(exam, subject, chapter) }}
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
                                    {topics.map((topic) => {
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
      })}
    </div>
  )
}
