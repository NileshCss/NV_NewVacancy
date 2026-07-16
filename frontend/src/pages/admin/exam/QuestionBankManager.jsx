import React, { useState, useEffect } from 'react'
import { fetchQuestions, fetchExams, fetchSubjects, fetchTopics, createQuestion, updateQuestion, updateQuestionStatus, deleteQuestion, bulkImportQuestions, extractQuestionsAI, importQuestionsFile } from '../../../services/api'
import { Edit2, Trash2, Plus, Loader2, Sparkles, Check, X, FileSpreadsheet, Filter, Search, ChevronRight, Upload, File, CheckCircle2, AlertTriangle, AlertCircle, CheckCheck } from 'lucide-react'
import QuestionEditor from './QuestionEditor'
import toast from 'react-hot-toast'

export default function QuestionBankManager() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [exams, setExams] = useState([])
  
  // Unified Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importTab, setImportTab] = useState('upload') // 'upload' or 'paste'
  const [selectedFile, setSelectedFile] = useState(null)
  const [isImportSubmitting, setIsImportSubmitting] = useState(false)
  const [importSummary, setImportSummary] = useState(null)
  
  // Paste CSV State
  const [csvText, setCsvText] = useState('')
  const [importExamId, setImportExamId] = useState('')

  // AI Import State (for text copy-paste option)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiRawText, setAiRawText] = useState('')
  const [isAiExtracting, setIsAiExtracting] = useState(false)
  const [extractedQuestions, setExtractedQuestions] = useState([])

  // Filtering State
  const [filters, setFilters] = useState({
    exam_id: '',
    difficulty: '',
    status: '',
    search: '',
    tag: ''
  })

  // Deep Link tag parser
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlTag = params.get('tag')
    if (urlTag) {
      setFilters(prev => ({ ...prev, status: 'draft', tag: urlTag }))
      // Clear parameter from URL bar to prevent looping on page reloads
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

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

  // Approve all non-approved questions currently visible
  const [isApprovingAll, setIsApprovingAll] = useState(false)

  const handleApproveAll = async () => {
    const toApprove = questions.filter(q => q.status !== 'approved')
    if (toApprove.length === 0) return toast('All visible questions are already approved!')

    const confirmed = window.confirm(
      `Approve all ${toApprove.length} question${toApprove.length !== 1 ? 's' : ''} in the current view?\n\nThis will mark them as approved and make them available for mock tests.`
    )
    if (!confirmed) return

    setIsApprovingAll(true)
    const loadingToast = toast.loading(`Approving ${toApprove.length} questions...`)
    let successCount = 0
    let failCount = 0

    for (const q of toApprove) {
      try {
        await updateQuestionStatus(q.id, 'approved')
        successCount++
      } catch {
        failCount++
      }
    }

    toast.dismiss(loadingToast)
    setIsApprovingAll(false)

    if (failCount === 0) {
      toast.success(`✅ All ${successCount} questions approved successfully!`)
    } else {
      toast.error(`${successCount} approved, ${failCount} failed. Check console.`)
    }

    loadQuestions()
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleFileImportSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) return toast.error('Please select a file first')
    if (!importExamId) return toast.error('Please select a Target Exam first')
    setIsImportSubmitting(true)
    setImportSummary(null)
    try {
      const summary = await importQuestionsFile(selectedFile, importExamId)
      setImportSummary(summary)
      toast.success('File imported successfully!')
      loadQuestions()
    } catch (err) {
      toast.error(err.message || 'File import failed')
    } finally {
      setIsImportSubmitting(false)
    }
  }

  const handleCsvSubmit = async (e) => {
    e.preventDefault()
    if (!csvText.trim()) return toast.error('Please paste CSV data first')
    setIsImportSubmitting(true)
    setImportSummary(null)
    try {
      const mappings = filters.exam_id ? [{ exam_id: filters.exam_id }] : []
      const res = await bulkImportQuestions(csvText, mappings)
      setImportSummary({
        total: res.successCount + res.duplicateCount + res.failedCount,
        successCount: res.successCount,
        duplicateCount: res.duplicateCount,
        failedCount: res.failedCount,
        unresolvedRefs: [],
        logId: null
      })
      toast.success('CSV Paste imported successfully!')
      setCsvText('')
      loadQuestions()
    } catch (err) {
      toast.error(err.message || 'CSV Import failed')
    } finally {
      setIsImportSubmitting(false)
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

  const handleApplyBatchFilter = (logId) => {
    setFilters({
      exam_id: '',
      difficulty: '',
      status: 'draft',
      search: '',
      tag: `batch_${logId}`
    })
    setIsImportModalOpen(false)
    setSelectedFile(null)
    setImportSummary(null)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Question Bank</h2>
          <p className="text-sm text-[var(--text-muted)]">Manage questions, approve drafts, import bulk data or use AI parsing.</p>
        </div>
        <div className="flex flex-wrap gap-2">

          {/* Approve All — only shown when there are non-approved questions visible */}
          {!loading && questions.filter(q => q.status !== 'approved').length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={isApprovingAll}
              title={`Approve all ${questions.filter(q => q.status !== 'approved').length} visible non-approved questions`}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold shadow-sm"
            >
              {isApprovingAll
                ? <><Loader2 size={16} className="animate-spin" /> Approving...</>
                : <><CheckCheck size={16} /> Approve All ({questions.filter(q => q.status !== 'approved').length})</>
              }
            </button>
          )}

          <button onClick={() => setIsAiModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
            <Sparkles size={18} /> AI Extract
          </button>
          <button onClick={() => { setIsImportModalOpen(true); setImportSummary(null); setSelectedFile(null); setImportExamId(filters.exam_id); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            <FileSpreadsheet size={18} /> Bulk Import
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
          {filters.tag && (
            <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-sm font-semibold">
              <span>Batch Filter Active</span>
              <button onClick={() => setFilters(prev => ({ ...prev, tag: '' }))} className="text-purple-500 hover:text-purple-700 font-bold ml-1">✕</button>
            </div>
          )}

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

      {/* Unified Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-2xl shadow-2xl border border-[var(--border)] my-8" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileSpreadsheet className="text-green-500" size={22} /> Bulk Import Questions
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {!importSummary ? (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-[var(--border)]">
                    <button
                      onClick={() => setImportTab('upload')}
                      className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
                        importTab === 'upload' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--text-muted)]'
                      }`}
                    >
                      Upload File (.xlsx, .csv, .pdf)
                    </button>
                    <button
                      onClick={() => setImportTab('paste')}
                      className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
                        importTab === 'paste' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--text-muted)]'
                      }`}
                    >
                      Paste CSV Text
                    </button>
                  </div>

                  {importTab === 'upload' ? (
                    <form onSubmit={handleFileImportSubmit} className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">Target Exam (Required for Subject & Topic resolution)</label>
                        <select
                          required
                          value={importExamId}
                          onChange={e => setImportExamId(e.target.value)}
                          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- Select Target Exam --</option>
                          {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                        </select>
                      </div>

                      <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]/80 transition relative">
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.pdf"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-full">
                            <Upload size={24} />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {selectedFile ? selectedFile.name : 'Click to select or drag and drop a file'}
                            </span>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              Supports Excel (.xlsx, .xls), CSV (.csv) or Question Paper PDF (.pdf)
                            </p>
                          </div>
                          {selectedFile && (
                            <span className="text-xs font-mono bg-[var(--bg-card)] px-2.5 py-1 border border-[var(--border)] rounded text-[var(--text-secondary)] mt-2">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-4 text-xs space-y-2 text-blue-700 dark:text-blue-300">
                        <strong className="block text-sm">💡 Expected Document Formats:</strong>
                        <ul className="list-disc pl-4 space-y-1">
                          <li><strong>Excel/CSV:</strong> Must include columns: <code>question_text</code>, <code>option_a</code>, <code>option_b</code>, <code>option_c</code>, <code>option_d</code>, <code>correct_answer</code> (A/B/C/D or index). Optional: <code>explanation</code>, <code>difficulty</code>, <code>exam_name</code>, <code>subject_name</code>, etc.</li>
                          <li><strong>PDF:</strong> Raw text is extracted and auto-parsed using local Ollama model context in chunks.</li>
                        </ul>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)]">Cancel</button>
                        <button type="submit" disabled={isImportSubmitting || !selectedFile} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center min-w-[120px]">
                          {isImportSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          {isImportSubmitting ? 'Importing...' : 'Upload & Import'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleCsvSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Paste CSV Data</label>
                        <textarea
                          rows={8}
                          required
                          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 font-mono text-xs text-[var(--text-primary)]"
                          placeholder={`question_text,question_type,options,correct_answer,difficulty\n"What is 2+2?","mcq","[""3"",""4"",""5""]","{""indices"":[1]}","easy"`}
                          value={csvText}
                          onChange={e => setCsvText(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">Tip: Use double-quotes to escape lists or JSON strings in options/correct_answer.</p>
                      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)]">Cancel</button>
                        <button type="submit" disabled={isImportSubmitting} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center min-w-[100px]">
                          {isImportSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                          {isImportSubmitting ? 'Importing...' : 'Import'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                /* Import Summary UI */
                <div className="space-y-6">
                  <div className="text-center space-y-2 py-4">
                    <div className="inline-flex p-3 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-full">
                      <CheckCircle2 size={36} />
                    </div>
                    <h4 className="text-lg font-bold text-[var(--text-primary)]">Import Processing Complete!</h4>
                    <p className="text-sm text-[var(--text-muted)]">Your document has been processed and saved into drafts.</p>
                  </div>

                  {/* Summary Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-center">
                      <div className="text-2xl font-extrabold text-[var(--text-primary)]">{importSummary.total}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">Questions Found</div>
                    </div>
                    <div className="p-4 bg-green-50/50 dark:bg-green-950/10 border border-green-200/50 dark:border-green-900/20 rounded-xl text-center">
                      <div className="text-2xl font-extrabold text-green-600 dark:text-green-400">{importSummary.successCount}</div>
                      <div className="text-xs text-green-700 dark:text-green-300 mt-1">Successfully Imported</div>
                    </div>
                    <div className="p-4 bg-yellow-50/50 dark:bg-yellow-950/10 border border-yellow-200/50 dark:border-yellow-900/20 rounded-xl text-center">
                      <div className="text-2xl font-extrabold text-yellow-600 dark:text-yellow-400">{importSummary.duplicateCount}</div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Flagged Duplicates</div>
                    </div>
                    <div className="p-4 bg-red-50/50 dark:bg-red-950/10 border border-red-200/50 dark:border-red-900/20 rounded-xl text-center">
                      <div className="text-2xl font-extrabold text-red-600 dark:text-red-400">{importSummary.failedCount}</div>
                      <div className="text-xs text-red-700 dark:text-red-300 mt-1">Failed to Parse</div>
                    </div>
                  </div>

                  {/* Unresolved Taxonomy References */}
                  {importSummary.unresolvedRefs && importSummary.unresolvedRefs.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
                        <AlertTriangle size={18} />
                        <span>Unresolved Exam/Subject/Chapter references ({importSummary.unresolvedRefs.length})</span>
                      </div>
                      <div className="max-h-[150px] overflow-y-auto pr-2 space-y-1.5 text-xs text-amber-800 dark:text-amber-400 font-mono">
                        {importSummary.unresolvedRefs.map((ref, idx) => (
                          <div key={idx}>
                            Row {ref.row}: The {ref.type} name <span className="underline font-bold">"{ref.name}"</span> does not match any existing records.
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-amber-600 dark:text-amber-500 pt-1">
                        Note: The questions were still imported, but without these mapping relations.
                      </p>
                    </div>
                  )}

                  {/* Parsing / Insertion Errors */}
                  {importSummary.errors && importSummary.errors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm">
                        <AlertCircle size={18} />
                        <span>Parsing / Upload Errors ({importSummary.errors.length})</span>
                      </div>
                      <div className="max-h-[150px] overflow-y-auto pr-2 space-y-1.5 text-xs text-red-800 dark:text-red-400 font-mono">
                        {importSummary.errors.map((err, idx) => (
                          <div key={idx} className="border-b border-[var(--border)]/30 pb-1 last:border-b-0">
                            {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="w-full sm:w-auto px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] text-center font-medium"
                    >
                      Close Summary
                    </button>
                    {importSummary.logId && (
                      <button
                        onClick={() => handleApplyBatchFilter(importSummary.logId)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-600/30 transition-all duration-200"
                      >
                        Review Drafts in this Batch <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
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
