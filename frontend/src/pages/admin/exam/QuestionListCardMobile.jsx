import React, { useState, useRef, useEffect } from 'react'
import { Check, X, MoreVertical, Edit2, Eye, Copy, MoveRight, Trash2, AlertTriangle } from 'lucide-react'

export default function QuestionListCardMobile({
  question: q,
  isSelected,
  onToggleSelect,
  onStatusChange,
  onEdit,
  onPreview,
  onDuplicate,
  onMove,
  onDelete,
  isDuplicate,
  onOpenDuplicateComparison
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isApproved = q.status === 'approved'
  const isRejected = q.status === 'rejected'

  return (
    <div className={`p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl space-y-3 transition shadow-xs ${isSelected ? 'border-orange-500/40 bg-orange-500/5' : ''}`}>
      {/* Top Header: Checkbox + Badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(q.id)}
            className="rounded w-4 h-4 cursor-pointer"
          />
          <span className="text-[10px] font-mono uppercase text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border)] font-bold">
            {q.question_type || 'MCQ'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
            q.difficulty === 'hard'   ? 'bg-red-500/10 border-red-500/30 text-red-500' :
            q.difficulty === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' :
            'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
          }`}>
            {q.difficulty || 'medium'}
          </span>
        </div>

        {/* Status Chip */}
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
          isApproved ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' :
          isRejected ? 'text-red-600 dark:text-red-400 bg-red-500/10' :
          'text-amber-600 dark:text-amber-400 bg-amber-500/10'
        }`}>
          {isApproved ? '✓ Verified' : isRejected ? '✗ Rejected' : '⏳ Pending'}
        </span>
      </div>

      {/* Question Text */}
      <div className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed line-clamp-3">
        {q.question_text}
      </div>

      {/* Duplicate Alert Banner if duplicate */}
      {isDuplicate && (
        <div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-300 text-[11px]">
          <span className="flex items-center gap-1 font-bold">
            <AlertTriangle size={13} /> Possible duplicate
          </span>
          <button
            onClick={() => onOpenDuplicateComparison(q)}
            className="px-2 py-0.5 bg-amber-600 text-white font-bold rounded text-[10px]"
          >
            View
          </button>
        </div>
      )}

      {/* Bottom Row: Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        {/* Inline Actions: Verify/Unverify & Reject */}
        <div className="flex items-center gap-2">
          {!isApproved ? (
            <button
              onClick={() => onStatusChange(q.id, 'approved')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
            >
              <Check size={13} /> Verify
            </button>
          ) : (
            <button
              onClick={() => onStatusChange(q.id, 'draft')}
              className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs font-medium transition"
            >
              Unverify
            </button>
          )}

          <button
            onClick={() => onStatusChange(q.id, 'rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              isRejected ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-600 dark:border-red-900/40'
            }`}
          >
            Reject
          </button>
        </div>

        {/* Overflow Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]"
          >
            <MoreVertical size={16} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 bottom-full mb-1 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 py-1 text-xs">
              <button onClick={() => { setDropdownOpen(false); onEdit(q) }} className="w-full px-3.5 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2">
                <Edit2 size={14} className="text-blue-500" /> Edit
              </button>
              <button onClick={() => { setDropdownOpen(false); onPreview(q) }} className="w-full px-3.5 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2">
                <Eye size={14} className="text-gray-400" /> Preview
              </button>
              <button onClick={() => { setDropdownOpen(false); onDuplicate(q.id) }} className="w-full px-3.5 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2">
                <Copy size={14} className="text-purple-500" /> Duplicate
              </button>
              <button onClick={() => { setDropdownOpen(false); onMove(q) }} className="w-full px-3.5 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2">
                <MoveRight size={14} className="text-amber-500" /> Move to
              </button>
              <div className="my-1 border-t border-[var(--border)]" />
              <button onClick={() => { setDropdownOpen(false); onDelete(q.id) }} className="w-full px-3.5 py-2 text-left hover:bg-red-500/10 text-red-500 font-bold flex items-center gap-2">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
