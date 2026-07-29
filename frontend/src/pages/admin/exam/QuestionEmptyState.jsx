import React from 'react'
import { FileText, Layers, List } from 'lucide-react'

export default function QuestionEmptyState({ onBrowseClick, onViewAllClick }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-10 sm:p-14 text-center h-full flex flex-col items-center justify-center space-y-4 shadow-xs">
      <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] text-orange-500 shadow-xs">
        <FileText size={38} />
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">No topic selected</h3>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          Choose a subject, chapter, or topic from the hierarchy panel on the left to view and manage questions.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
        {onBrowseClick && (
          <button
            onClick={onBrowseClick}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Layers size={15} />
            <span>Browse hierarchy</span>
          </button>
        )}

        {onViewAllClick && (
          <button
            onClick={onViewAllClick}
            className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <List size={15} />
            <span>View all questions</span>
          </button>
        )}
      </div>
    </div>
  )
}
