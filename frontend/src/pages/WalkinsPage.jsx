import { useState, useEffect } from 'react'
import { useRouter } from '../context/RouterContext'
import JobCard from '../components/JobCard'

export default function WalkinsPage() {
  const { navigate } = useRouter()
  const [walkins, setWalkins] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('week') // 'today', 'tomorrow', 'week', 'month'

  useEffect(() => {
    fetchWalkins()
  }, [period])

  const fetchWalkins = async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/api/walkins?period=${period}`)
      const data = await res.json()
      if (data.success) {
        setWalkins(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch walk-ins:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="page-wrap anim-fade">
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div className="container">
          <h1>🚀 Walk-In Drives</h1>
          <p>Direct interview opportunities. No shortlisting, just walk in and prove your skills.</p>
          <div className="job-count-tag">{walkins.length} Drives available</div>
        </div>
      </div>

      <div className="container">
        {/* TABS */}
        <div className="cat-tabs">
          {[
            { id: 'today',    label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'week',     label: 'This Week' },
            { id: 'month',    label: 'This Month' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`cat-tab ${period === tab.id ? 'active' : ''}`}
              onClick={() => setPeriod(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="jobs-grid">
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 320 }} />)}
          </div>
        ) : walkins.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏜️</div>
            <h3 className="empty-title">No walk-ins scheduled</h3>
            <p className="empty-text">There are no walk-in drives for the selected period.</p>
          </div>
        ) : (
          <div className="jobs-grid">
            {walkins.map((w, idx) => (
              <div key={w.id} className="job-card anim-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className="job-card-body">
                  <div className="job-cat-tag private">
                    <div className="job-cat-dot" />
                    Walk-In Drive
                  </div>
                  <h3 className="job-title" onClick={() => navigate(`jobs/${w.jobs?.slug}`)}>
                    {w.jobs?.title || 'Unknown Role'}
                  </h3>
                  <div className="job-org">
                    🏢 {w.jobs?.organization}
                  </div>
                  
                  <div className="job-meta" style={{ marginTop: '1rem', background: 'var(--white-5)', padding: '0.8rem', borderRadius: '12px' }}>
                    <div className="job-meta-item" style={{ gridColumn: '1 / -1', color: '#fff', fontWeight: 600 }}>
                      📅 {formatDate(w.date)} • {w.start_time?.slice(0,5)} to {w.end_time?.slice(0,5)}
                    </div>
                    <div className="job-meta-item" style={{ gridColumn: '1 / -1' }}>
                      📍 {w.venue || w.jobs?.location}
                    </div>
                  </div>

                  <div className="job-meta">
                    <div className="job-meta-item">🎓 {w.jobs?.qualification || 'Any Grad'}</div>
                    <div className="job-meta-item">💰 {w.jobs?.salary_range || 'Not Disclosed'}</div>
                  </div>

                  {w.required_docs?.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--brand-l)', marginBottom: '1rem', background: 'rgba(249,115,22,0.1)', padding: '0.4rem 0.6rem', borderRadius: '8px' }}>
                      <strong>Bring:</strong> {w.required_docs.join(', ')}
                    </div>
                  )}
                  
                  <div className="job-spacer" />
                  
                  <div className="job-actions">
                    <button className="job-apply-btn" onClick={() => navigate(`jobs/${w.jobs?.slug}`)}>
                      View Details
                    </button>
                    {w.map_url && (
                      <a href={w.map_url} target="_blank" rel="noreferrer" className="job-notif-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                        🗺️ Map
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
