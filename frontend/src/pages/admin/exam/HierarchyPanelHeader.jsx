import React from 'react'
import { Layers, Maximize2, Minimize2 } from 'lucide-react'

export default function HierarchyPanelHeader({ onExpandAll, onCollapseAll }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {/* Title */}
      <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-primary)] min-w-0">
        <Layers size={16} className="text-orange-500 shrink-0" />
        <span className="truncate">Syllabus Hierarchy</span>
      </div>

      {/* Grouped Action Buttons */}
      <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] p-0.5 rounded-xl shrink-0">
        <button
          onClick={onExpandAll}
          title="Expand All Nodes"
          aria-label="Expand All Nodes"
          className="p-1.5 hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-orange-500 rounded-lg transition cursor-pointer"
        >
          <Maximize2 size={13} />
        </button>
        <div className="w-px h-3 bg-[var(--border)]" />
        <button
          onClick={onCollapseAll}
          title="Collapse All Nodes"
          aria-label="Collapse All Nodes"
          className="p-1.5 hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-orange-500 rounded-lg transition cursor-pointer"
        >
          <Minimize2 size={13} />
        </button>
      </div>
    </div>
  )
}
