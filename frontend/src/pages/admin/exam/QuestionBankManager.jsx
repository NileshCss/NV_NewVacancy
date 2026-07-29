import React, { useState, useEffect } from 'react'
import { fetchExams, createQuestion, updateQuestion, bulkImportQuestions, extractQuestionsAI, importQuestionsFile } from '../../../services/api'
import { FileSpreadsheet, Sparkles, Plus, Upload, Loader2, CheckCircle2, AlertTriangle, AlertCircle, ChevronRight, Menu, X } from 'lucide-react'
import toast from 'react-hot-toast'
import SyllabusHierarchyPanel from './SyllabusHierarchyPanel'
import QuestionBankTopicView from './QuestionBankTopicView'
import QuestionEditor from './QuestionEditor'

export default function QuestionBankManager() {
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [exams, setExams] = useState([])

  // Mobile Drawer Toggle
  const [isMobileTreeOpen, setIsMobileTreeOpen] = useState(false)

  // Unified Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importTab, setImportTab] = useState('upload') // 'upload' or 'paste'
  const [selectedFile, setSelectedFile] = useState(null)
  const [isImportSubmitting, setIsImportSubmitting] = useState(false)
  const [importSummary, setImportSummary] = useState(null)

  // Paste CSV State
  const [csvText, setCsvText] = useState('')
  const [importExamId, setImportExamId] = useState('')

  // AI Import State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiRawText, setAiRawText] = useState('')
  const [isAiExtracting, setIsAiExtracting] = useState(false)
  const [extractedQuestions, setExtractedQuestions] = useState([])

  useEffect(() => {
    fetchExams().then(setExams).catch(() => {})
  }, [])

  // Action Triggers from Topic View
  const handleAddQuestionClick = (topic) => {
    setEditingQuestion(null)
    setIsEditorOpen(true)
  }

  const handleEditQuestionClick = (q) => {
    setEditingQuestion(q)
    setIsEditorOpen(true)
  }

  const handleBulkImportClick = (topic) => {
    setImportExamId(topic?.examId || '')
    setImportSummary(null)
    setSelectedFile(null)
    setIsImportModalOpen(true)
  }

  const handleAiExtractClick = (topic) => {
    setAiRawText('')
    setExtractedQuestions([])
    setIsAiModalOpen(true)
  }

  // Save Question Handler
  const handleSaveQuestion = async (payload) => {
    try {
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, payload)
        toast.success('Question updated successfully!')
      } else {
        await createQuestion(payload)
        toast.success('Question created successfully!')
      }
      setIsEditorOpen(false)
    } catch (err) {
      toast.error(err.message || 'Error saving question')
    }
  }

  // File Import Submit
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
    } catch (err) {
      toast.error(err.message || 'File import failed')
    } finally {
      setIsImportSubmitting(false)
    }
  }

  // CSV Submit
  const handleCsvSubmit = async (e) => {
    e.preventDefault()
    if (!csvText.trim()) return toast.error('Please paste CSV data first')
    setIsImportSubmitting(true)
    setImportSummary(null)
    try {
      const mappings = selectedTopic ? [{
        exam_id: selectedTopic.examId,
        subject_id: selectedTopic.subjectId,
        chapter_id: selectedTopic.chapterId,
        topic_id: selectedTopic.id
      }] : []
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
    } catch (err) {
      toast.error(err.message || 'CSV Import failed')
    } finally {
      setIsImportSubmitting(false)
    }
  }

  // AI Extract
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
      const mappings = selectedTopic ? [{
        exam_id: selectedTopic.examId,
        subject_id: selectedTopic.subjectId,
        chapter_id: selectedTopic.chapterId,
        topic_id: selectedTopic.id
      }] : []
      for (const q of extractedQuestions) {
        await createQuestion({ ...q, mappings })
      }
      toast.dismiss(loadingToast)
      toast.success('All AI extracted questions saved!')
      setIsAiModalOpen(false)
      setAiRawText('')
      setExtractedQuestions([])
    } catch (err) {
      toast.dismiss(loadingToast)
      toast.error('Error saving extracted questions')
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Top Header Bar with Mobile Drawer Toggle */}
      <div className="flex items-center justify-between gap-3 bg-[var(--bg-card)] border border-[var(--border)] p-3.5 sm:p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsMobileTreeOpen(!isMobileTreeOpen)}
            className="md:hidden px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 hover:bg-[var(--border)] transition shrink-0"
          >
            <Menu size={16} />
            <span>Syllabus</span>
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">Question Bank Management</h2>
            <p className="text-xs text-[var(--text-muted)] truncate hidden sm:block">Organized Topic-wise with lazy loading tree navigation and fast CRUD.</p>
          </div>
        </div>
      </div>

      {/* Editor Modal / Inline Overlay */}
      {isEditorOpen && (
        <QuestionEditor
          question={editingQuestion}
          defaultMapping={selectedTopic}
          onSave={handleSaveQuestion}
          onCancel={() => setIsEditorOpen(false)}
        />
      )}

      {/* MAIN SPLIT PANEL LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start min-h-[680px]">
        {/* LEFT PANEL: Tree Navigation (Desktop 4 cols, Mobile Drawer) */}
        <div className={`md:col-span-4 lg:col-span-3 h-[680px] ${isMobileTreeOpen ? 'block' : 'hidden md:block'}`}>
          <SyllabusHierarchyPanel
            selectedTopic={selectedTopic}
            onSelectTopic={(topic) => {
              setSelectedTopic(topic)
              setIsMobileTreeOpen(false)
            }}
          />
        </div>

        {/* RIGHT PANEL: Topic View & Questions Table (Desktop 8-9 cols) */}
        <div className="md:col-span-8 lg:col-span-9">
          <QuestionBankTopicView
            selectedTopic={selectedTopic}
            onAddQuestion={handleAddQuestionClick}
            onEditQuestion={handleEditQuestionClick}
            onBulkImport={handleBulkImportClick}
            onAiExtract={handleAiExtractClick}
          />
        </div>
      </div>

      {/* Unified Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-500" size={20} />
                <span>Bulk Import Questions {selectedTopic ? `into ${selectedTopic.name}` : ''}</span>
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-200">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!importSummary ? (
                <>
                  <div className="flex border-b border-[var(--border)]">
                    <button
                      onClick={() => setImportTab('upload')}
                      className={`pb-3 px-4 text-xs font-semibold border-b-2 transition ${
                        importTab === 'upload' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--text-muted)]'
                      }`}
                    >
                      Upload File (.xlsx, .csv, .pdf)
                    </button>
                    <button
                      onClick={() => setImportTab('paste')}
                      className={`pb-3 px-4 text-xs font-semibold border-b-2 transition ${
                        importTab === 'paste' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--text-muted)]'
                      }`}
                    >
                      Paste CSV Text
                    </button>
                  </div>

                  {importTab === 'upload' ? (
                    <form onSubmit={handleFileImportSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)]">Target Exam *</label>
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
                          onChange={e => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-full">
                            <Upload size={22} />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-[var(--text-primary)]">
                              {selectedFile ? selectedFile.name : 'Click to select or drag & drop file'}
                            </span>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                              Supports Excel (.xlsx, .xls), CSV (.csv) or Question Paper PDF (.pdf)
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] rounded-lg">Cancel</button>
                        <button type="submit" disabled={isImportSubmitting || !selectedFile} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center min-w-[120px]">
                          {isImportSubmitting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                          {isImportSubmitting ? 'Importing...' : 'Upload & Import'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleCsvSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Paste CSV Data</label>
                        <textarea
                          rows={8}
                          required
                          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 font-mono text-xs text-[var(--text-primary)]"
                          placeholder={`question_text,question_type,options,correct_answer,difficulty\n"What is 2+2?","mcq","[""3"",""4"",""5""]","{""indices"":[1]}","easy"`}
                          value={csvText}
                          onChange={e => setCsvText(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] rounded-lg">Cancel</button>
                        <button type="submit" disabled={isImportSubmitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center min-w-[100px]">
                          {isImportSubmitting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                          {isImportSubmitting ? 'Importing...' : 'Import'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-2 py-4">
                    <div className="inline-flex p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-full">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-base font-bold text-[var(--text-primary)]">Import Processing Complete!</h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-center">
                      <div className="text-xl font-bold text-[var(--text-primary)]">{importSummary.total}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Questions Found</div>
                    </div>
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/50 rounded-xl text-center">
                      <div className="text-xl font-bold text-emerald-600">{importSummary.successCount}</div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">Imported</div>
                    </div>
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 rounded-xl text-center">
                      <div className="text-xl font-bold text-amber-600">{importSummary.duplicateCount}</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">Duplicates</div>
                    </div>
                    <div className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-200/50 rounded-xl text-center">
                      <div className="text-xl font-bold text-red-600">{importSummary.failedCount}</div>
                      <div className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">Failed</div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-[var(--border)]">
                    <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-5 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] font-bold">
                      Close Summary
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Extraction Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={() => setIsAiModalOpen(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-3xl shadow-2xl my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles size={18} className="text-purple-500" />
                <span>AI Question Extractor {selectedTopic ? `into ${selectedTopic.name}` : ''}</span>
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-gray-400 hover:text-gray-200">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {extractedQuestions.length === 0 ? (
                <form onSubmit={handleAiExtract} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Paste Raw Syllabus or Questions Text</label>
                    <textarea rows={10} required className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)]"
                              placeholder="Paste text from a book, website or notes. AI will extract MCQs, answers and solutions automatically..."
                              value={aiRawText} onChange={e => setAiRawText(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                    <button type="button" onClick={() => setIsAiModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] rounded-lg font-medium">Cancel</button>
                    <button type="submit" disabled={isAiExtracting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center min-w-[120px]">
                      {isAiExtracting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Sparkles size={14} className="mr-2" />} Extract Questions
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-purple-950/20 p-3 rounded-lg border border-purple-800 text-xs text-purple-300">
                    <span>Parsed {extractedQuestions.length} questions successfully!</span>
                    <button onClick={() => setExtractedQuestions([])} className="text-purple-400 hover:underline">Start Over</button>
                  </div>

                  <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                    {extractedQuestions.map((q, i) => (
                      <div key={i} className="p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs space-y-1.5">
                        <div className="font-semibold text-[var(--text-primary)]">{i + 1}. {q.question_text}</div>
                        {q.options && (
                          <div className="grid grid-cols-2 gap-1.5 pl-2 pt-1">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className={`p-1.5 rounded border ${q.correct_answer?.indices?.includes(oi) ? 'border-emerald-500 bg-emerald-950/20' : 'border-[var(--border)]'}`}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                    <button type="button" onClick={() => setIsAiModalOpen(false)} className="px-4 py-2 bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] rounded-lg font-medium">Cancel</button>
                    <button onClick={handleSaveExtracted} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">
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
