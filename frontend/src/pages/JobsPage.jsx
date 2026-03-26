import React, { useState, useEffect } from 'react'
import JobCard from '../components/JobCard'
import SkeletonCard from '../components/SkeletonCard'
import AffiliateSidebar from '../components/AffiliateSidebar'
import { GOVT_JOBS, PRIVATE_JOBS } from '../data/mockData'

export default function JobsPage({ category }) {
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const PER_PAGE = 6

  const source = category === 'govt' ? GOVT_JOBS : PRIVATE_JOBS
  const isGovt = category === 'govt'

  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, [category])

  const filtered = source.filter(j => {
    const q = search.toLowerCase()
    const matchSearch = !search || j.title.toLowerCase().includes(q) || j.organization.toLowerCase().includes(q) || j.tags?.some(t => t.includes(q))
    const matchState = !state || j.state === state || j.location?.includes(state)
    const matchTag = !activeTag || j.tags?.includes(activeTag)
    return matchSearch && matchState && matchTag
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const clearFilters = () => { setSearch(''); setState(''); setActiveTag(''); setPage(1); }

  const STATES = ['UP', 'Bihar', 'Maharashtra', 'Delhi', 'Rajasthan', 'MP', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Telangana', 'West Bengal']
  const TAGS_GOVT = ['ssc', 'upsc', 'railway', 'banking', 'police', 'teaching', 'defence']
  const TAGS_PVT = ['it', 'software', 'finance', 'hr', 'marketing', 'ai', 'devops']

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>{isGovt ? '🏛️' : '💼'} {isGovt ? 'Government Jobs' : 'Private Jobs'}</h1>
          <div className="page-header p">{isGovt ? 'Latest SSC, UPSC, Railway, Banking & State Govt vacancies' : 'Top IT, Finance, Marketing & corporate openings in India'}</div>
          <div className="job-count-tag">{filtered.length} jobs found</div>
        </div>
      </div>

      <div className="container section">
        <div className="grid-main">
          <div>
            {/* Filter Row */}
            <div className="filter-row">
              <div className="filter-input" style={{ flex: 1, minWidth: '180px' }}>
                <span className="filter-icon">🔍</span>
                <input placeholder={`Search ${isGovt ? 'govt' : 'private'} jobs...`} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <button className={`filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                ⚙ Filters {(state || activeTag) && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block' }} />}
              </button>
              {(search || state || activeTag) && <button className="clear-btn" onClick={clearFilters}>✕ Clear</button>}
            </div>

            {showFilters && (
              <div className="filter-panel">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {isGovt && (
                    <div>
                      <div className="filter-label">State</div>
                      <select className="filter-select" value={state} onChange={e => { setState(e.target.value); setPage(1); }}>
                        <option value="">All India</option>
                        {STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ gridColumn: isGovt ? 'auto' : '1/-1' }}>
                    <div className="filter-label">Category</div>
                    <div className="tag-pills">
                      {(isGovt ? TAGS_GOVT : TAGS_PVT).map(t => (
                        <button key={t} className={`tag-pill ${activeTag === t ? 'active' : ''}`} onClick={() => { setActiveTag(activeTag === t ? '' : t); setPage(1); }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Jobs */}
            {loading ? (
              <div className="jobs-grid">{[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}</div>
            ) : paged.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No jobs found</div>
                <div className="empty-text">Try different keywords or clear filters</div>
              </div>
            ) : (
              <div className="jobs-grid">
                {paged.map(j => <JobCard key={j.id} job={j} />)}
              </div>
            )}

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
