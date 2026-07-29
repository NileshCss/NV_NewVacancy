import React from 'react'

export default function HierarchySkeleton() {
  return (
    <div className="p-3 space-y-3 animate-pulse">
      {/* Exam Skeleton Node */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[var(--bg-surface)]">
          <div className="w-3.5 h-3.5 rounded bg-[var(--border)]" />
          <div className="w-4 h-4 rounded bg-[var(--border)]" />
          <div className="h-3.5 bg-[var(--border)] rounded w-3/4" />
        </div>
        {/* Child Subject Skeletons */}
        <div className="pl-4 space-y-2 border-l border-[var(--border)] ml-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)]/60">
            <div className="w-3 h-3 rounded bg-[var(--border)]" />
            <div className="w-3.5 h-3.5 rounded bg-[var(--border)]" />
            <div className="h-3 bg-[var(--border)] rounded w-2/3" />
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)]/60">
            <div className="w-3 h-3 rounded bg-[var(--border)]" />
            <div className="w-3.5 h-3.5 rounded bg-[var(--border)]" />
            <div className="h-3 bg-[var(--border)] rounded w-1/2" />
          </div>
        </div>
      </div>

      {/* Second Exam Skeleton Node */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[var(--bg-surface)]">
          <div className="w-3.5 h-3.5 rounded bg-[var(--border)]" />
          <div className="w-4 h-4 rounded bg-[var(--border)]" />
          <div className="h-3.5 bg-[var(--border)] rounded w-4/5" />
        </div>
      </div>
    </div>
  )
}
