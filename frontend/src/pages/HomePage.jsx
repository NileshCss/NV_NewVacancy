import React, { useState } from 'react'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { useQuery } from '@tanstack/react-query'
import JobCard from '../components/JobCard'
import NewsCard from '../components/NewsCard'
import AffiliateSidebar from '../components/AffiliateSidebar'
import SkeletonCard from '../components/SkeletonCard'
import LiveTicker from '../components/LiveTicker'
import JobApplyModal from '../components/jobs/JobApplyModal'
import { fetchJobs, fetchNews, fetchAffiliates } from '../services/api'

export default function HomePage() {
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [isSavedInitially, setIsSavedInitially] = useState(false)
  const toast = useToast()

  const { data: jobs, isLoading: jobsLoading, isError: jobsError } = useQuery({ queryKey: ['jobs'], queryFn: () => fetchJobs() })
  const { data: news, isLoading: newsLoading, isError: newsError } = useQuery({ queryKey: ['news'], queryFn: fetchNews })
  const { data: affiliates, isLoading: affLoading } = useQuery({ queryKey: ['affiliates'], queryFn: fetchAffiliates })

  const featuredJobs = jobs?.filter(j => j.is_featured)?.slice(0, 6) || []
  const featuredNews = news?.filter(n => n.is_featured)?.slice(0, 4) || []
  const heroAff = affiliates?.find(a => a.placement === 'hero')

  const handleSearch = (e) => {
    e.preventDefault()
    if (search.trim()) navigate('govt-jobs')
  }

  const handleApplyClick = (job, isSaved) => {
    setSelectedJob(job)
    setIsSavedInitially(isSaved)
  }

  const STATS = [
    { icon: '💼', val: '12,000+', label: 'Active Jobs' },
    { icon: '🏢', val: '500+', label: 'Organizations' },
    { icon: '👥', val: '2L+', label: 'Job Seekers' },
    { icon: '🔄', val: '24/7', label: 'Daily Updates' },
  ]

  return (
    <div>
      {/* Live Ticker */}
      <LiveTicker speed={50} showLabel={false} />

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
          <p className="anim-up anim-d1" style={{ color: 'var(--text-secondary)' }}>Daily updates on SSC, UPSC, Railway, Banking, IT jobs and more. Never miss a vacancy.</p>

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
                <div><div className="stat-val" style={{ color: 'var(--text-primary)' }}>{s.val}</div><div className="stat-label" style={{ color: 'var(--text-secondary)' }}>{s.label}</div></div>
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
            {!affLoading && heroAff && (
              <div className="aff-banner" style={{ marginBottom: '1.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)' }}
                   onClick={() => window.open(heroAff.redirect_url, '_blank')}>
                <div className="aff-ad-label">Sponsored</div>
                <div style={{ fontSize: '2.5rem' }}>{heroAff.emoji || '🎁'}</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '.25rem' }}>{heroAff.name}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{heroAff.description}</div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>Explore →</button>
              </div>
            )}

            {/* Category Cards */}
            <div className="cat-grid">
              <div className="cat-card govt" onClick={() => navigate('govt-jobs')}>
                <div className="cat-emoji">🏛️</div>
                <div className="cat-title" style={{ color: 'var(--text-primary)' }}>Government Jobs</div>
                <div className="cat-sub" style={{ color: 'var(--text-muted)' }}>SSC, UPSC, Railway, Bank, Police</div>
                <div className="cat-link" style={{ color: 'var(--brand)' }}>Browse All →</div>
              </div>
              <div className="cat-card pvt" onClick={() => navigate('private-jobs')}>
                <div className="cat-emoji">💼</div>
                <div className="cat-title" style={{ color: 'var(--text-primary)' }}>Private Jobs</div>
                <div className="cat-sub" style={{ color: 'var(--text-muted)' }}>IT, Finance, Marketing, Engineering</div>
                <div className="cat-link" style={{ color: 'var(--blue)' }}>Browse All →</div>
              </div>
            </div>

            {/* Featured Jobs */}
            <div>
              <div className="section-header">
                <div>
                  <div className="section-title" style={{ color: 'var(--text-primary)' }}>⭐ Featured Jobs</div>
                  <div className="section-sub" style={{ color: 'var(--text-muted)' }}>Handpicked latest opportunities</div>
                </div>
                <span className="see-all" onClick={() => navigate('govt-jobs')} style={{ color: 'var(--brand-l)' }}>View all →</span>
              </div>
              
              {jobsError ? (
                <div className="empty-state">
                  <div className="empty-icon">⚠️</div>
                  <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Failed to load jobs</div>
                  <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Please check your connection and try again.</div>
                </div>
              ) : jobsLoading ? (
                <div className="jobs-grid">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>
              ) : featuredJobs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-title" style={{ color: 'var(--text-primary)' }}>No featured jobs yet</div>
                  <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Check back later for new opportunities.</div>
                </div>
              ) : (
                <div className="jobs-grid">
                  {featuredJobs.map(j => <JobCard key={j.id} job={j} onApplyClick={handleApplyClick} />)}
                </div>
              )}
            </div>

            {/* Latest News */}
            <div style={{ marginTop: '2.5rem' }}>
              <div className="section-header">
                <div>
                  <div className="section-title" style={{ color: 'var(--text-primary)' }}>📰 Latest News</div>
                  <div className="section-sub" style={{ color: 'var(--text-muted)' }}>Tech & Govt updates</div>
                </div>
                <span className="see-all" onClick={() => navigate('news')} style={{ color: 'var(--brand-l)' }}>All news →</span>
              </div>

              {newsError ? (
                <div className="empty-state">
                  <div className="empty-icon">⚠️</div>
                  <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Failed to load news</div>
                </div>
              ) : newsLoading ? (
                 <div className="news-grid">{[1, 2].map(i => <SkeletonCard key={i} />)}</div>
              ) : featuredNews.length === 0 ? (
                 <div className="empty-state">
                  <div className="empty-icon">📰</div>
                  <div className="empty-title" style={{ color: 'var(--text-primary)' }}>No news found</div>
                </div>
              ) : (
                <div className="news-grid">
                  {featuredNews.map(a => <NewsCard key={a.id} article={a} />)}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="sidebar">
            <AffiliateSidebar />
          </aside>
        </div>
      </div>

      {/* Job Apply Modal */}
      <JobApplyModal 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)} 
        isSavedInitially={isSavedInitially}
      />
    </div>
  )
}
