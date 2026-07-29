import React from 'react'
import { Search, X } from 'lucide-react'

export default function HierarchySearch({ value, onChange }) {
  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder="Search subjects, chapters, topics..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500 transition"
      />
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
