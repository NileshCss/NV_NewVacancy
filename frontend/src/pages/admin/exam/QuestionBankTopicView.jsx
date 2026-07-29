import React, { useState, useEffect } from 'react'
import { fetchQuestions, updateQuestionStatus, deleteQuestion, duplicateQuestion, moveQuestion, bulkMoveQuestions } from '../../../services/api'
import {
  Edit2, Trash2, Plus, Loader2, Sparkles, Check, X, FileSpreadsheet,
  Search, Copy, Eye, MoveRight, Download, Printer,
  ChevronLeft, ChevronRight, FileText, CheckCircle2, Clock, XCircle, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import QuestionBankMoveModal from './QuestionBankMoveModal'

// Derive the scope filter params from the selectedScope object
function getScopeParams(scope) {
  if (!scope) return {}
  const type = scope.type || 'topic'
  if (type === 'exam')    return { exam_id: scope.examId || scope.id }
  if (type === 'subject') return { subject_id: scope.subjectId || scope.id }
  if (type === 'chapter') return { chapter_id: scope.chapterId || scope.id }
  return { topic_id: scope.id }  // default = topic
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
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 })
  const [verifyingAll, setVerifyingAll] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const limit = 25

  // Row selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Modals
  const [moveModalQuestion, setMoveModalQuestion] = useState(null)
  const [previewQuestion, setPreviewQuestion] = useState(null)

  // Filters
  const [filters, setFilters] = useState({ search: '', difficulty: '', status: '' })

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [selectedTopic?.id, selectedTopic?.type, filters])

  const loadQuestions = async () => {
    if (!selectedTopic) return
    setLoading(true)
    try {
      const scopeParams = getScopeParams(selectedTopic)
      const queryParams = {
        ...scopeParams,
        difficulty: filters.difficulty || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        limit,
        offset: (page - 1) * limit,
      }

      const res = await fetchQuestions(queryParams)
      const list = Array.isArray(res) ? res : []
      setQuestions(list)

      const approved = list.filter(q => q.status === 'approved').length
      const rejected = list.filter(q => q.status === 'rejected').length
      const pending  = list.filter(q => q.status !== 'approved' && q.status !== 'rejected').length
      setStats({ total: list.length, approved, pending, rejected })
    } catch (err) {
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQuestions() }, [selectedTopic?.id, selectedTopic?.type, filters, page])

  if (!selectedTopic) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-12 text-center h-full flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-[var(--bg-surface)] text-[var(--brand)] rounded-2xl border border-[var(--border)]">
          <FileText size={40} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">No Topic Selected</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">
            Select a Topic, Chapter, or Subject from the hierarchy tree on the left to view and manage questions.
            <br /><span className="text-[var(--brand)] font-semibold">Tip: Click the "All" button next to any Subject or Chapter to see all questions at that level!</span>
          </p>
        </div>
      </div>
    )
  }

  // Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(questions.map(q => q.id)))
  }
  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Single actions
  const handleStatusChange = async (id, status) => {
    try {
      await updateQuestionStatus(id, status)
      toast.success(`Question ${status}!`)
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
    const t = toast.loading('Duplicating...')
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

  // Bulk actions
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

  // Verify All Pending — one-click approve all draft questions in current view
  const handleVerifyAllPending = async () => {
    const pending = questions.filter(q => q.status !== 'approved' && q.status !== 'rejected')
    if (!pending.length) return toast.error('No pending questions to verify!')
    if (!confirm(`Verify and approve all ${pending.length} pending questions?`)) return
    setVerifyingAll(true)
    const t = toast.loading(`Verifying ${pending.length} questions...`)
    for (const q of pending) await updateQuestionStatus(q.id, 'approved').catch(() => {})
    toast.dismiss(t)
    toast.success(`${pending.length} questions verified!`)
    setVerifyingAll(false)
    loadQuestions()
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
    if (!questions.length) return toast.error('No questions to export')
    const headers = ['id', 'question_text', 'question_type', 'difficulty', 'status', 'marks', 'negative_marks']
    const rows = questions.map(q => [
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

  const scopeType = selectedTopic.type || 'topic'

  return (
    <div className="space-y-4">
      {/* HEADER CARD */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            {/* Breadcrumb */}
            <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-1">
              {selectedTopic.examName  && <><span>{selectedTopic.examName}</span><span>›</span></>}
              {selectedTopic.subjectName && <><span>{selectedTopic.subjectName}</span><span>›</span></>}
              {selectedTopic.chapterName && <><span>{selectedTopic.chapterName}</span><span>›</span></>}
              <span className="font-semibold text-[var(--text-secondary)]">{selectedTopic.name}</span>
            </div>
            {/* Level badge + Title */}
            <h2 className="text-lg font-bold text-[var(--text-primary)] mt-0.5 flex items-center gap-2">
              {scopeType === 'subject' ? '📚' : scopeType === 'chapter' ? '📖' : scopeType === 'exam' ? '🏆' : '📄'}
              {getScopeLabel(selectedTopic)}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                scopeType === 'subject' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-300' :
                scopeType === 'chapter' ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-300' :
                scopeType === 'exam' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-300' :
                'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300'
              }`}>{scopeType}</span>
            </h2>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {stats.pending > 0 && (
              <button
                onClick={handleVerifyAllPending}
                disabled={verifyingAll}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
              >
                {verifyingAll ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={15} />}
                Verify All Pending ({stats.pending})
              </button>
            )}
            <button onClick={() => onAddQuestion(selectedTopic)} className="px-3.5 py-1.5 bg-[var(--brand)] hover:bg-[var(--brand-d)] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5">
              <Plus size={15} /> Add Question
            </button>
            <button onClick={() => onBulkImport(selectedTopic)} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5">
              <FileSpreadsheet size={15} /> Bulk Import
            </button>
            <button onClick={() => onAiExtract(selectedTopic)} className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5">
              <Sparkles size={15} /> AI Extract
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border)] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-1 rounded-full text-[var(--text-secondary)] font-medium">
              Total: <strong className="text-[var(--text-primary)]">{stats.total}</strong>
            </span>
            <span className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 size={12} /> Verified: <strong>{stats.approved}</strong>
            </span>
            <span className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <Clock size={12} /> Pending: <strong>{stats.pending}</strong>
            </span>
            <span className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <XCircle size={12} /> Rejected: <strong>{stats.rejected}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCsv} className="p-1.5 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-medium transition flex items-center gap-1">
              <Download size={13} /> Export
            </button>
            <button onClick={() => window.print()} className="p-1.5 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-medium transition flex items-center gap-1">
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3.5 rounded-xl flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            placeholder={`Search questions in ${selectedTopic.name}...`}
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)]"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filters.difficulty} onChange={e => setFilters({ ...filters, difficulty: e.target.value })}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)]">
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)]">
            <option value="">All Statuses</option>
            <option value="approved">Verified</option>
            <option value="draft">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          {(filters.search || filters.difficulty || filters.status) && (
            <button onClick={() => setFilters({ search: '', difficulty: '', status: '' })} className="px-2.5 py-1.5 text-xs text-red-500 hover:underline font-semibold">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-blue-200">
          <span className="font-bold">{selectedIds.size} Question{selectedIds.size !== 1 ? 's' : ''} Selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleBulkApprove} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center gap-1">
              <Check size={12} /> Verify All
            </button>
            <button onClick={handleBulkReject} className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold flex items-center gap-1">
              <X size={12} /> Reject All
            </button>
            <button onClick={() => setMoveModalQuestion('bulk')} className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold flex items-center gap-1">
              <MoveRight size={12} /> Move
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold flex items-center gap-1">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1 bg-[var(--bg-surface)] text-[var(--text-muted)] rounded font-bold">
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* QUESTIONS TABLE */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[var(--brand)]" size={24} /></div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)] space-y-2">
            <div>No questions found in <strong>{selectedTopic.name}</strong>.</div>
            <div className="text-xs">Click "Add Question" or "Bulk Import" to add questions here.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold">
                  <th className="p-3 w-8">
                    <input type="checkbox" checked={selectedIds.size === questions.length && questions.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="p-3">Question</th>
                  <th className="p-3 w-24">Type</th>
                  <th className="p-3 w-24">Difficulty</th>
                  <th className="p-3 w-28">Status</th>
                  <th className="p-3 w-52">Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => {
                  const isSelected = selectedIds.has(q.id)
                  const isPending  = q.status !== 'approved' && q.status !== 'rejected'
                  const isApproved = q.status === 'approved'
                  const isRejected = q.status === 'rejected'
                  return (
                    <tr key={q.id} className={`border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition ${isSelected ? 'bg-blue-950/20' : ''}`}>
                      <td className="p-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectRow(q.id)} className="rounded" />
                      </td>
                      <td className="p-3 font-medium text-[var(--text-primary)] max-w-md">
                        <div className="line-clamp-2">{q.question_text}</div>
                        {q.possible_duplicate_of && (
                          <span className="inline-block mt-1 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold px-2 py-0.5 rounded">⚠ Possible Duplicate</span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-[var(--text-secondary)] uppercase font-mono">{q.question_type}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          q.difficulty === 'hard'   ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>{q.difficulty}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isApproved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          isRejected ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {isApproved ? '✓ Verified' : isRejected ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* VERIFY button — always visible, prominent */}
                          {!isApproved && (
                            <button
                              onClick={() => handleStatusChange(q.id, 'approved')}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-0.5"
                              title="Verify & Approve"
                            >
                              <Check size={11} /> Verify
                            </button>
                          )}
                          {isApproved && (
                            <button
                              onClick={() => handleStatusChange(q.id, 'draft')}
                              className="px-2 py-0.5 bg-gray-500 hover:bg-gray-600 text-white rounded text-[10px] font-bold flex items-center gap-0.5"
                              title="Unverify (Move back to Pending)"
                            >
                              <X size={11} /> Unverify
                            </button>
                          )}
                          {!isRejected && (
                            <button
                              onClick={() => handleStatusChange(q.id, 'rejected')}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold flex items-center gap-0.5"
                              title="Reject"
                            >
                              <X size={11} /> Reject
                            </button>
                          )}
                          <button onClick={() => onEditQuestion(q)} className="p-1 text-blue-400 hover:text-blue-300" title="Edit"><Edit2 size={13} /></button>
                          <button onClick={() => setPreviewQuestion(q)} className="p-1 text-gray-400 hover:text-gray-200" title="Preview"><Eye size={13} /></button>
                          <button onClick={() => handleDuplicate(q.id)} className="p-1 text-purple-400 hover:text-purple-300" title="Duplicate"><Copy size={13} /></button>
                          <button onClick={() => setMoveModalQuestion(q)} className="p-1 text-amber-400 hover:text-amber-300" title="Move to Topic"><MoveRight size={13} /></button>
                          <button onClick={() => handleDelete(q.id)} className="p-1 text-red-400 hover:text-red-300" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {questions.length > 0 && (
          <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Showing {(page - 1) * limit + 1}–{(page - 1) * limit + questions.length} questions</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded bg-[var(--bg-card)] border border-[var(--border)] disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span>Page {page}</span>
              <button disabled={questions.length < limit} onClick={() => setPage(p => p + 1)} className="p-1 rounded bg-[var(--bg-card)] border border-[var(--border)] disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewQuestion(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-primary)]">Question Preview</h3>
              <button onClick={() => setPreviewQuestion(null)} className="text-gray-400 hover:text-gray-200">✕</button>
            </div>
            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <div className="font-semibold text-sm">{previewQuestion.question_text}</div>
              {previewQuestion.options?.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {previewQuestion.options.map((opt, oi) => (
                    <div key={oi} className={`p-2 rounded border ${previewQuestion.correct_answer?.indices?.includes(oi) ? 'bg-emerald-950/30 border-emerald-500 font-bold' : 'border-[var(--border)] bg-[var(--bg-surface)]'}`}>
                      {String.fromCharCode(65 + oi)}. {opt}
                    </div>
                  ))}
                </div>
              )}
              {previewQuestion.explanation && (
                <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border)]">
                  <strong>Explanation:</strong> {previewQuestion.explanation}
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-[var(--border)] flex gap-2">
              {previewQuestion.status !== 'approved' && (
                <button onClick={() => { handleStatusChange(previewQuestion.id, 'approved'); setPreviewQuestion(null) }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                  <Check size={13} /> Verify Question
                </button>
              )}
              {previewQuestion.status !== 'rejected' && (
                <button onClick={() => { handleStatusChange(previewQuestion.id, 'rejected'); setPreviewQuestion(null) }}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                  <X size={13} /> Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
