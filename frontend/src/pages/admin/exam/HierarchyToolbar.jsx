import React from 'react'
import { Layers, Maximize2, Minimize2, Search, X } from 'lucide-react'

export default function HierarchyToolbar({
  search,
  onSearchChange,
  onExpandAll,
  onCollapseAll
}) {
  return (
    <div className="sticky top-0 z-10 p-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] space-y-3">
      {/* Title & Button Controls Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[var(--text-primary)] min-w-0">
          <Layers size={16} className="text-orange-500 shrink-0" />
          <span className="truncate">Syllabus Hierarchy</span>
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] p-0.5 rounded-xl shrink-0">
          <button
            onClick={onExpandAll}
            title="Expand all tree nodes"
            aria-label="Expand all"
            className="px-2 py-1 hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-orange-500 rounded-lg transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Maximize2 size={12} />
            <span className="hidden sm:inline">Expand all</span>
          </button>
          <div className="w-px h-3 bg-[var(--border)]" />
          <button
            onClick={onCollapseAll}
            title="Collapse all tree nodes"
            aria-label="Collapse all"
            className="px-2 py-1 hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-orange-500 rounded-lg transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Minimize2 size={12} />
            <span className="hidden sm:inline">Collapse all</span>
          </button>
        </div>
      </div>

      {/* Full Width Anchored Search Row */}
      <div className="relative w-full">
        <input
          type="text"
          placeholder="Filter exams, subjects, topics..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500 transition"
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
