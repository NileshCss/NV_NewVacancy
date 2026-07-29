import React from 'react'
import { Edit2, Trash2, Eye, EyeOff, Folder } from 'lucide-react'

export default function ExamCardMobile({
  exam: ex,
  onEdit,
  onDelete,
  onToggleStatus
}) {
  const isPublished = ex.status === 'published'
  const isDraft     = ex.status === 'draft'

  return (
    <div className="p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl space-y-3 shadow-xs">
      {/* Top Row: Category + Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold truncate">
          <Folder size={13} className="text-orange-500 shrink-0" />
          <span className="truncate">{ex.exam_categories?.name || 'Uncategorized'}</span>
        </div>

        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
          isPublished ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
          isDraft     ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
          'bg-gray-500/10 text-gray-500 border border-gray-500/20'
        }`}>
          {ex.status}
        </span>
      </div>

      {/* Name and Slug */}
      <div className="space-y-0.5">
        <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight">{ex.name}</h4>
        <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">slug: {ex.slug}</div>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] gap-2">
        {/* Toggle Publish / Unpublish */}
        <button
          onClick={() => onToggleStatus(ex)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 ${
            isPublished
              ? 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)]'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>{isPublished ? 'Unpublish' : 'Publish'}</span>
        </button>

        {/* Edit and Delete */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(ex)}
            className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-blue-500 font-semibold transition text-xs flex items-center gap-1"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            onClick={() => onDelete(ex.id)}
            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-semibold transition text-xs flex items-center gap-1"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}
