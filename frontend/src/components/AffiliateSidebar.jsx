import React from 'react'
import { useToast } from '../context/ToastContext'
import { AFFILIATES } from '../data/mockData'

export default function AffiliateSidebar() {
  const items = AFFILIATES.filter(a => a.placement === 'sidebar').slice(0, 4)
  const toast = useToast()
  const handleClick = (aff) => {
    toast(`Opening ${aff.name}... 🚀`, 'info')
    setTimeout(() => window.open(aff.redirect_url, '_blank'), 400)
  }
  return (
    <div>
      <div className="sidebar-title">Sponsored</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
        {items.map(aff => (
          <div key={aff.id} className="aff-banner" onClick={() => handleClick(aff)}>
            <div className="aff-ad-label">Ad</div>
            <div className="aff-body">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${aff.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{aff.emoji}</div>
              <div className="aff-info">
                <div className="aff-name">{aff.name}</div>
                <div className="aff-desc">{aff.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
