import React, { useState, useEffect } from 'react'
import { useRouter } from '../../context/RouterContext'
import { fetchExams, fetchSubjects, fetchChapters, fetchTopics } from '../../services/api'
import { Loader2, BookOpen, Target, Clock, AlertCircle, ChevronDown, ChevronRight, FileText } from 'lucide-react'

export default function ExamLandingPage() {
  const { page } = useRouter()
  const slug = page.split('/')[1]
  const [exam, setExam] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [chaptersBySubject, setChaptersBySubject] = useState({})
  const [topicsByChapter, setTopicsByChapter] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [expandedSubject, setExpandedSubject] = useState(null)
  const [expandedChapter, setExpandedChapter] = useState(null)

  useEffect(() => {
    async function loadExamData() {
      try {
        setLoading(true)
        // Using fetchExams with no category, then filter by slug (for simplicity since getExam isn't exposed directly, though it exists in backend)
        const allExams = await fetchExams()
        const found = allExams.find(e => e.slug === slug)
        if (!found || found.status !== 'published') throw new Error('Exam not found')
        
        setExam(found)
        
        const subs = await fetchSubjects(found.id)
        setSubjects(subs.filter(s => s.enabled))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadExamData()
  }, [slug])

  const loadChapters = async (subjectId) => {
    if (expandedSubject === subjectId) {
      setExpandedSubject(null)
      return
    }
    setExpandedSubject(subjectId)
    if (!chaptersBySubject[subjectId]) {
      const chaps = await fetchChapters(subjectId)
      setChaptersBySubject(prev => ({ ...prev, [subjectId]: chaps }))
    }
  }

  const loadTopics = async (chapterId) => {
    if (expandedChapter === chapterId) {
      setExpandedChapter(null)
      return
    }
    setExpandedChapter(chapterId)
    if (!topicsByChapter[chapterId]) {
      const tops = await fetchTopics(chapterId)
      setTopicsByChapter(prev => ({ ...prev, [chapterId]: tops }))
    }
  }

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
  if (error) return <div className="text-center py-20 text-red-500 font-medium text-xl">{error}</div>
  if (!exam) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* HEADER SECTION */}
      <div className="bg-[var(--bg-card)] rounded-3xl p-8 border border-[var(--border)] shadow-sm mb-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full text-sm font-semibold">
                {exam.exam_categories?.name}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--text-primary)] mb-4 leading-tight">
              {exam.name}
            </h1>
            {exam.description && (
              <p className="text-lg text-[var(--text-secondary)] mb-6 leading-relaxed">
                {exam.description}
              </p>
            )}
            
            <div className="flex flex-wrap gap-4 mt-8">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-blue-500/30">
                Start Mock Test
              </button>
              <button className="bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] font-bold py-3 px-8 rounded-xl transition-colors">
                View Question Bank
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COL: INFO */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)]">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-blue-500" />
              Exam Details
            </h3>
            <div className="space-y-4">
              {exam.eligibility && (
                <div>
                  <div className="text-sm font-medium text-[var(--text-muted)]">Eligibility</div>
                  <div className="text-sm text-[var(--text-primary)] mt-1 whitespace-pre-wrap">{exam.eligibility}</div>
                </div>
              )}
              {exam.age_limit && (
                <div>
                  <div className="text-sm font-medium text-[var(--text-muted)]">Age Limit</div>
                  <div className="text-sm text-[var(--text-primary)] mt-1 whitespace-pre-wrap">{exam.age_limit}</div>
                </div>
              )}
              {exam.selection_process && (
                <div>
                  <div className="text-sm font-medium text-[var(--text-muted)]">Selection Process</div>
                  <div className="text-sm text-[var(--text-primary)] mt-1 whitespace-pre-wrap">{exam.selection_process}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COL: SYLLABUS */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)]">
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
              <BookOpen size={24} className="text-blue-500" />
              Syllabus & Study Material
            </h3>
            
            {subjects.length === 0 ? (
              <p className="text-[var(--text-muted)]">No syllabus data available yet.</p>
            ) : (
              <div className="space-y-4">
                {subjects.map(subject => (
                  <div key={subject.id} className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                    <button 
                      onClick={() => loadChapters(subject.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-[var(--border)]/50 transition-colors text-left"
                    >
                      <span className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
                        {subject.icon && <span>{subject.icon}</span>}
                        {subject.name}
                      </span>
                      {expandedSubject === subject.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    
                    {expandedSubject === subject.id && (
                      <div className="p-4 pt-0">
                        {!chaptersBySubject[subject.id] ? (
                          <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>
                        ) : chaptersBySubject[subject.id].length === 0 ? (
                          <div className="text-sm text-[var(--text-muted)] p-2">No chapters.</div>
                        ) : (
                          <div className="space-y-2 mt-2">
                            {chaptersBySubject[subject.id].map(chap => (
                              <div key={chap.id} className="border border-[var(--border)] rounded-lg bg-[var(--bg-card)]">
                                <button 
                                  onClick={() => loadTopics(chap.id)}
                                  className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-surface)] transition-colors text-left"
                                >
                                  <span className="font-semibold text-[var(--text-primary)] text-sm">{chap.name}</span>
                                  {expandedChapter === chap.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                
                                {expandedChapter === chap.id && (
                                  <div className="p-3 pt-0 border-t border-[var(--border)] bg-[var(--bg-surface)]">
                                    {!topicsByChapter[chap.id] ? (
                                      <div className="text-center py-2"><Loader2 className="animate-spin mx-auto text-blue-500 w-4 h-4" /></div>
                                    ) : topicsByChapter[chap.id].length === 0 ? (
                                      <div className="text-xs text-[var(--text-muted)]">No topics.</div>
                                    ) : (
                                      <ul className="space-y-2 mt-2">
                                        {topicsByChapter[chap.id].map(topic => (
                                          <li key={topic.id} className="flex items-start gap-2 p-2 rounded hover:bg-[var(--border)]/30 transition-colors">
                                            <div className="mt-1"><Target size={14} className="text-blue-500" /></div>
                                            <div className="flex-1">
                                              <div className="text-sm font-medium text-[var(--text-primary)]">{topic.name}</div>
                                              {topic.description && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{topic.description}</div>}
                                              {(topic.pdf_url || topic.notes_rich_text) && (
                                                <div className="flex gap-3 mt-2">
                                                  {topic.pdf_url && <a href={topic.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1"><FileText size={12}/> PDF Notes</a>}
                                                  {topic.notes_rich_text && <span className="text-xs text-purple-500 flex items-center gap-1"><BookOpen size={12}/> Read Notes</span>}
                                                </div>
                                              )}
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
