import React, { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useQuery } from '@tanstack/react-query'
import { fetchAffiliates, trackClick } from '../services/api'
import SkeletonCard from '../components/SkeletonCard'

export default function AffiliatesPage() {
  const [filter, setFilter] = useState('')
  const toast = useToast()

  const { data: affiliates = [], isLoading, isError } = useQuery({
    queryKey: ['affiliates'],
    queryFn: fetchAffiliates
  })

  const items = affiliates.filter(a => !filter || a.category === filter)

  const CATS = [{ v: '', l: 'All' }, { v: 'exam-prep', l: '📝 Exam Prep' }, { v: 'courses', l: '💻 Courses' }, { v: 'books', l: '📚 Books' }, { v: 'tools', l: '🛠 Tools' }]

  const handleClick = (aff) => {
    trackClick(aff.id)
    toast(`Redirecting to ${aff.name}... 🚀`, 'info')
    setTimeout(() => window.open(aff.redirect_url, '_blank'), 500)
  }

  return (
    <div>
      <div className="page-header" style={{ background: 'var(--bg-surface)', position: 'relative', overflow: 'hidden' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
          <div style={{ flex: 1, maxWidth: '60%' }}>
            <h1 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              🎁 Exclusive Offers
            </h1>
            <div className="page-header p" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Handpicked deals on exam prep, courses, and job tools curated for you.
            </div>
            <div className="job-count-tag" style={{ color: 'var(--brand)', fontSize: '1rem', fontWeight: '700' }}>
              {items.length} offers
            </div>
          </div>
          
          {/* Illustration SVG */}
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '300px', opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 300 200" width="300" height="200" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
              {/* Gift boxes and deals */}
              <g>
                <rect x="30" y="50" width="60" height="60" fill="var(--brand)" opacity="0.8" rx="4" />
                <rect x="50" y="30" width="20" height="90" fill="var(--brand)" opacity="0.6" />
                <path d="M40 70 L80 70" stroke="var(--text-muted)" strokeWidth="3" opacity="0.9" />
                
                <rect x="120" y="60" width="55" height="55" fill="var(--brand)" opacity="0.6" rx="4" />
                <rect x="137" y="42" width="21" height="91" fill="var(--brand)" opacity="0.5" />
                <path d="M128 87 L175 87" stroke="var(--text-muted)" strokeWidth="2" opacity="0.8" />
                
                <rect x="200" y="70" width="50" height="50" fill="var(--brand)" opacity="0.7" rx="4" />
                <rect x="215" y="55" width="18" height="80" fill="var(--brand)" opacity="0.5" />
                <path d="M208 95 L242 95" stroke="var(--text-muted)" strokeWidth="2" opacity="0.9" />
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div className="container section">
        <div className="cat-tabs" style={{ marginBottom: '1.75rem' }}>
          {CATS.map(c => (
            <button key={c.v} style={{ background: filter === c.v ? 'var(--bg-input)' : 'var(--bg-card)', color: filter === c.v ? 'var(--brand)' : 'var(--text-secondary)' }} className={`cat-tab ${filter === c.v ? 'active' : ''}`} onClick={() => setFilter(c.v)}>{c.l}</button>
          ))}
        </div>

        {isError && (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Failed to load offers</div>
          </div>
        )}

        {isLoading ? (
          <div className="aff-grid">{[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}</div>
        ) : items.length === 0 && !isError ? (
           <div className="empty-state">
            <div className="empty-icon">🎁</div>
             <div className="empty-title" style={{ color: 'var(--text-primary)' }}>No offers found</div>
             <div className="empty-text" style={{ color: 'var(--text-secondary)' }}>Check back later!</div>
          </div>
        ) : (
          <div className="aff-grid">
            {items.map(aff => (
              <div key={aff.id} className="aff-card" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="aff-card-banner-placeholder" style={{ background: `linear-gradient(135deg,var(--bg-surface),var(--bg-base))` }}>
                  <span style={{ fontSize: '2.5rem' }}>{aff.emoji || '🎁'}</span>
                </div>
                <div className="aff-card-body">
                  <div className="aff-card-cat" style={{ color: 'var(--brand)' }}>{aff.category?.toUpperCase()}</div>
                  <div className="aff-card-name" style={{ color: 'var(--text-primary)' }}>{aff.name}</div>
                  <div className="aff-card-desc" style={{ color: 'var(--text-muted)' }}>{aff.description}</div>
                  <button className="aff-card-btn" style={{ background: 'var(--brand)', color: '#fff' }} onClick={() => handleClick(aff)}>
                    Visit Now ↗
                  </button>
                </div>
                <div style={{ position: 'absolute', top: '.5rem', right: '.5rem', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '.6rem', padding: '.15rem .5rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Ad</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
