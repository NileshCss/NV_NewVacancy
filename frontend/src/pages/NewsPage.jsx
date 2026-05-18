import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import NewsCard from '../components/NewsCard'
import AffiliateSidebar from '../components/AffiliateSidebar'
import SkeletonCard from '../components/SkeletonCard'
import { fetchNews } from '../services/api'

export default function NewsPage() {
  const [cat, setCat] = useState('')
  const [page, setPage] = useState(1)
  const PER = 6

  const { data: news = [], isLoading, isError } = useQuery({
    queryKey: ['news'],
    queryFn: fetchNews
  })

  const filtered = news.filter(n => !cat || n.category === cat)
  const paged = filtered.slice((page - 1) * PER, page * PER)
  const totalPages = Math.ceil(filtered.length / PER) || 1

  const CATS = [{ v: '', l: 'All News', e: '📰' }, { v: 'govt', l: 'Govt', e: '🏛️' }, { v: 'tech', l: 'Tech', e: '💻' }, { v: 'education', l: 'Education', e: '🎓' }]

  return (
    <div>
      <div className="page-header" style={{ background: 'var(--bg-surface)', position: 'relative', overflow: 'hidden' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
          <div style={{ flex: 1, maxWidth: '60%' }}>
            <h1 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              📰 Latest News
            </h1>
            <div className="page-header p" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Tech, Govt & Education updates for job seekers
            </div>
            <div className="job-count-tag" style={{ color: 'var(--brand)', fontSize: '1rem', fontWeight: '700' }}>
              {filtered.length} articles
            </div>
          </div>
          
          {/* Illustration SVG */}
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '280px', opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 280 200" width="280" height="200" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
              {/* Newspaper pages */}
              <g>
                <rect x="20" y="30" width="100" height="140" fill="var(--text-muted)" opacity="0.6" rx="4" />
                <rect x="30" y="40" width="80" height="8" fill="var(--brand)" opacity="0.9" />
                <rect x="30" y="55" width="80" height="4" fill="var(--text-muted)" opacity="0.5" />
                <rect x="30" y="62" width="80" height="4" fill="var(--text-muted)" opacity="0.5" />
                <rect x="30" y="75" width="35" height="50" fill="var(--brand)" opacity="0.7" />
                <rect x="70" y="75" width="40" height="50" fill="var(--text-muted)" opacity="0.4" />
                <rect x="30" y="135" width="80" height="3" fill="var(--text-muted)" opacity="0.4" />
                
                <rect x="140" y="50" width="100" height="120" fill="var(--text-muted)" opacity="0.5" rx="4" />
                <rect x="150" y="60" width="80" height="6" fill="var(--brand)" opacity="0.8" />
                <rect x="150" y="72" width="80" height="3" fill="var(--text-muted)" opacity="0.4" />
                <rect x="150" y="80" width="80" height="60" fill="var(--text-muted)" opacity="0.3" />
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div className="container section">
        <div className="grid-main">
          <div>
            <div className="cat-tabs">
              {CATS.map(c => (
                <button key={c.v} style={{ background: cat === c.v ? 'var(--bg-input)' : 'var(--bg-card)', color: cat === c.v ? 'var(--brand)' : 'var(--text-secondary)' }} className={`cat-tab ${cat === c.v ? 'active' : ''}`} onClick={() => { setCat(c.v); setPage(1); }}>
                  {c.e} {c.l}
                </button>
              ))}
            </div>

            {isError ? (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Failed to load news</div>
                <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Attempting to reconnect...</div>
              </div>
            ) : isLoading ? (
              <div className="news-grid">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>
            ) : paged.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📰</div>
                <div className="empty-title" style={{ color: 'var(--text-primary)' }}>No news found</div>
                <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Try a different category</div>
              </div>
            ) : (
              <div className="news-grid">
                {paged.map(a => <NewsCard key={a.id} article={a} />)}
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
                <button style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }} className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className="page-info" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                <button style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }} className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>
          <aside className="sidebar"><AffiliateSidebar /></aside>
        </div>
      </div>
    </div>
  )
}
