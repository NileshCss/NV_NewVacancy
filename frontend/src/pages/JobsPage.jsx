import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import JobCard from '../components/JobCard'
import SkeletonCard from '../components/SkeletonCard'
import AffiliateSidebar from '../components/AffiliateSidebar'
import { fetchJobs } from '../services/api'

export default function JobsPage({ category }) {
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 6

  const isGovt = category === 'govt'

  // Fetch jobs for the selected category
  const { data: source = [], isLoading, isError } = useQuery({
    queryKey: ['jobs', category],
    queryFn: () => fetchJobs(category)
  })

  const filtered = source.filter(j => {
    const q = search.toLowerCase()
    const matchSearch = !search || j.title?.toLowerCase().includes(q) || j.organization?.toLowerCase().includes(q) || j.tags?.some(t => t.toLowerCase().includes(q))
    const matchState = !stateFilter || j.state === stateFilter || j.location?.includes(stateFilter)
    const matchTag = !activeTag || j.tags?.includes(activeTag)
    return matchSearch && matchState && matchTag
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const clearFilters = () => { setSearch(''); setStateFilter(''); setActiveTag(''); setPage(1); }

  const STATES = ['UP', 'Bihar', 'Maharashtra', 'Delhi', 'Rajasthan', 'MP', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Telangana', 'West Bengal']
  const TAGS_GOVT = ['ssc', 'upsc', 'railway', 'banking', 'police', 'teaching', 'defence']
  const TAGS_PVT = ['it', 'software', 'finance', 'hr', 'marketing', 'ai', 'devops']

  return (
    <div>
      <div className="page-header" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <h1 style={{ color: 'var(--text-primary)' }}>{isGovt ? '🏛️' : '💼'} {isGovt ? 'Government Jobs' : 'Private Jobs'}</h1>
          <div className="page-header p" style={{ color: 'var(--text-secondary)' }}>{isGovt ? 'Latest SSC, UPSC, Railway, Banking & State Govt vacancies' : 'Top IT, Finance, Marketing & corporate openings in India'}</div>
          <div className="job-count-tag" style={{ color: 'var(--brand)' }}>{filtered.length} jobs found</div>
        </div>
      </div>

      <div className="container section">
        <div className="grid-main">
          <div>
            {/* Filter Row */}
            <div className="filter-row">
              <div className="filter-input" style={{ flex: 1, minWidth: '180px' }}>
                <span className="filter-icon">🔍</span>
                <input style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }} placeholder={`Search ${isGovt ? 'govt' : 'private'} jobs...`} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <button style={{ background: 'var(--bg-input)', color: showFilters ? 'var(--brand)' : 'var(--text-secondary)' }} className={`filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                ⚙ Filters {(stateFilter || activeTag) && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block' }} />}
              </button>
              {(search || stateFilter || activeTag) && <button style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }} className="clear-btn" onClick={clearFilters}>✕ Clear</button>}
            </div>

            {showFilters && (
              <div className="filter-panel" style={{ background: 'var(--bg-card)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {isGovt && (
                    <div>
                      <div className="filter-label" style={{ color: 'var(--text-muted)' }}>State</div>
                      <select style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }} className="filter-select" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }}>
                        <option value="">All India</option>
                        {STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ gridColumn: isGovt ? 'auto' : '1/-1' }}>
                    <div className="filter-label" style={{ color: 'var(--text-muted)' }}>Category</div>
                    <div className="tag-pills">
                      {(isGovt ? TAGS_GOVT : TAGS_PVT).map(t => (
                        <button key={t} style={{ color: activeTag === t ? 'var(--brand)' : 'var(--text-secondary)' }} className={`tag-pill ${activeTag === t ? 'active' : ''}`} onClick={() => { setActiveTag(activeTag === t ? '' : t); setPage(1); }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Jobs */}
            {isError ? (
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Failed to load jobs</div>
                <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Please check your connection or try again later.</div>
              </div>
            ) : isLoading ? (
              <div className="jobs-grid">{[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}</div>
            ) : paged.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title" style={{ color: 'var(--text-primary)' }}>No jobs found</div>
                <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Try different keywords or clear filters</div>
              </div>
            ) : (
              <div className="jobs-grid">
                {paged.map(j => <JobCard key={j.id} job={j} />)}
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
                <button style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }} className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className="page-info" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                <button style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }} className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>
          <aside className="sidebar"><AffiliateSidebar /></aside>
        </div>
      </div>
    </div>
  )
}
