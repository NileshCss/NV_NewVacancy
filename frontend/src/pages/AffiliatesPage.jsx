import React, { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { AFFILIATES } from '../data/mockData'

export default function AffiliatesPage() {
  const [filter, setFilter] = useState('')
  const toast = useToast()
  const CATS = [{ v: '', l: 'All' }, { v: 'exam-prep', l: '📝 Exam Prep' }, { v: 'courses', l: '💻 Courses' }, { v: 'books', l: '📚 Books' }, { v: 'tools', l: '🛠 Tools' }]
  const items = AFFILIATES.filter(a => !filter || a.category === filter)

  const handleClick = (aff) => {
    toast(`Redirecting to ${aff.name}... 🚀`, 'info')
    setTimeout(() => window.open(aff.redirect_url, '_blank'), 500)
  }

  return (
    <div>
      <div className="page-header" style={{ background: 'linear-gradient(135deg,rgba(249,115,22,.08) 0%,var(--navy-9) 100%)' }}>
        <div className="container">
          <h1>🎁 Exclusive Offers</h1>
          <div className="page-header p">Handpicked deals on exam prep, courses, and job tools</div>
        </div>
      </div>
      <div className="container section">
        <div className="cat-tabs" style={{ marginBottom: '1.75rem' }}>
          {CATS.map(c => (
            <button key={c.v} className={`cat-tab ${filter === c.v ? 'active' : ''}`} onClick={() => setFilter(c.v)}>{c.l}</button>
          ))}
        </div>
        <div className="aff-grid">
          {items.map(aff => (
            <div key={aff.id} className="aff-card">
              <div className="aff-card-banner-placeholder" style={{ background: `linear-gradient(135deg,${aff.color}22,${aff.color}08)` }}>
                <span style={{ fontSize: '2.5rem' }}>{aff.emoji}</span>
              </div>
              <div className="aff-card-body">
                <div className="aff-card-cat">{aff.category.toUpperCase()}</div>
                <div className="aff-card-name">{aff.name}</div>
                <div className="aff-card-desc">{aff.description}</div>
                <button className="aff-card-btn" onClick={() => handleClick(aff)}>
                  Visit Now ↗
                </button>
              </div>
              <div style={{ position: 'absolute', top: '.5rem', right: '.5rem', background: 'rgba(0,0,0,.4)', color: 'rgba(255,255,255,.4)', fontSize: '.6rem', padding: '.15rem .5rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Ad</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
