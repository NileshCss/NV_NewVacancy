import React, { useState, useEffect, useMemo, useRef } from 'react'
import { fetchQuestions, updateQuestionStatus, deleteQuestion, duplicateQuestion, moveQuestion, bulkMoveQuestions, fetchQuestion } from '../../../services/api'
import {
  Edit2, Trash2, Plus, Loader2, Sparkles, Check, X, FileSpreadsheet,
  Search, Copy, Eye, MoveRight, Download, Printer,
  ChevronLeft, ChevronRight, FileText, CheckCircle2, Clock, XCircle, ShieldCheck, AlertTriangle, MoreVertical
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
  const [deletingDuplicates, setDeletingDuplicates] = useState(false)

  // Pagination & Page Size
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15) // 15 per page matching mockup design

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Dropdown Row Actions state: stores id of question with active dropdown
  const [activeDropdownId, setActiveDropdownId] = useState(null)
  const dropdownRef = useRef(null)

  // Modals
  const [moveModalQuestion, setMoveModalQuestion] = useState(null)
  const [previewQuestion, setPreviewQuestion] = useState(null)
  const [duplicateComparisonModal, setDuplicateComparisonModal] = useState(null) // { question, matchQuestion }

  // Filters
  const [filters, setFilters] = useState({ search: '', difficulty: '', status: '' })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
    setActiveDropdownId(null)
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

  // Load ALL questions for the selected scope
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

  // Accurate Duplicate Detection Algorithm:
  // Only flags questions that have `possible_duplicate_of` OR exact matching question_text
  const { duplicateQuestions, duplicateMap, duplicateSet } = useMemo(() => {
    const textToFirstQuestion = new Map()
    const duplicates = []
    const dupMap = new Map() // qId -> matchingOriginalQuestion
    const dupSet = new Set()

    // 1st pass: record 1st occurrence of each question_text
    allQuestions.forEach(q => {
      const key = (q.question_text || '').trim().toLowerCase()
      if (key && !textToFirstQuestion.has(key)) {
        textToFirstQuestion.set(key, q)
      }
    })

    // 2nd pass: identify true duplicates
    allQuestions.forEach(q => {
      const key = (q.question_text || '').trim().toLowerCase()
      const first = textToFirstQuestion.get(key)

      if (q.possible_duplicate_of) {
        duplicates.push(q)
        dupSet.add(q.id)
        const matchObj = allQuestions.find(item => item.id === q.possible_duplicate_of)
        dupMap.set(q.id, matchObj || first || null)
      } else if (first && first.id !== q.id) {
        // Repeated text (and not the first original)
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

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredQuestions.length / pageSize) || 1

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

  // Verify All Pending
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

  // One-Click Delete All Duplicates
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

  const handleExportCsv = (customQuestions = null) => {
    const listToExport = customQuestions || (selectedIds.size > 0 ? allQuestions.filter(q => selectedIds.has(q.id)) : allQuestions)
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
      {/* HEADER CARD */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="min-w-0 flex-1">
            {/* Clean Non-Duplicating Breadcrumb (Point 1 Fix) */}
            <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-1.5 font-medium">
              {breadcrumbSegments.map((seg, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span>›</span>}
                  <span className={idx === breadcrumbSegments.length - 1 ? 'font-bold text-[var(--text-primary)]' : ''}>{seg}</span>
                </React.Fragment>
              ))}
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

          {/* Action Buttons — Orange CTA only for primary Add Question (Point 4) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {stats.duplicates > 0 && (
              <button
                onClick={handleDeleteAllDuplicates}
                disabled={deletingDuplicates}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                title="Delete all duplicate questions with one click"
              >
                {deletingDuplicates ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={15} />}
                Delete All Duplicates ({stats.duplicates})
              </button>
            )}

            {stats.pending > 0 && (
              <button
                onClick={handleVerifyAllPending}
                disabled={verifyingAll}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {verifyingAll ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={15} />}
                Verify All Pending ({stats.pending})
              </button>
            )}
            <button onClick={() => onAddQuestion(selectedTopic)} className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
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
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <CheckCircle2 size={13} /> Verified: <strong>{stats.approved}</strong>
            </span>
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <Clock size={13} /> Pending: <strong>{stats.pending}</strong>
            </span>
            <span className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <XCircle size={13} /> Rejected: <strong>{stats.rejected}</strong>
            </span>
            {stats.duplicates > 0 && (
              <span className="bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition"
                onClick={() => setFilters(f => ({ ...f, status: 'duplicates' }))} title="Click to filter duplicate questions">
                <AlertTriangle size={13} /> Duplicates: <strong>{stats.duplicates}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => handleExportCsv()} className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold transition flex items-center gap-1 border border-[var(--border)]">
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
            {stats.duplicates > 0 && <option value="duplicates">⚠️ Duplicates Only ({stats.duplicates})</option>}
          </select>

          {(filters.search || filters.difficulty || filters.status) && (
            <button onClick={() => setFilters({ search: '', difficulty: '', status: '' })} className="px-2.5 py-1.5 text-xs text-red-500 hover:underline font-bold">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* BULK ACTIONS BAR (Point 9 Fix) */}
      {selectedIds.size > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-primary)] shadow-md">
          <span className="font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
            {selectedIds.size} question{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleBulkApprove} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-sm">
              <Check size={13} /> Bulk Verify
            </button>
            <button onClick={handleBulkReject} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-sm">
              <X size={13} /> Bulk Reject
            </button>
            <button onClick={() => setMoveModalQuestion('bulk')} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-sm">
              <MoveRight size={13} /> Move Selected
            </button>
            <button onClick={() => handleExportCsv()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-sm">
              <Download size={13} /> Export Selected
            </button>
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-sm">
              <Trash2 size={13} /> Bulk Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-semibold transition">
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* QUESTIONS TABLE */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm relative">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[var(--brand)]" size={28} />
            <span className="text-xs text-[var(--text-muted)] font-medium">Loading questions...</span>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-14 text-center text-[var(--text-muted)] space-y-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">No questions found matching criteria</div>
            <div className="text-xs">Try clearing search filters or add new questions to <strong>{selectedTopic.name}</strong>.</div>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5 w-10 text-center">
                    <input type="checkbox" checked={selectedIds.size === paginatedQuestions.length && paginatedQuestions.length > 0} onChange={toggleSelectAll} className="rounded cursor-pointer" />
                  </th>
                  <th className="p-3.5">Question Text</th>
                  <th className="p-3.5 w-20 text-center">Type</th>
                  <th className="p-3.5 w-24 text-center">Difficulty</th>
                  <th className="p-3.5 w-28 text-center">Status</th>
                  <th className="p-3.5 w-60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginatedQuestions.map(q => {
                  const isSelected = selectedIds.has(q.id)
                  const isApproved = q.status === 'approved'
                  const isRejected = q.status === 'rejected'
                  const isDup      = duplicateSet.has(q.id)

                  return (
                    <tr key={q.id} className={`hover:bg-[var(--bg-surface)]/60 transition h-16 ${isSelected ? 'bg-blue-500/5' : ''}`}>
                      <td className="p-3.5 text-center align-middle">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectRow(q.id)} className="rounded cursor-pointer" />
                      </td>

                      {/* Normalized Row Height with line-clamp-2 (Point 6 Fix) */}
                      <td className="p-3.5 align-middle font-medium text-[var(--text-primary)] max-w-lg">
                        <div className="line-clamp-2 leading-snug" title={q.question_text}>{q.question_text}</div>
                        {isDup && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold px-2 py-0.5 rounded">
                              <AlertTriangle size={11} /> Possible duplicate
                            </span>
                            <button
                              onClick={() => openDuplicateViewModal(q)}
                              className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition shadow-xs"
                            >
                              View
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-center align-middle text-[11px] text-[var(--text-secondary)] uppercase font-mono tracking-wide">
                        {q.question_type || 'MCQ'}
                      </td>

                      <td className="p-3.5 text-center align-middle">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          q.difficulty === 'hard'   ? 'text-red-600 dark:text-red-400 font-extrabold' :
                          q.difficulty === 'medium' ? 'text-amber-700 dark:text-amber-400 font-bold' :
                          'text-emerald-600 dark:text-emerald-400 font-bold'
                        }`}>{q.difficulty || 'medium'}</span>
                      </td>

                      <td className="p-3.5 text-center align-middle">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isApproved ? 'text-emerald-600 dark:text-emerald-400' :
                          isRejected ? 'text-red-600 dark:text-red-400' :
                          'text-amber-600 dark:text-amber-400'
                        }`}>
                          {isApproved ? '✓ Verified' : isRejected ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </td>

                      {/* Consolidate Actions Menu (Point 3 & Provided Mockup Fix) */}
                      <td className="p-3.5 text-right align-middle">
                        <div className="flex items-center justify-end gap-2.5 relative">
                          {/* 1. Inline Toggle Button: Unverify / Verify */}
                          {isApproved ? (
                            <button
                              onClick={() => handleStatusChange(q.id, 'draft')}
                              className="px-3 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition shadow-xs"
                              title="Unverify (Revert to Pending)"
                            >
                              Unverify
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(q.id, 'approved')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                              title="Verify & Approve"
                            >
                              Verify
                            </button>
                          )}

                          {/* 2. Inline Button: Reject */}
                          <button
                            onClick={() => handleStatusChange(q.id, 'rejected')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition shadow-xs ${
                              isRejected
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-[var(--bg-card)] hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40'
                            }`}
                            title="Reject Question"
                          >
                            Reject
                          </button>

                          {/* 3. Overflow Dropdown ⋮ Button */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveDropdownId(activeDropdownId === q.id ? null : q.id)
                              }}
                              className="p-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg transition"
                              title="More options"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {/* Dropdown Menu Overlay */}
                            {activeDropdownId === q.id && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-0 top-full mt-1.5 w-36 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 py-1 text-xs text-[var(--text-primary)]"
                              >
                                <button
                                  onClick={() => { setActiveDropdownId(null); onEditQuestion(q) }}
                                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium"
                                >
                                  <Edit2 size={13} className="text-blue-500" /> Edit
                                </button>
                                <button
                                  onClick={() => { setActiveDropdownId(null); setPreviewQuestion(q) }}
                                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium"
                                >
                                  <Eye size={13} className="text-gray-400" /> Preview
                                </button>
                                <button
                                  onClick={() => { setActiveDropdownId(null); handleDuplicate(q.id) }}
                                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium"
                                >
                                  <Copy size={13} className="text-purple-500" /> Duplicate
                                </button>
                                <button
                                  onClick={() => { setActiveDropdownId(null); setMoveModalQuestion(q) }}
                                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium"
                                >
                                  <MoveRight size={13} className="text-amber-500" /> Move to
                                </button>
                                <div className="my-1 border-t border-[var(--border)]"></div>
                                <button
                                  onClick={() => { setActiveDropdownId(null); handleDelete(q.id) }}
                                  className="w-full px-3 py-2 text-left hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-bold"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER (Point 5 & Provided Mockup Fix) */}
        {filteredQuestions.length > 0 && (
          <div className="p-3.5 border-t border-[var(--border)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] font-medium">
            {/* Left: Showing Count */}
            <div>
              Showing {pageSize === 'all' ? `1-${filteredQuestions.length}` : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredQuestions.length)}`} of {filteredQuestions.length}
            </div>

            {/* Right: Page Navigation Controls */}
            <div className="flex items-center gap-3">
              {/* Page Size Dropdown */}
              <div className="flex items-center gap-1.5">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value)
                    setPageSize(val)
                    setPage(1)
                  }}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] font-semibold"
                >
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value="all">All ({filteredQuestions.length})</option>
                </select>
              </div>

              {/* Number Buttons Pagination */}
              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--border)] disabled:opacity-30 transition font-bold"
                  >
                    ‹
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                    let pageNum = idx + 1
                    if (totalPages > 5 && page > 3) {
                      pageNum = page - 2 + idx
                      if (pageNum > totalPages) pageNum = totalPages - (4 - idx)
                    }
                    if (pageNum <= 0) return null
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs transition ${
                          page === pageNum
                            ? 'bg-[var(--bg-card)] border-2 border-[var(--text-primary)] text-[var(--text-primary)] shadow-xs'
                            : 'bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}

                  {totalPages > 5 && page < totalPages - 2 && <span className="px-1 text-[var(--text-muted)]">...</span>}
                  {totalPages > 5 && page < totalPages - 2 && (
                    <button
                      onClick={() => setPage(totalPages)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] font-bold text-xs transition"
                    >
                      {totalPages}
                    </button>
                  )}

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--border)] disabled:opacity-30 transition font-bold"
                  >
                    ›
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

      {/* DUPLICATE COMPARISON MODAL */}
      {duplicateComparisonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDuplicateComparisonModal(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={18} />
                <span>Duplicate Question Comparison</span>
              </h3>
              <button onClick={() => setDuplicateComparisonModal(null)} className="text-gray-400 hover:text-gray-200 font-bold">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Question 1 (Selected Duplicate) */}
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                <div className="font-bold text-red-400 uppercase text-[10px]">Current Question (Flagged Duplicate)</div>
                <div className="font-semibold text-sm text-[var(--text-primary)]">{duplicateComparisonModal.question.question_text}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Type: {duplicateComparisonModal.question.question_type} | Difficulty: {duplicateComparisonModal.question.difficulty}</div>
              </div>

              {/* Question 2 (Original Match if found) */}
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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Delete Duplicate Copy
              </button>
              <button
                onClick={() => setDuplicateComparisonModal(null)}
                className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold"
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
