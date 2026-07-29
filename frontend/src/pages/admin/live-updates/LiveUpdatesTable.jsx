import React from 'react'
import EmptyStateCard from '../../../components/admin/common/EmptyStateCard'
import { Radio, Edit2, Trash2, ExternalLink, Clock } from 'lucide-react'

export default function LiveUpdatesTable({
  updates,
  isLoading,
  onEdit,
  onDelete,
  onToggleStatus,
  onAddClick,
  getTypeIcon,
  getTypeLabel,
  getPriorityStyles,
  getExpiryStatus
}) {
  if (isLoading) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center text-xs text-[var(--text-muted)] font-medium">
        Loading live updates...
      </div>
    )
  }

  if (updates.length === 0) {
    return (
      <EmptyStateCard
        icon={Radio}
        title="No live updates yet"
        description="Create your first live update to publish alerts for jobs, exams, deadlines, or news."
        actionLabel="Add Update"
        onAction={onAddClick}
      />
    )
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
      {/* Desktop & Tablet Table */}
      <div className="hidden md:block overflow-x-auto min-w-full">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Title & Link</th>
              <th className="p-3.5 w-28">Type</th>
              <th className="p-3.5 w-28">Priority</th>
              <th className="p-3.5 w-32">Expiry</th>
              <th className="p-3.5 w-28">Status</th>
              <th className="p-3.5 w-32 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {updates.map((update) => {
              const expiry = getExpiryStatus(update.expiry_date)
              return (
                <tr key={update.id} className="hover:bg-[var(--bg-surface)]/60 transition">
                  <td className="p-3.5 font-semibold text-[var(--text-primary)] max-w-md">
                    <div className="line-clamp-2 leading-relaxed">{update.title}</div>
                    {update.link && (
                      <a
                        href={update.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline mt-0.5 truncate max-w-xs"
                      >
                        <ExternalLink size={11} /> {update.link}
                      </a>
                    )}
                  </td>

                  <td className="p-3.5 align-middle">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)]">
                      <span>{getTypeIcon(update.type)}</span>
                      <span>{getTypeLabel(update.type)}</span>
                    </span>
                  </td>

                  <td className="p-3.5 align-middle">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      update.priority === 'urgent'
                        ? 'bg-red-500/10 border-red-500/30 text-red-500'
                        : 'bg-gray-500/10 border-gray-500/30 text-gray-500'
                    }`}>
                      {update.priority === 'urgent' ? '🔴 Urgent' : 'Normal'}
                    </span>
                  </td>

                  <td className="p-3.5 align-middle">
                    <span
                      style={{ color: expiry.color }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Clock size={12} /> {expiry.text}
                    </span>
                  </td>

                  <td className="p-3.5 align-middle">
                    <button
                      onClick={() => onToggleStatus(update.id, update.is_active)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                        update.is_active
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {update.is_active ? '✓ Active' : 'Inactive'}
                    </button>
                  </td>

                  <td className="p-3.5 align-middle text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEdit(update)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-blue-500 font-semibold transition text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => onDelete(update.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-semibold transition text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Card View */}
      <div className="md:hidden p-3 space-y-3">
        {updates.map((update) => {
          const expiry = getExpiryStatus(update.expiry_date)
          return (
            <div key={update.id} className="p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{getTypeIcon(update.type)}</span>
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">{getTypeLabel(update.type)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    update.priority === 'urgent' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-gray-500/10 border-gray-500/30 text-gray-500'
                  }`}>
                    {update.priority === 'urgent' ? '🔴 Urgent' : 'Normal'}
                  </span>
                </div>

                <button
                  onClick={() => onToggleStatus(update.id, update.is_active)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    update.is_active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-500/10 text-[var(--text-muted)]'
                  }`}
                >
                  {update.is_active ? '✓ Active' : 'Inactive'}
                </button>
              </div>

              <div className="text-xs font-bold text-[var(--text-primary)] leading-relaxed">{update.title}</div>

              {update.link && (
                <a href={update.link} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 hover:underline block truncate">
                  🔗 {update.link}
                </a>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-xs">
                <span style={{ color: expiry.color }} className="font-semibold text-[11px]">
                  ⏰ {expiry.text}
                </span>

                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(update)} className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border)] text-blue-500 rounded-lg font-semibold">
                    Edit
                  </button>
                  <button onClick={() => onDelete(update.id)} className="px-2.5 py-1 bg-red-500/10 text-red-500 rounded-lg font-semibold">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
