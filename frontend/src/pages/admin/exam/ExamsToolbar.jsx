import React from 'react'
import { Plus, Award, Filter, Search } from 'lucide-react'

export default function ExamsToolbar({
  categories,
  filterCategory,
  filterStatus,
  searchQuery,
  onCategoryChange,
  onStatusChange,
  onSearchChange,
  onAddClick,
  count
}) {
  const formatCount = (n) => {
    if (n === 1) return '1 exam'
    return `${n} exams`
  }

  return (
    <div className="space-y-4">
      {/* Page Header Banner */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Award className="text-orange-500" size={22} />
            <span>Exams</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage competitive exams, syllabus hierarchies, and testing structures.
          </p>
        </div>

        <button
          onClick={onAddClick}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>New Exam</span>
        </button>
      </div>

      {/* Filter & Count Bar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3.5 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        {/* Search & Select Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <input
              type="text"
              placeholder="Search exams by name or slug..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            {(filterCategory !== 'all' || filterStatus !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  onCategoryChange('all')
                  onStatusChange('all')
                  onSearchChange('')
                }}
                className="text-xs text-red-500 hover:underline font-bold px-1 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Count Stat Badge */}
        <div className="self-end sm:self-auto shrink-0">
          <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)] font-bold">
            {formatCount(count)}
          </span>
        </div>
      </div>
    </div>
  )
}
