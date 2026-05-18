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
      <div className="page-header" style={{ background: 'linear-gradient(135deg,rgba(249,115,22,.08) 0%,var(--bg-base) 100%)' }}>
        <div className="container">
          <h1 style={{ color: 'var(--text-primary)' }}>🎁 Exclusive Offers</h1>
          <div className="page-header p" style={{ color: 'var(--text-secondary)' }}>Handpicked deals on exam prep, courses, and job tools</div>
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
