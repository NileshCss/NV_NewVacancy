import React from 'react'

export default function SkeletonCard() {
  return (
    <div
      className="job-card"
      style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', minHeight: 320 }}
    >
      {/* Category badge */}
      <div className="skeleton" style={{ height: 22, width: '45%', borderRadius: 999 }} />
      {/* Title — 2 lines reserved */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
        <div className="skeleton" style={{ height: 16 }} />
        <div className="skeleton" style={{ height: 16, width: '75%' }} />
      </div>
      {/* Org */}
      <div className="skeleton" style={{ height: 14, width: '55%' }} />
      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.35rem' }}>
        <div className="skeleton" style={{ height: 13 }} />
        <div className="skeleton" style={{ height: 13 }} />
        <div className="skeleton" style={{ height: 13 }} />
        <div className="skeleton" style={{ height: 13 }} />
      </div>
      {/* Tags */}
      <div style={{ display: 'flex', gap: '.35rem' }}>
        <div className="skeleton" style={{ height: 20, width: 48, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 20, width: 52, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 20, width: 44, borderRadius: 999 }} />
      </div>
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      {/* Apply button */}
      <div className="skeleton" style={{ height: 40, borderRadius: 12 }} />
    </div>
  )
}
