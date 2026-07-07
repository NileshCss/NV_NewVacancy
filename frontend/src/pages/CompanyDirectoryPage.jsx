import { useState, useEffect } from 'react'
import { useRouter } from '../context/RouterContext'

export default function CompanyDirectoryPage() {
  const { navigate } = useRouter()
  // Mock companies for directory, ideally fetched from a /api/companies endpoint
  // We'll show a "Under Construction" or a static list for now, as the API isn't fully robust for just companies yet.

  return (
    <div className="page-wrap anim-fade">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div className="container">
          <h1>🏢 Company Directory</h1>
          <p>Browse top employers actively hiring freshers.</p>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <div className="empty-state">
          <div className="empty-icon">🚧</div>
          <h3 className="empty-title">Coming Soon</h3>
          <p className="empty-text">We are building a comprehensive company directory with insights and reviews.</p>
          <button className="btn btn-primary" onClick={() => navigate('jobs')} style={{ marginTop: '1.5rem' }}>
            Browse All Jobs
          </button>
        </div>
      </div>
    </div>
  )
}
