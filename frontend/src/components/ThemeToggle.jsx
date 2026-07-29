import React from 'react'
import { useTheme } from '../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5 text-xs font-semibold"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <>
          <Sun size={15} className="text-amber-400" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon size={15} className="text-indigo-400" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  )
}
