import React from 'react'
import { Plus, FileSpreadsheet, Sparkles, ShieldCheck, Trash2, CheckCircle2, Clock, XCircle, AlertTriangle, Download, Printer, Search } from 'lucide-react'

export default function QuestionBankToolbar({
  selectedTopic,
  scopeType,
  breadcrumbSegments,
  getScopeLabel,
  stats,
  filters,
  onFiltersChange,
  onAddQuestion,
  onBulkImport,
  onAiExtract,
  onVerifyAllPending,
  onDeleteAllDuplicates,
  onExportCsv,
  verifyingAll,
  deletingDuplicates,
  filteredCount
}) {
  return (
    <div className="space-y-4 min-w-0">
      {/* HEADER CARD */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="min-w-0 flex-1">
            {/* Clean Non-Duplicating Breadcrumb */}
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
                scopeType === 'subject' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' :
                scopeType === 'chapter' ? 'bg-purple-500/10 border-purple-500/30 text-purple-500' :
                scopeType === 'exam' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              }`}>{scopeType}</span>
            </h2>
          </div>

          {/* Action Buttons — Orange CTA for Add Question */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {stats.duplicates > 0 && (
              <button
                onClick={onDeleteAllDuplicates}
                disabled={deletingDuplicates}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Delete all duplicate questions with one click"
              >
                {deletingDuplicates ? <span className="animate-spin">⏳</span> : <Trash2 size={15} />}
                Delete Duplicates ({stats.duplicates})
              </button>
            )}

            {stats.pending > 0 && (
              <button
                onClick={onVerifyAllPending}
                disabled={verifyingAll}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {verifyingAll ? <span className="animate-spin">⏳</span> : <ShieldCheck size={15} />}
                Verify All Pending ({stats.pending})
              </button>
            )}
            <button onClick={() => onAddQuestion(selectedTopic)} className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer">
              <Plus size={15} /> Add Question
            </button>
            <button onClick={() => onBulkImport(selectedTopic)} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer">
              <FileSpreadsheet size={15} /> Bulk Import
            </button>
            <button onClick={() => onAiExtract(selectedTopic)} className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer">
              <Sparkles size={15} /> AI Extract
            </button>
          </div>
        </div>

        {/* Stats Cards Row */}
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
              <span className="bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 px-3 py-1 rounded-full font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition"
                onClick={() => onFiltersChange({ ...filters, status: 'duplicates' })} title="Click to filter duplicate questions">
                <AlertTriangle size={13} /> Duplicates: <strong>{stats.duplicates}</strong>
              </span>
            )}
          </div>

          {/* Secondary Actions: Export & Print */}
          <div className="flex items-center gap-2">
            <button onClick={onExportCsv} className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold transition flex items-center gap-1 border border-[var(--border)] cursor-pointer">
              <Download size={13} /> Export CSV
            </button>
            <button onClick={() => window.print()} className="px-2.5 py-1 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold transition flex items-center gap-1 border border-[var(--border)] cursor-pointer">
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS TOOLBAR */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3.5 rounded-2xl flex flex-wrap gap-3 items-center justify-between shadow-xs">
        <div className="flex-1 min-w-[220px] relative">
          <input
            type="text"
            placeholder={`Search ${filteredCount} questions in ${selectedTopic.name}...`}
            value={filters.search}
            onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={filters.difficulty} onChange={e => onFiltersChange({ ...filters, difficulty: e.target.value })}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium">
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select value={filters.status} onChange={e => onFiltersChange({ ...filters, status: e.target.value })}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium">
            <option value="">All Statuses</option>
            <option value="approved">Verified</option>
            <option value="draft">Pending</option>
            <option value="rejected">Rejected</option>
            {stats.duplicates > 0 && <option value="duplicates">⚠️ Duplicates Only ({stats.duplicates})</option>}
          </select>

          {(filters.search || filters.difficulty || filters.status) && (
            <button onClick={() => onFiltersChange({ search: '', difficulty: '', status: '' })} className="px-2.5 py-1.5 text-xs text-red-500 hover:underline font-bold cursor-pointer">
              Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
