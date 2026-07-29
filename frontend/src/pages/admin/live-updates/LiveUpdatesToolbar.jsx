import React from 'react'
import { Plus, Radio, Filter } from 'lucide-react'

export default function LiveUpdatesToolbar({
  filterType,
  filterStatus,
  onFilterTypeChange,
  onFilterStatusChange,
  onAddClick,
  count
}) {
  const formatCount = (n) => {
    if (n === 1) return '1 update'
    return `${n} updates`
  }

  return (
    <div className="space-y-4">
      {/* Top Bar: Title & Primary CTA */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Radio className="text-orange-500" size={22} />
            <span>Live Updates</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage real-time notifications, job alerts, exam deadlines, and ticker announcements.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Add Update</span>
        </button>
      </div>

      {/* Filter & Count Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3.5 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-semibold">
            <Filter size={14} />
            <span>Filters:</span>
          </div>

          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Types</option>
            <option value="job">🧾 Job</option>
            <option value="exam">🎓 Exam</option>
            <option value="deadline">⏰ Deadline</option>
            <option value="news">📰 News</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(filterType !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => {
                onFilterTypeChange('all')
                onFilterStatusChange('all')
              }}
              className="text-xs text-red-500 hover:underline font-bold px-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Count Stat Badge */}
        <div className="self-end sm:self-auto">
          <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)] font-bold">
            {formatCount(count)}
          </span>
        </div>
      </div>
    </div>
  )
}
