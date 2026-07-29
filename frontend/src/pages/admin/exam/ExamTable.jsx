import React from 'react'
import EmptyStateCard from '../../../components/admin/common/EmptyStateCard'
import { Award, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'

export default function ExamTable({
  exams,
  loading,
  onEdit,
  onDelete,
  onToggleStatus,
  onAddClick
}) {
  if (loading) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center text-xs text-[var(--text-muted)] font-medium">
        Loading exams...
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <EmptyStateCard
        icon={Award}
        title="No exams found"
        description="Get started by creating a new exam entry."
        actionLabel="New Exam"
        onAction={onAddClick}
      />
    )
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto min-w-full">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Exam Name & Slug</th>
              <th className="p-3.5 w-40">Category</th>
              <th className="p-3.5 w-32 text-center">Status</th>
              <th className="p-3.5 w-56 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {exams.map((ex) => {
              const isPublished = ex.status === 'published'
              const isDraft     = ex.status === 'draft'

              return (
                <tr key={ex.id} className="hover:bg-[var(--bg-surface)]/60 transition h-16">
                  {/* Name and Slug separated visually */}
                  <td className="p-3.5 align-middle">
                    <div className="font-bold text-sm text-[var(--text-primary)] leading-snug">{ex.name}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">slug: {ex.slug}</div>
                  </td>

                  {/* Category */}
                  <td className="p-3.5 align-middle">
                    <span className="inline-block px-2.5 py-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)]">
                      {ex.exam_categories?.name || 'Uncategorized'}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="p-3.5 align-middle text-center">
                    <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      isPublished ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                      isDraft     ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                      'bg-gray-500/10 text-gray-500 border-gray-500/20'
                    }`}>
                      {ex.status}
                    </span>
                  </td>

                  {/* Row Actions with proper gaps */}
                  <td className="p-3.5 align-middle text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onToggleStatus(ex)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                          isPublished
                            ? 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)]'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title={isPublished ? 'Unpublish Exam' : 'Publish Exam'}
                      >
                        {isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{isPublished ? 'Unpublish' : 'Publish'}</span>
                      </button>

                      <button
                        onClick={() => onEdit(ex)}
                        className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-blue-500 font-semibold transition text-xs flex items-center gap-1 cursor-pointer"
                        title="Edit Exam Details"
                      >
                        <Edit2 size={13} /> Edit
                      </button>

                      <button
                        onClick={() => onDelete(ex.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-semibold transition text-xs flex items-center gap-1 cursor-pointer"
                        title="Delete Exam"
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
    </div>
  )
}
