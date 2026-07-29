import React, { useState, useEffect, useMemo } from 'react'
import { fetchQuestions, updateQuestionStatus, deleteQuestion, duplicateQuestion, moveQuestion, bulkMoveQuestions } from '../../../services/api'
import { Check, X, FileText, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import QuestionBankToolbar from './QuestionBankToolbar'
import QuestionListTable from './QuestionListTable'
import QuestionListCardMobile from './QuestionListCardMobile'
import PaginationBar from './PaginationBar'
import QuestionBankMoveModal from './QuestionBankMoveModal'

function getScopeParams(scope) {
  if (!scope) return {}
  const type = scope.type || 'topic'
  if (type === 'exam')    return { exam_id: scope.examId || scope.id }
  if (type === 'subject') return { subject_id: scope.subjectId || scope.id }
  if (type === 'chapter') return { chapter_id: scope.chapterId || scope.id }
  return { topic_id: scope.id }
}

function getScopeLabel(scope) {
  if (!scope) return ''
  const type = scope.type || 'topic'
  if (type === 'exam')    return `All in Exam: ${scope.name}`
  if (type === 'subject') return `All in Subject: ${scope.name}`
  if (type === 'chapter') return `All in Chapter: ${scope.name}`
  return scope.name
}

export default function QuestionBankTopicView({
  selectedTopic,
  onAddQuestion,
  onEditQuestion,
  onBulkImport,
  onAiExtract
}) {
  const [allQuestions, setAllQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [verifyingAll, setVerifyingAll] = useState(false)
  const [deletingDuplicates, setDeletingDuplicates] = useState(false)

  // Pagination & Page Size (default 15 per page matching mockup)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Modals
  const [moveModalQuestion, setMoveModalQuestion] = useState(null)
  const [previewQuestion, setPreviewQuestion] = useState(null)
  const [duplicateComparisonModal, setDuplicateComparisonModal] = useState(null)

  // Filters
  const [filters, setFilters] = useState({ search: '', difficulty: '', status: '' })

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [selectedTopic?.id, selectedTopic?.type, filters, pageSize])

  // Clean Breadcrumb Segments — Fixes breadcrumb duplication!
  const breadcrumbSegments = useMemo(() => {
    if (!selectedTopic) return []
    const type = selectedTopic.type || 'topic'
    if (type === 'exam') return [selectedTopic.name]
    if (type === 'subject') {
      const segs = []
      if (selectedTopic.examName) segs.push(selectedTopic.examName)
      segs.push(selectedTopic.name)
      return segs
    }
    if (type === 'chapter') {
      const segs = []
      if (selectedTopic.examName) segs.push(selectedTopic.examName)
      if (selectedTopic.subjectName && selectedTopic.subjectName !== selectedTopic.name) segs.push(selectedTopic.subjectName)
      segs.push(selectedTopic.name)
      return segs
    }
    // topic level
    const segs = []
    if (selectedTopic.examName) segs.push(selectedTopic.examName)
    if (selectedTopic.subjectName) segs.push(selectedTopic.subjectName)
    if (selectedTopic.chapterName && selectedTopic.chapterName !== selectedTopic.subjectName) segs.push(selectedTopic.chapterName)
    segs.push(selectedTopic.name)
    return segs
  }, [selectedTopic])

  // Load ALL questions for selected scope
  const loadQuestions = async () => {
    if (!selectedTopic) return
    setLoading(true)
    try {
      const scopeParams = getScopeParams(selectedTopic)
      const queryParams = {
        ...scopeParams,
        limit: 1000,
      }

      const res = await fetchQuestions(queryParams)
      const list = Array.isArray(res) ? res : []
      setAllQuestions(list)
    } catch (err) {
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQuestions() }, [selectedTopic?.id, selectedTopic?.type])

  // Accurate Duplicate Detection Algorithm
  const { duplicateQuestions, duplicateMap, duplicateSet } = useMemo(() => {
    const textToFirstQuestion = new Map()
    const duplicates = []
    const dupMap = new Map()
    const dupSet = new Set()

    allQuestions.forEach(q => {
      const key = (q.question_text || '').trim().toLowerCase()
      if (key && !textToFirstQuestion.has(key)) {
        textToFirstQuestion.set(key, q)
      }
    })

    allQuestions.forEach(q => {
      const key = (q.question_text || '').trim().toLowerCase()
      const first = textToFirstQuestion.get(key)

      if (q.possible_duplicate_of) {
        duplicates.push(q)
        dupSet.add(q.id)
        const matchObj = allQuestions.find(item => item.id === q.possible_duplicate_of)
        dupMap.set(q.id, matchObj || first || null)
      } else if (first && first.id !== q.id) {
        duplicates.push(q)
        dupSet.add(q.id)
        dupMap.set(q.id, first)
      }
    })

    return { duplicateQuestions: duplicates, duplicateMap: dupMap, duplicateSet: dupSet }
  }, [allQuestions])

  // Overall Scope Statistics
  const stats = useMemo(() => {
    const total = allQuestions.length
    const approved = allQuestions.filter(q => q.status === 'approved').length
    const rejected = allQuestions.filter(q => q.status === 'rejected').length
    const pending  = allQuestions.filter(q => q.status !== 'approved' && q.status !== 'rejected').length
    const duplicates = duplicateQuestions.length
    return { total, approved, pending, rejected, duplicates }
  }, [allQuestions, duplicateQuestions])

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      if (filters.difficulty && q.difficulty !== filters.difficulty) return false
      if (filters.status === 'duplicates') {
        if (!duplicateSet.has(q.id)) return false
      } else if (filters.status && q.status !== filters.status) {
        return false
      }

      if (filters.search) {
        const s = filters.search.toLowerCase()
        const textMatch = q.question_text?.toLowerCase().includes(s)
        const typeMatch = q.question_type?.toLowerCase().includes(s)
        if (!textMatch && !typeMatch) return false
      }
      return true
    })
  }, [allQuestions, filters, duplicateSet])

  // Paginated View Slice
  const paginatedQuestions = useMemo(() => {
    if (pageSize === 'all') return filteredQuestions
    const start = (page - 1) * pageSize
    return filteredQuestions.slice(start, start + pageSize)
  }, [filteredQuestions, page, pageSize])

  if (!selectedTopic) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-[var(--bg-surface)] text-orange-500 rounded-2xl border border-[var(--border)]">
          <FileText size={40} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">No Topic Selected</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
            Select a Topic, Chapter, or Subject from the hierarchy tree on the left to view and manage questions.
            <br /><span className="text-orange-500 font-semibold">Tip: Click the "All" button next to any Subject or Chapter to see all questions at that level!</span>
          </p>
        </div>
      </div>
    )
  }

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedQuestions.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginatedQuestions.map(q => q.id)))
  }

  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Status & Delete Actions
  const handleStatusChange = async (id, status) => {
    try {
      await updateQuestionStatus(id, status)
      toast.success(`Question status updated to ${status}!`)
      loadQuestions()
    } catch { toast.error('Failed to update status') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    try {
      await deleteQuestion(id)
      toast.success('Question deleted!')
      loadQuestions()
    } catch { toast.error('Failed to delete question') }
  }

  const handleDuplicate = async (id) => {
    const t = toast.loading('Duplicating question...')
    try {
      await duplicateQuestion(id)
      toast.dismiss(t)
      toast.success('Duplicated to Drafts!')
      loadQuestions()
    } catch {
      toast.dismiss(t)
      toast.error('Duplication failed')
    }
  }

  // Bulk Actions
  const handleBulkApprove = async () => {
    if (!selectedIds.size) return
    const ids = Array.from(selectedIds)
    const t = toast.loading(`Approving ${ids.length} questions...`)
    for (const id of ids) await updateQuestionStatus(id, 'approved').catch(() => {})
    toast.dismiss(t)
    toast.success(`${ids.length} questions approved!`)
    setSelectedIds(new Set())
    loadQuestions()
  }

  const handleBulkReject = async () => {
    if (!selectedIds.size) return
    const ids = Array.from(selectedIds)
    const t = toast.loading(`Rejecting ${ids.length} questions...`)
    for (const id of ids) await updateQuestionStatus(id, 'rejected').catch(() => {})
    toast.dismiss(t)
    toast.success(`${ids.length} questions rejected!`)
    setSelectedIds(new Set())
    loadQuestions()
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} selected questions?`)) return
    const ids = Array.from(selectedIds)
    const t = toast.loading(`Deleting ${ids.length}...`)
    for (const id of ids) await deleteQuestion(id).catch(() => {})
    toast.dismiss(t)
    toast.success(`${ids.length} questions deleted!`)
    setSelectedIds(new Set())
    loadQuestions()
  }

  const handleVerifyAllPending = async () => {
    const pending = allQuestions.filter(q => q.status !== 'approved' && q.status !== 'rejected')
    if (!pending.length) return toast.error('No pending questions to verify!')
    if (!confirm(`Verify and approve all ${pending.length} pending questions in ${selectedTopic.name}?`)) return
    setVerifyingAll(true)
    const t = toast.loading(`Verifying ${pending.length} questions...`)
    for (const q of pending) await updateQuestionStatus(q.id, 'approved').catch(() => {})
    toast.dismiss(t)
    toast.success(`${pending.length} questions verified!`)
    setVerifyingAll(false)
    loadQuestions()
  }

  const handleDeleteAllDuplicates = async () => {
    if (duplicateQuestions.length === 0) return toast.error('No duplicate questions found!')
    if (!confirm(`Are you sure you want to delete ALL ${duplicateQuestions.length} duplicate questions in ${selectedTopic.name}?\n\nThe original copy of each question will be preserved.`)) return

    setDeletingDuplicates(true)
    const t = toast.loading(`Deleting ${duplicateQuestions.length} duplicate questions...`)
    try {
      for (const q of duplicateQuestions) {
        await deleteQuestion(q.id).catch(() => {})
      }
      toast.dismiss(t)
      toast.success(`Successfully deleted ${duplicateQuestions.length} duplicate questions! 🎉`)
      loadQuestions()
    } catch (err) {
      toast.dismiss(t)
      toast.error('Error deleting duplicate questions')
    } finally {
      setDeletingDuplicates(false)
    }
  }

  const handleConfirmMove = async (targetMapping) => {
    if (moveModalQuestion === 'bulk') {
      await bulkMoveQuestions(Array.from(selectedIds), targetMapping)
      toast.success(`${selectedIds.size} questions moved!`)
      setSelectedIds(new Set())
    } else if (moveModalQuestion?.id) {
      await moveQuestion(moveModalQuestion.id, targetMapping)
      toast.success('Question moved!')
    }
    setMoveModalQuestion(null)
    loadQuestions()
  }

  const handleExportCsv = () => {
    const listToExport = selectedIds.size > 0 ? allQuestions.filter(q => selectedIds.has(q.id)) : allQuestions
    if (!listToExport.length) return toast.error('No questions to export')
    const headers = ['id', 'question_text', 'question_type', 'difficulty', 'status', 'marks', 'negative_marks']
    const rows = listToExport.map(q => [
      q.id,
      `"${(q.question_text || '').replace(/"/g, '""')}"`,
      q.question_type, q.difficulty, q.status, q.marks, q.negative_marks
    ])
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csv))
    link.setAttribute('download', `${selectedTopic.name}_questions.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openDuplicateViewModal = (q) => {
    const match = duplicateMap.get(q.id)
    setDuplicateComparisonModal({ question: q, matchQuestion: match })
  }

  const scopeType = selectedTopic.type || 'topic'

  return (
    <div className="space-y-4 min-w-0">
      {/* TOOLBAR (Header, Stats, Filters) */}
      <QuestionBankToolbar
        selectedTopic={selectedTopic}
        scopeType={scopeType}
        breadcrumbSegments={breadcrumbSegments}
        getScopeLabel={getScopeLabel}
        stats={stats}
        filters={filters}
        onFiltersChange={setFilters}
        onAddQuestion={onAddQuestion}
        onBulkImport={onBulkImport}
        onAiExtract={onAiExtract}
        onVerifyAllPending={handleVerifyAllPending}
        onDeleteAllDuplicates={handleDeleteAllDuplicates}
        onExportCsv={handleExportCsv}
        verifyingAll={verifyingAll}
        deletingDuplicates={deletingDuplicates}
        filteredCount={filteredQuestions.length}
      />

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-primary)] shadow-md">
          <span className="font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
            {selectedIds.size} question{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleBulkApprove} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 transition shadow-xs cursor-pointer">
              <Check size={13} /> Bulk Verify
            </button>
            <button onClick={handleBulkReject} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1 transition shadow-xs cursor-pointer">
              <X size={13} /> Bulk Reject
            </button>
            <button onClick={() => setMoveModalQuestion('bulk')} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-1 transition shadow-xs cursor-pointer">
              Move Selected
            </button>
            <button onClick={handleExportCsv} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1 transition shadow-xs cursor-pointer">
              Export Selected
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1 transition shadow-xs cursor-pointer">
              <Trash2 size={13} /> Bulk Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl font-semibold transition cursor-pointer">
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* QUESTIONS WORKSPACE */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-orange-500" size={28} />
            <span className="text-xs text-[var(--text-muted)] font-medium">Loading questions...</span>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-14 text-center text-[var(--text-muted)] space-y-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">No questions found matching criteria</div>
            <div className="text-xs">Try clearing search filters or add new questions to <strong>{selectedTopic.name}</strong>.</div>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Responsive Table View */}
            <div className="hidden md:block">
              <QuestionListTable
                questions={paginatedQuestions}
                selectedIds={selectedIds}
                onToggleSelectAll={toggleSelectAll}
                onToggleSelectRow={toggleSelectRow}
                onStatusChange={handleStatusChange}
                onEdit={onEditQuestion}
                onPreview={setPreviewQuestion}
                onDuplicate={handleDuplicate}
                onMove={setMoveModalQuestion}
                onDelete={handleDelete}
                duplicateSet={duplicateSet}
                onOpenDuplicateComparison={openDuplicateViewModal}
              />
            </div>

            {/* Mobile Stacked Card View */}
            <div className="md:hidden p-3 space-y-3">
              {paginatedQuestions.map(q => (
                <QuestionListCardMobile
                  key={q.id}
                  question={q}
                  isSelected={selectedIds.has(q.id)}
                  onToggleSelect={toggleSelectRow}
                  onStatusChange={handleStatusChange}
                  onEdit={onEditQuestion}
                  onPreview={setPreviewQuestion}
                  onDuplicate={handleDuplicate}
                  onMove={setMoveModalQuestion}
                  onDelete={handleDelete}
                  isDuplicate={duplicateSet.has(q.id)}
                  onOpenDuplicateComparison={openDuplicateViewModal}
                />
              ))}
            </div>
          </>
        )}

        {/* PAGINATION FOOTER */}
        <PaginationBar
          totalItems={filteredQuestions.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* MOVE MODAL */}
      {moveModalQuestion !== null && (
        <QuestionBankMoveModal
          count={moveModalQuestion === 'bulk' ? selectedIds.size : 1}
          onConfirm={handleConfirmMove}
          onClose={() => setMoveModalQuestion(null)}
        />
      )}

      {/* PREVIEW MODAL */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={() => setPreviewQuestion(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-primary)]">Question Preview</h3>
              <button onClick={() => setPreviewQuestion(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <div className="font-semibold text-sm leading-relaxed">{previewQuestion.question_text}</div>
              {previewQuestion.options?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {previewQuestion.options.map((opt, oi) => (
                    <div key={oi} className={`p-2.5 rounded-xl border text-xs ${previewQuestion.correct_answer?.indices?.includes(oi) ? 'bg-emerald-950/40 border-emerald-500/60 font-bold text-emerald-300' : 'border-[var(--border)] bg-[var(--bg-surface)]'}`}>
                      {String.fromCharCode(65 + oi)}. {opt}
                    </div>
                  ))}
                </div>
              )}
              {previewQuestion.explanation && (
                <div className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border)] leading-relaxed">
                  <strong>Explanation:</strong> {previewQuestion.explanation}
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-[var(--border)] flex gap-2 justify-end">
              {previewQuestion.status !== 'approved' && (
                <button onClick={() => { handleStatusChange(previewQuestion.id, 'approved'); setPreviewQuestion(null) }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition">
                  <Check size={14} /> Verify Question
                </button>
              )}
              {previewQuestion.status !== 'rejected' && (
                <button onClick={() => { handleStatusChange(previewQuestion.id, 'rejected'); setPreviewQuestion(null) }}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition">
                  <X size={14} /> Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE COMPARISON MODAL */}
      {duplicateComparisonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={() => setDuplicateComparisonModal(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={18} />
                <span>Duplicate Question Comparison</span>
              </h3>
              <button onClick={() => setDuplicateComparisonModal(null)} className="text-gray-400 hover:text-gray-200 font-bold">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                <div className="font-bold text-red-400 uppercase text-[10px]">Current Question (Flagged Duplicate)</div>
                <div className="font-semibold text-sm text-[var(--text-primary)]">{duplicateComparisonModal.question.question_text}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Type: {duplicateComparisonModal.question.question_type} | Difficulty: {duplicateComparisonModal.question.difficulty}</div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="font-bold text-emerald-400 uppercase text-[10px]">Original / Matching Question</div>
                <div className="font-semibold text-sm text-[var(--text-primary)]">
                  {duplicateComparisonModal.matchQuestion ? duplicateComparisonModal.matchQuestion.question_text : 'Matching question text in system'}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {duplicateComparisonModal.matchQuestion ? `Type: ${duplicateComparisonModal.matchQuestion.question_type} | ID: ${duplicateComparisonModal.matchQuestion.id.substring(0,8)}...` : 'Identical question text exists in bank'}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
              <button
                onClick={() => {
                  handleDelete(duplicateComparisonModal.question.id)
                  setDuplicateComparisonModal(null)
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Delete Duplicate Copy
              </button>
              <button
                onClick={() => setDuplicateComparisonModal(null)}
                className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
