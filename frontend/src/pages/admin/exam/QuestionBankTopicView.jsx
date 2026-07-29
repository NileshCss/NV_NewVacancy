import React, { useState, useEffect, useMemo } from 'react'
import { fetchQuestions, updateQuestionStatus, deleteQuestion, duplicateQuestion, moveQuestion, bulkMoveQuestions } from '../../../services/api'
import {
  Edit2, Trash2, Plus, Loader2, Sparkles, Check, X, FileSpreadsheet,
  Search, Copy, Eye, MoveRight, Download, Printer,
  ChevronLeft, ChevronRight, FileText, CheckCircle2, Clock, XCircle, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
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

  // Pagination & Page Size
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(500) // Default to 500 so all questions show at once

  // Selection
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

  // Load ALL questions for the selected scope to get exact stats & enable fast client filtering/pagination
  const loadQuestions = async () => {
    if (!selectedTopic) return
    setLoading(true)
    try {
      const scopeParams = getScopeParams(selectedTopic)
      const queryParams = {
        ...scopeParams,
        limit: 1000, // Fetch up to 1000 questions in scope for complete list
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

  // Overall Scope Statistics (calculated over ALL questions in scope)
  const stats = useMemo(() => {
    const total = allQuestions.length
    const approved = allQuestions.filter(q => q.status === 'approved').length
    const rejected = allQuestions.filter(q => q.status === 'rejected').length
    const pending  = allQuestions.filter(q => q.status !== 'approved' && q.status !== 'rejected').length
    return { total, approved, pending, rejected }
  }, [allQuestions])

  // Filtered Questions (after difficulty, status, search filtering)
  const filteredQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      if (filters.difficulty && q.difficulty !== filters.difficulty) return false
      if (filters.status && q.status !== filters.status) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const textMatch = q.question_text?.toLowerCase().includes(s)
        const typeMatch = q.question_type?.toLowerCase().includes(s)
        if (!textMatch && !typeMatch) return false
      }
      return true
    })
  }, [allQuestions, filters])

  // Paginated View Slice
  const paginatedQuestions = useMemo(() => {
    if (pageSize === 'all' || pageSize >= 500) return filteredQuestions
    const start = (page - 1) * pageSize
    return filteredQuestions.slice(start, start + pageSize)
  }, [filteredQuestions, page, pageSize])

  const totalPages = pageSize === 'all' || pageSize >= 500 ? 1 : Math.ceil(filteredQuestions.length / pageSize) || 1

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

  // Verify All Pending (Header One-Click)
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
    if (!allQuestions.length) return toast.error('No questions to export')
    const headers = ['id', 'question_text', 'question_type', 'difficulty', 'status', 'marks', 'negative_marks']
    const rows = allQuestions.map(q => [
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
    <div className="space-y-4 min-w-0">
      {/* HEADER CARD */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="min-w-0 flex-1">
            {/* Breadcrumb */}
            <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-1.5 font-medium">
              {selectedTopic.examName  && <><span>{selectedTopic.examName}</span><span>›</span></>}
              {selectedTopic.subjectName && <><span>{selectedTopic.subjectName}</span><span>›</span></>}
              {selectedTopic.chapterName && <><span>{selectedTopic.chapterName}</span><span>›</span></>}
              <span className="font-semibold text-[var(--text-secondary)]">{selectedTopic.name}</span>
            </div>

            {/* Level badge + Title */}
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] mt-1 flex flex-wrap items-center gap-2.5">
              <span>{scopeType === 'subject' ? '📚' : scopeType === 'chapter' ? '📖' : scopeType === 'exam' ? '🏆' : '📄'} {getScopeLabel(selectedTopic)}</span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide border ${
                scopeType === 'subject' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                scopeType === 'chapter' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                scopeType === 'exam' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>{scopeType}</span>
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {stats.pending > 0 && (
              <button
                onClick={handleVerifyAllPending}
                disabled={verifyingAll}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {verifyingAll ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={15} />}
                Verify All Pending ({stats.pending})
              </button>
            )}
            <button onClick={() => onAddQuestion(selectedTopic)} className="px-3.5 py-1.5 bg-[var(--brand)] hover:bg-[var(--brand-d)] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              <Plus size={15} /> Add Question
            </button>
            <button onClick={() => onBulkImport(selectedTopic)} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              <FileSpreadsheet size={15} /> Bulk Import
            </button>
            <button onClick={() => onAiExtract(selectedTopic)} className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              <Sparkles size={15} /> AI Extract
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border)] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-1 rounded-full text-[var(--text-secondary)] font-semibold">
              Total Questions: <strong className="text-[var(--text-primary)]">{stats.total}</strong>
            </span>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <CheckCircle2 size={13} /> Verified: <strong>{stats.approved}</strong>
            </span>
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <Clock size={13} /> Pending: <strong>{stats.pending}</strong>
            </span>
            <span className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <XCircle size={13} /> Rejected: <strong>{stats.rejected}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleExportCsv} className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold transition flex items-center gap-1 border border-[var(--border)]">
              <Download size={13} /> Export CSV
            </button>
            <button onClick={() => window.print()} className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold transition flex items-center gap-1 border border-[var(--border)]">
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3.5 rounded-xl flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div className="flex-1 min-w-[220px] relative">
          <input
            type="text"
            placeholder={`Search ${filteredQuestions.length} questions in ${selectedTopic.name}...`}
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)]"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={filters.difficulty} onChange={e => setFilters({ ...filters, difficulty: e.target.value })}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium">
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium">
            <option value="">All Statuses</option>
            <option value="approved">Verified</option>
            <option value="draft">Pending</option>
            <option value="rejected">Rejected</option>
          </select>

          {(filters.search || filters.difficulty || filters.status) && (
            <button onClick={() => setFilters({ search: '', difficulty: '', status: '' })} className="px-2.5 py-1.5 text-xs text-red-400 hover:underline font-bold">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-950/40 border border-blue-800/60 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-blue-200 shadow-sm">
          <span className="font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            {selectedIds.size} Question{selectedIds.size !== 1 ? 's' : ''} Selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleBulkApprove} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition">
              <Check size={13} /> Verify Selected
            </button>
            <button onClick={handleBulkReject} className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1 transition">
              <X size={13} /> Reject Selected
            </button>
            <button onClick={() => setMoveModalQuestion('bulk')} className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-1 transition">
              <MoveRight size={13} /> Move
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1 transition">
              <Trash2 size={13} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-semibold">
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* QUESTIONS TABLE */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[var(--brand)]" size={28} />
            <span className="text-xs text-[var(--text-muted)] font-medium">Loading questions for {selectedTopic.name}...</span>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-14 text-center text-[var(--text-muted)] space-y-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">No questions found matching criteria</div>
            <div className="text-xs">Try clearing search filters or add new questions to <strong>{selectedTopic.name}</strong>.</div>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs min-w-[760px]">
              <thead>
                <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-10 text-center">
                    <input type="checkbox" checked={selectedIds.size === paginatedQuestions.length && paginatedQuestions.length > 0} onChange={toggleSelectAll} className="rounded cursor-pointer" />
                  </th>
                  <th className="p-3">Question Text</th>
                  <th className="p-3 w-28 text-center">Type</th>
                  <th className="p-3 w-24 text-center">Difficulty</th>
                  <th className="p-3 w-28 text-center">Status</th>
                  <th className="p-3 w-48 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginatedQuestions.map(q => {
                  const isSelected = selectedIds.has(q.id)
                  const isApproved = q.status === 'approved'
                  const isRejected = q.status === 'rejected'

                  return (
                    <tr key={q.id} className={`hover:bg-[var(--bg-surface)]/60 transition ${isSelected ? 'bg-blue-950/20' : ''}`}>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectRow(q.id)} className="rounded cursor-pointer" />
                      </td>

                      <td className="p-3 font-medium text-[var(--text-primary)] max-w-lg">
                        <div className="line-clamp-2 leading-relaxed">{q.question_text}</div>
                        {q.possible_duplicate_of && (
                          <span className="inline-block mt-1 text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-2 py-0.5 rounded">⚠ Possible Duplicate</span>
                        )}
                      </td>

                      <td className="p-3 text-center text-[10px] text-[var(--text-secondary)] uppercase font-mono tracking-wide">
                        {q.question_type || 'MCQ'}
                      </td>

                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          q.difficulty === 'hard'   ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                          q.difficulty === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>{q.difficulty || 'medium'}</span>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          isApproved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                          isRejected ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                          'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                          {isApproved ? '✓ Verified' : isRejected ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* VERIFY / UNVERIFY Button */}
                          {!isApproved ? (
                            <button
                              onClick={() => handleStatusChange(q.id, 'approved')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition shadow-sm"
                              title="Verify & Approve Question"
                            >
                              <Check size={12} /> Verify
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(q.id, 'draft')}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition"
                              title="Revert to Pending"
                            >
                              <X size={12} /> Unverify
                            </button>
                          )}

                          {/* REJECT Button */}
                          {!isRejected && (
                            <button
                              onClick={() => handleStatusChange(q.id, 'rejected')}
                              className="px-2 py-1 bg-red-600/20 hover:bg-red-600 hover:text-white border border-red-500/30 text-red-400 rounded text-[11px] font-bold flex items-center gap-1 transition"
                              title="Reject Question"
                            >
                              <X size={12} /> Reject
                            </button>
                          )}

                          {/* Quick Icon Tools */}
                          <button onClick={() => onEditQuestion(q)} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded transition" title="Edit Question"><Edit2 size={13} /></button>
                          <button onClick={() => setPreviewQuestion(q)} className="p-1.5 text-gray-400 hover:bg-gray-500/10 rounded transition" title="Preview"><Eye size={13} /></button>
                          <button onClick={() => handleDuplicate(q.id)} className="p-1.5 text-purple-400 hover:bg-purple-500/10 rounded transition" title="Duplicate"><Copy size={13} /></button>
                          <button onClick={() => setMoveModalQuestion(q)} className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded transition" title="Move Topic"><MoveRight size={13} /></button>
                          <button onClick={() => handleDelete(q.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        {filteredQuestions.length > 0 && (
          <div className="p-3.5 border-t border-[var(--border)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] font-medium">
            <div>
              Showing {pageSize === 'all' || pageSize >= 500 ? `all ${filteredQuestions.length}` : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredQuestions.length)} of ${filteredQuestions.length}`} questions
            </div>

            <div className="flex items-center gap-4">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    const val = e.target.value === 'all' ? 500 : parseInt(e.target.value)
                    setPageSize(val)
                    setPage(1)
                  }}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-semibold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>All ({filteredQuestions.length})</option>
                </select>
              </div>

              {/* Page Controls */}
              {pageSize !== 'all' && pageSize < 500 && (
                <div className="flex items-center gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded bg-[var(--bg-card)] border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--border)] transition">
                    <ChevronLeft size={14} />
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded bg-[var(--bg-card)] border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--border)] transition">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
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
              <button onClick={() => setPreviewQuestion(null)} className="text-gray-400 hover:text-gray-200 text-sm font-bold">✕</button>
            </div>
            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <div className="font-semibold text-sm leading-relaxed">{previewQuestion.question_text}</div>
              {previewQuestion.options?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {previewQuestion.options.map((opt, oi) => (
                    <div key={oi} className={`p-2.5 rounded-lg border text-xs ${previewQuestion.correct_answer?.indices?.includes(oi) ? 'bg-emerald-950/40 border-emerald-500/60 font-bold text-emerald-300' : 'border-[var(--border)] bg-[var(--bg-surface)]'}`}>
                      {String.fromCharCode(65 + oi)}. {opt}
                    </div>
                  ))}
                </div>
              )}
              {previewQuestion.explanation && (
                <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border)] leading-relaxed">
                  <strong>Explanation:</strong> {previewQuestion.explanation}
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-[var(--border)] flex gap-2 justify-end">
              {previewQuestion.status !== 'approved' && (
                <button onClick={() => { handleStatusChange(previewQuestion.id, 'approved'); setPreviewQuestion(null) }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition">
                  <Check size={14} /> Verify Question
                </button>
              )}
              {previewQuestion.status !== 'rejected' && (
                <button onClick={() => { handleStatusChange(previewQuestion.id, 'rejected'); setPreviewQuestion(null) }}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition">
                  <X size={14} /> Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
