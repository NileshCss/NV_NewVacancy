import React from 'react'

export default function AdminPageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-xs">
      <div className="space-y-0.5">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
          <span>{title}</span>
        </h1>
        {description && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
