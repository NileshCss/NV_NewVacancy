import React, { useState, useEffect } from 'react'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import JobCard from '../components/JobCard'
import NewsCard from '../components/NewsCard'
import AffiliateSidebar from '../components/AffiliateSidebar'
import SkeletonCard from '../components/SkeletonCard'
import { ALL_JOBS, NEWS_DATA, AFFILIATES } from '../data/mockData'

export default function HomePage() {
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const featuredJobs = ALL_JOBS.filter(j => j.is_featured).slice(0, 6)
  const featuredNews = NEWS_DATA.filter(n => n.is_featured).slice(0, 4)
  const heroAff = AFFILIATES.find(a => a.placement === 'hero')
  const toast = useToast()

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t); }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (search.trim()) navigate('govt-jobs')
  }

  const STATS = [
    { icon: '💼', val: '12,000+', label: 'Active Jobs' },
    { icon: '🏢', val: '500+', label: 'Organizations' },
    { icon: '👥', val: '2L+', label: 'Job Seekers' },
    { icon: '🔄', val: '24/7', label: 'Daily Updates' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="hero-badge">
              <span className="pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-l)', display: 'inline-block' }} />
              India's Trusted Job Portal
            </div>
          </div>
          <h1 className="anim-up">
            Find Your Dream
            <span className="accent">Govt & Private Jobs</span>
          </h1>
          <p className="anim-up anim-d1">Daily updates on SSC, UPSC, Railway, Banking, IT jobs and more. Never miss a vacancy.</p>

          <form onSubmit={handleSearch} className="search-bar anim-up anim-d2">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" type="text" placeholder="Search jobs, organizations, exams..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button type="submit" className="search-btn">Search</button>
          </form>

          <div className="quick-tags anim-up anim-d3">
            {['SSC CGL', 'UPSC', 'Railway RRB', 'IBPS PO', 'IT Jobs', 'Teaching'].map(t => (
              <span key={t} className="qtag" onClick={() => navigate('govt-jobs')}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="stats-bar">
        <div className="container">
          <div className="stats-grid">
            {STATS.map(s => (
              <div key={s.label} className="stat-item">
                <div className="stat-icon">{s.icon}</div>
                <div><div className="stat-val">{s.val}</div><div className="stat-label">{s.label}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container section">
        <div className="grid-main">
          <div>
            {/* Hero Affiliate */}
            {heroAff && (
              <div className="aff-banner" style={{ marginBottom: '1.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
                   onClick={() => window.open(heroAff.redirect_url, '_blank')}>
                <div className="aff-ad-label">Sponsored</div>
                <div style={{ fontSize: '2.5rem' }}>{heroAff.emoji}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: '.25rem' }}>{heroAff.name}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--grey-4)' }}>{heroAff.description}</div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>Explore →</button>
              </div>
            )}

            {/* Category Cards */}
            <div className="cat-grid">
              <div className="cat-card govt" onClick={() => navigate('govt-jobs')}>
                <div className="cat-emoji">🏛️</div>
                <div className="cat-title">Government Jobs</div>
                <div className="cat-sub">SSC, UPSC, Railway, Bank, Police</div>
                <div className="cat-link">Browse All →</div>
              </div>
              <div className="cat-card pvt" onClick={() => navigate('private-jobs')}>
                <div className="cat-emoji">💼</div>
                <div className="cat-title">Private Jobs</div>
                <div className="cat-sub">IT, Finance, Marketing, Engineering</div>
                <div className="cat-link">Browse All →</div>
              </div>
            </div>

            {/* Featured Jobs */}
            <div>
              <div className="section-header">
                <div>
                  <div className="section-title">⭐ Featured Jobs</div>
                  <div className="section-sub">Handpicked latest opportunities</div>
                </div>
                <span className="see-all" onClick={() => navigate('govt-jobs')}>View all →</span>
              </div>
              {loading ? (
                <div className="jobs-grid">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>
              ) : (
                <div className="jobs-grid">
                  {featuredJobs.map(j => <JobCard key={j.id} job={j} />)}
                </div>
              )}
            </div>

            {/* Latest News */}
            <div style={{ marginTop: '2.5rem' }}>
              <div className="section-header">
                <div>
                  <div className="section-title">📰 Latest News</div>
                  <div className="section-sub">Tech & Govt updates</div>
                </div>
                <span className="see-all" onClick={() => navigate('news')}>All news →</span>
              </div>
              <div className="news-grid">
                {featuredNews.map(a => <NewsCard key={a.id} article={a} />)}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="sidebar">
            <AffiliateSidebar />
          </aside>
        </div>
      </div>
    </div>
  )
}
