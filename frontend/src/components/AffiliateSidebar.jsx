import React from 'react'
import { useToast } from '../context/ToastContext'
import { useQuery } from '@tanstack/react-query'
import { fetchAffiliates, trackClick } from '../services/api'
import SkeletonCard from './SkeletonCard'

export default function AffiliateSidebar() {
  const toast = useToast()

  const { data: affiliates, isLoading, isError } = useQuery({
    queryKey: ['affiliates', 'sidebar'],
    queryFn: fetchAffiliates
  })

  // get only 'sidebar' placement elements, or fallback if none are explicitly marked.
  const items = affiliates?.filter(a => a.placement === 'sidebar' || !a.placement).slice(0, 4) || []

  const handleClick = (aff) => {
    trackClick(aff.id)
    toast(`Opening ${aff.name}... 🚀`, 'info')
    window.open(aff.redirect_url, '_blank')
  }

  return (
    <div>
      <div className="sidebar-title" style={{ color: 'var(--text-muted)' }}>Sponsored</div>
      {isError && <div style={{ color: 'var(--red)' }}>Failed to load partners</div>}
      
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {items.map(aff => (
            <div key={aff.id} className="aff-banner" style={{ background: 'var(--bg-card)' }} onClick={() => handleClick(aff)}>
              <div className="aff-ad-label">Ad</div>
              <div className="aff-body">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{aff.emoji || '💼'}</div>
                <div className="aff-info">
                  <div className="aff-name" style={{ color: 'var(--text-primary)' }}>{aff.name}</div>
                  <div className="aff-desc" style={{ color: 'var(--text-muted)' }}>{aff.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
