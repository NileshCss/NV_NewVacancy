import React from 'react'

export default function SkeletonCard() {
  return (
    <div className="job-card" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <div className="skeleton" style={{ height: 24, width: '60%' }} />
      <div className="skeleton" style={{ height: 40 }} />
      <div className="skeleton" style={{ height: 18, width: '45%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem' }}>
        <div className="skeleton" style={{ height: 16 }} />
        <div className="skeleton" style={{ height: 16 }} />
        <div className="skeleton" style={{ height: 16 }} />
        <div className="skeleton" style={{ height: 16 }} />
      </div>
      <div className="skeleton" style={{ height: 40, borderRadius: 12 }} />
    </div>
  )
}
