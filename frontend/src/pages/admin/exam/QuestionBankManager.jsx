import React, { useState, useEffect } from 'react'
import { fetchQuestions, fetchExams, fetchSubjects, fetchChapters, fetchTopics, createQuestion, updateQuestion, updateQuestionStatus, deleteQuestion, bulkImportQuestions, extractQuestionsAI } from '../../../services/api'
import { Edit2, Trash2, Plus, Loader2, Sparkles, Check, X, FileSpreadsheet, Filter, Search, ChevronRight } from 'lucide-react'
import QuestionEditor from './QuestionEditor'
import toast from 'react-hot-toast'

export default function QuestionBankManager() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [exams, setExams] = useState([])
  
  // Modals state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  
  // CSV Import State
  const [csvText, setCsvText] = useState('')
  const [isCsvSubmitting, setIsCsvSubmitting] = useState(false)

  // AI Import State
  const [aiRawText, setAiRawText] = useState('')
  const [isAiExtracting, setIsAiExtracting] = useState(false)
  const [extractedQuestions, setExtractedQuestions] = useState([])

  // Filtering State
  const [filters, setFilters] = useState({
    exam_id: '',
    difficulty: '',
    status: '',
    search: ''
  })

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const qData = await fetchQuestions(filters)
      setQuestions(qData)
    } catch (err) {
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExams().then(setExams).catch(() => {})
  }, [])

  useEffect(() => {
    loadQuestions()
  }, [filters])

  const handleEdit = (q) => {
    setEditingQuestion(q)
    setIsEditorOpen(true)
  }

  const handleCreate = () => {
    setEditingQuestion(null)
    setIsEditorOpen(true)
  }

  const handleSave = async (payload) => {
    try {
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, payload)
        toast.success('Question updated successfully!')
      } else {
        await createQuestion(payload)
        toast.success('Question created successfully!')
      }
      setIsEditorOpen(false)
      loadQuestions()
    } catch (err) {
      toast.error(err.message || 'Error saving question')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    try {
      await deleteQuestion(id)
      toast.success('Question deleted!')
      loadQuestions()
    } catch (err) {
      toast.error('Failed to delete question')
    }
  }

  const handleStatusChange = async (id, status) => {
    try {
      await updateQuestionStatus(id, status)
      toast.success(`Question status updated to ${status}!`)
      loadQuestions()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const handleCsvSubmit = async (e) => {
    e.preventDefault()
    if (!csvText.trim()) return toast.error('Please paste CSV data first')
    setIsCsvSubmitting(true)
    try {
      const mappings = filters.exam_id ? [{ exam_id: filters.exam_id }] : []
      const res = await bulkImportQuestions(csvText, mappings)
      toast.success(`Import complete! Succeeded: ${res.successCount}, Duplicates: ${res.duplicateCount}, Failed: ${res.failedCount}`)
      setIsCsvModalOpen(false)
      setCsvText('')
      loadQuestions()
    } catch (err) {
      toast.error(err.message || 'CSV Import failed')
    } finally {
      setIsCsvSubmitting(false)
    }
  }

  const handleAiExtract = async (e) => {
    e.preventDefault()
    if (!aiRawText.trim()) return toast.error('Please paste raw syllabus/question text')
    setIsAiExtracting(true)
    try {
      const data = await extractQuestionsAI(aiRawText)
      setExtractedQuestions(data)
      toast.success(`AI successfully extracted ${data.length} questions!`)
    } catch (err) {
      toast.error(err.message || 'AI extraction failed')
    } finally {
      setIsAiExtracting(false)
    }
  }

  const handleSaveExtracted = async () => {
    if (extractedQuestions.length === 0) return
    const loadingToast = toast.loading('Saving questions to database...')
    try {
      const mappings = filters.exam_id ? [{ exam_id: filters.exam_id }] : []
      for (const q of extractedQuestions) {
        await createQuestion({ ...q, mappings })
      }
      toast.dismiss(loadingToast)
      toast.success('All AI extracted questions saved!')
      setIsAiModalOpen(false)
      setAiRawText('')
      setExtractedQuestions([])
      loadQuestions()
    } catch (err) {
      toast.dismiss(loadingToast)
      toast.error('Error saving extracted questions')
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Question Bank</h2>
          <p className="text-sm text-[var(--text-muted)]">Manage questions, approve drafts, import bulk data or use AI parsing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsAiModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
            <Sparkles size={18} /> AI Extract
          </button>
          <button onClick={() => setIsCsvModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            <FileSpreadsheet size={18} /> Bulk Import (CSV)
          </button>
          <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus size={18} /> Add Question
          </button>
        </div>
      </div>

      {/* Editor Block */}
      {isEditorOpen && (
        <QuestionEditor
          question={editingQuestion}
          onSave={handleSave}
          onCancel={() => setIsEditorOpen(false)}
        />
      )}

      {/* Filter / Search Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 rounded-xl flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            placeholder="Search question text..."
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--text-primary)]"
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        </div>

        <div className="flex flex-wrap gap-3">
          <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={filters.exam_id} onChange={e => setFilters({ ...filters, exam_id: e.target.value })}>
            <option value="">All Exams</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>

          <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={filters.difficulty} onChange={e => setFilters({ ...filters, difficulty: e.target.value })}>
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="draft">Draft (Needs Review)</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-500" /></div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">No questions found. Add or import some to get started.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                <th className="p-4 font-semibold">Question Text</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Difficulty</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map(q => (
                <tr key={q.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors">
                  <td className="p-4 font-medium text-[var(--text-primary)] max-w-md">
                    <div className="line-clamp-2">{q.question_text}</div>
                    {q.possible_duplicate_of && (
                      <span className="inline-block mt-1 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded">
                        Potential Duplicate
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-xs text-[var(--text-secondary)] font-mono uppercase">{q.question_type}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                      q.difficulty === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                      q.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      q.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2 items-center">
                    {q.status !== 'approved' && (
                      <button onClick={() => handleStatusChange(q.id, 'approved')} className="text-green-500 hover:text-green-600 p-1" title="Approve">
                        <Check size={16} />
                      </button>
                    )}
                    {q.status !== 'rejected' && (
                      <button onClick={() => handleStatusChange(q.id, 'rejected')} className="text-red-500 hover:text-red-600 p-1" title="Reject">
                        <X size={16} />
                      </button>
                    )}
                    <button onClick={() => handleEdit(q)} className="text-blue-500 hover:text-blue-600 p-1" title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-600 p-1" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsCsvModalOpen(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-lg shadow-2xl border border-[var(--border)]" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Bulk CSV Import</h3>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleCsvSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Paste CSV Data</label>
                <textarea rows={10} required className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 font-mono text-xs text-[var(--text-primary)]"
                          placeholder={`question_text,question_type,options,correct_answer,difficulty\n"What is 2+2?","mcq","[""3"",""4"",""5""]","{""indices"":[1]}","easy"`}
                          value={csvText} onChange={e => setCsvText(e.target.value)} />
              </div>
              <p className="text-xs text-[var(--text-muted)]">Tip: Use double-quotes to escape lists or JSON strings in options/correct_answer.</p>
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={() => setIsCsvModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)]">Cancel</button>
                <button type="submit" disabled={isCsvSubmitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center min-w-[100px]">
                  {isCsvSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Extraction Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setIsAiModalOpen(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-4xl shadow-2xl border border-[var(--border)] my-8" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles size={20} className="text-purple-500" /> AI Question Extractor
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="p-5 space-y-6">
              {extractedQuestions.length === 0 ? (
                <form onSubmit={handleAiExtract} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Paste Raw Syllabus or Questions Text</label>
                    <textarea rows={12} required className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
                              placeholder="Paste a page of a book, a list of questions, or syllabus details here. AI will extract multiple choice questions, answers, and solutions..."
                              value={aiRawText} onChange={e => setAiRawText(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                    <button type="button" onClick={() => setIsAiModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)]">Cancel</button>
                    <button type="submit" disabled={isAiExtracting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center min-w-[120px]">
                      {isAiExtracting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />} Extract Questions
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Successfully parsed {extractedQuestions.length} questions. Please review them before saving.
                    </span>
                    <button onClick={() => setExtractedQuestions([])} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">Start Over</button>
                  </div>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {extractedQuestions.map((q, i) => (
                      <div key={i} className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg space-y-2">
                        <div className="font-semibold text-sm text-[var(--text-primary)]">{i + 1}. {q.question_text}</div>
                        <div className="flex gap-2">
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-semibold uppercase">{q.question_type}</span>
                          <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs font-semibold uppercase">{q.difficulty}</span>
                        </div>
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-2 pl-4">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className={`text-xs p-2 rounded border ${q.correct_answer?.indices?.includes(oi) ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-[var(--border)]'}`}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        {q.explanation && (
                          <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] p-2 rounded mt-2">
                            <strong>Explanation:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                    <button type="button" onClick={() => setIsAiModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)]">Cancel</button>
                    <button onClick={handleSaveExtracted} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center min-w-[150px]">
                      Save All to Bank
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
