import React from 'react'

export default function PaginationBar({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange
}) {
  if (!totalItems || totalItems === 0) return null

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalItems / pageSize) || 1
  const startCount = pageSize === 'all' ? 1 : (page - 1) * pageSize + 1
  const endCount   = pageSize === 'all' ? totalItems : Math.min(page * pageSize, totalItems)

  return (
    <div className="p-3.5 border-t border-[var(--border)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] font-medium">
      {/* Left: Showing Count */}
      <div>
        Showing {startCount}-{endCount} of {totalItems}
      </div>

      {/* Right: Page Navigation Controls */}
      <div className="flex items-center gap-3">
        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={e => {
              const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value)
              onPageSizeChange(val)
            }}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] font-semibold"
          >
            <option value={15}>15 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value="all">All ({totalItems})</option>
          </select>
        </div>

        {/* Number Buttons Pagination */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--border)] disabled:opacity-30 transition font-bold"
            >
              ‹
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
              let pageNum = idx + 1
              if (totalPages > 5 && page > 3) {
                pageNum = page - 2 + idx
                if (pageNum > totalPages) pageNum = totalPages - (4 - idx)
              }
              if (pageNum <= 0) return null
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs transition ${
                    page === pageNum
                      ? 'bg-[var(--bg-card)] border-2 border-[var(--text-primary)] text-[var(--text-primary)] shadow-xs'
                      : 'bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            {totalPages > 5 && page < totalPages - 2 && <span className="px-1 text-[var(--text-muted)]">...</span>}
            {totalPages > 5 && page < totalPages - 2 && (
              <button
                onClick={() => onPageChange(totalPages)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] font-bold text-xs transition"
              >
                {totalPages}
              </button>
            )}

            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--border)] disabled:opacity-30 transition font-bold"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
