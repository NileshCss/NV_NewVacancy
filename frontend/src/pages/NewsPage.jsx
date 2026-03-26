import React, { useState } from 'react'
import NewsCard from '../components/NewsCard'
import AffiliateSidebar from '../components/AffiliateSidebar'
import { NEWS_DATA } from '../data/mockData'

export default function NewsPage() {
  const [cat, setCat] = useState('')
  const [page, setPage] = useState(1)
  const PER = 6

  const filtered = NEWS_DATA.filter(n => !cat || n.category === cat)
  const paged = filtered.slice((page - 1) * PER, page * PER)
  const totalPages = Math.ceil(filtered.length / PER)

  const CATS = [{ v: '', l: 'All News', e: '📰' }, { v: 'govt', l: 'Govt', e: '🏛️' }, { v: 'tech', l: 'Tech', e: '💻' }, { v: 'education', l: 'Education', e: '🎓' }]

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>📰 Latest News</h1>
          <div className="page-header p">Tech, Govt & Education updates for job seekers</div>
        </div>
      </div>
      <div className="container section">
        <div className="grid-main">
          <div>
            <div className="cat-tabs">
              {CATS.map(c => (
                <button key={c.v} className={`cat-tab ${cat === c.v ? 'active' : ''}`} onClick={() => { setCat(c.v); setPage(1); }}>
                  {c.e} {c.l}
                </button>
              ))}
            </div>
            <div className="news-grid">
              {paged.map(a => <NewsCard key={a.id} article={a} />)}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className="page-info">Page {page} of {totalPages}</span>
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>
          <aside className="sidebar"><AffiliateSidebar /></aside>
        </div>
      </div>
    </div>
  )
}
