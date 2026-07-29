import React from 'react'
import { Plus } from 'lucide-react'

export default function EmptyStateCard({
  icon: Icon,
  title = 'No items found',
  description = 'Get started by creating a new item.',
  actionLabel,
  onAction
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-10 sm:p-14 text-center flex flex-col items-center justify-center space-y-4 shadow-xs my-2">
      {Icon && (
        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] text-orange-500 shadow-xs">
          <Icon size={36} />
        </div>
      )}
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus size={15} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  )
}
