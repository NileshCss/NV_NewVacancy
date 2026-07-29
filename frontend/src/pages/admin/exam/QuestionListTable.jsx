import React, { useState, useRef, useEffect } from 'react'
import { Check, X, MoreVertical, Edit2, Eye, Copy, MoveRight, Trash2, AlertTriangle } from 'lucide-react'

export default function QuestionListTable({
  questions,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectRow,
  onStatusChange,
  onEdit,
  onPreview,
  onDuplicate,
  onMove,
  onDelete,
  duplicateSet,
  onOpenDuplicateComparison
}) {
  const [activeDropdownId, setActiveDropdownId] = useState(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="overflow-x-auto min-w-full">
      <table className="w-full text-left border-collapse text-xs min-w-[780px]">
        <thead>
          <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
            <th className="p-3.5 w-10 text-center">
              <input
                type="checkbox"
                checked={selectedIds.size === questions.length && questions.length > 0}
                onChange={onToggleSelectAll}
                className="rounded cursor-pointer w-4 h-4"
              />
            </th>
            <th className="p-3.5">Question Text</th>
            <th className="p-3.5 w-24 text-center">Type</th>
            <th className="p-3.5 w-24 text-center">Difficulty</th>
            <th className="p-3.5 w-28 text-center">Status</th>
            <th className="p-3.5 w-56 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {questions.map(q => {
            const isSelected = selectedIds.has(q.id)
            const isApproved = q.status === 'approved'
            const isRejected = q.status === 'rejected'
            const isDup      = duplicateSet.has(q.id)

            return (
              <tr key={q.id} className={`hover:bg-[var(--bg-surface)]/60 transition h-16 ${isSelected ? 'bg-orange-500/5' : ''}`}>
                <td className="p-3.5 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelectRow(q.id)}
                    className="rounded cursor-pointer w-4 h-4"
                  />
                </td>

                {/* Normalized Row Height with line-clamp-2 (Point 6 Fix) */}
                <td className="p-3.5 align-middle font-semibold text-[var(--text-primary)] max-w-md lg:max-w-xl">
                  <div className="line-clamp-2 leading-relaxed" title={q.question_text}>{q.question_text}</div>
                  {isDup && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold px-2 py-0.5 rounded-lg">
                        <AlertTriangle size={11} /> Possible duplicate
                      </span>
                      <button
                        onClick={() => onOpenDuplicateComparison(q)}
                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-bold transition shadow-xs cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  )}
                </td>

                <td className="p-3.5 text-center align-middle text-[11px] text-[var(--text-secondary)] uppercase font-mono tracking-wide">
                  {q.question_type || 'MCQ'}
                </td>

                <td className="p-3.5 text-center align-middle">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                    q.difficulty === 'hard'   ? 'text-red-600 dark:text-red-400 font-extrabold' :
                    q.difficulty === 'medium' ? 'text-amber-700 dark:text-amber-400 font-bold' :
                    'text-emerald-600 dark:text-emerald-400 font-bold'
                  }`}>{q.difficulty || 'medium'}</span>
                </td>

                <td className="p-3.5 text-center align-middle">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isApproved ? 'text-emerald-600 dark:text-emerald-400' :
                    isRejected ? 'text-red-600 dark:text-red-400' :
                    'text-amber-600 dark:text-amber-400'
                  }`}>
                    {isApproved ? '✓ Verified' : isRejected ? '✗ Rejected' : '⏳ Pending'}
                  </span>
                </td>

                {/* Consolidate Actions Menu (Point 3 & Provided Mockup Fix) */}
                <td className="p-3.5 text-right align-middle">
                  <div className="flex items-center justify-end gap-2 relative">
                    {/* 1. Inline Toggle Button: Unverify / Verify */}
                    {isApproved ? (
                      <button
                        onClick={() => onStatusChange(q.id, 'draft')}
                        className="px-3 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg text-xs font-medium transition shadow-xs cursor-pointer"
                        title="Unverify (Revert to Pending)"
                      >
                        Unverify
                      </button>
                    ) : (
                      <button
                        onClick={() => onStatusChange(q.id, 'approved')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                        title="Verify & Approve"
                      >
                        Verify
                      </button>
                    )}

                    {/* 2. Inline Button: Reject */}
                    <button
                      onClick={() => onStatusChange(q.id, 'rejected')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition shadow-xs cursor-pointer ${
                        isRejected
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-[var(--bg-card)] hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40'
                      }`}
                      title="Reject Question"
                    >
                      Reject
                    </button>

                    {/* 3. Overflow Dropdown ⋮ Button */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveDropdownId(activeDropdownId === q.id ? null : q.id)
                        }}
                        className="p-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg transition cursor-pointer"
                        title="More options"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu Overlay */}
                      {activeDropdownId === q.id && (
                        <div
                          ref={dropdownRef}
                          className="absolute right-0 top-full mt-1.5 w-36 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 py-1 text-xs text-[var(--text-primary)]"
                        >
                          <button
                            onClick={() => { setActiveDropdownId(null); onEdit(q) }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <Edit2 size={13} className="text-blue-500" /> Edit
                          </button>
                          <button
                            onClick={() => { setActiveDropdownId(null); onPreview(q) }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <Eye size={13} className="text-gray-400" /> Preview
                          </button>
                          <button
                            onClick={() => { setActiveDropdownId(null); onDuplicate(q.id) }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <Copy size={13} className="text-purple-500" /> Duplicate
                          </button>
                          <button
                            onClick={() => { setActiveDropdownId(null); onMove(q) }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] flex items-center gap-2 font-medium cursor-pointer"
                          >
                            <MoveRight size={13} className="text-amber-500" /> Move to
                          </button>
                          <div className="my-1 border-t border-[var(--border)]"></div>
                          <button
                            onClick={() => { setActiveDropdownId(null); onDelete(q.id) }}
                            className="w-full px-3 py-2 text-left hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-bold cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
