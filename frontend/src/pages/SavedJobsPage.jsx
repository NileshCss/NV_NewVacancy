import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import JobCard from '../components/JobCard'
import { ALL_JOBS } from '../data/mockData'

export default function SavedJobsPage() {
  const { savedJobs, user } = useAuth()
  const { navigate } = useRouter()
  const saved = ALL_JOBS.filter(j => savedJobs.includes(j.id))

  if (!user) return (
    <div className="empty-state" style={{ marginTop: '4rem' }}>
      <div className="empty-icon">🔒</div>
      <div className="empty-title">Sign in to view saved jobs</div>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('login')}>Sign In</button>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>🔖 Saved Jobs</h1>
          <div className="page-header p">{saved.length} job{saved.length !== 1 ? 's' : ''} saved</div>
        </div>
      </div>
      <div className="container section">
        {saved.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔖</div>
            <div className="empty-title">No saved jobs yet</div>
            <div className="empty-text">Bookmark jobs to access them here</div>
            <button className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={() => navigate('govt-jobs')}>Browse Jobs</button>
          </div>
        ) : (
          <div className="jobs-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
            {saved.map(j => <JobCard key={j.id} job={j} />)}
          </div>
        )}
      </div>
    </div>
  )
}
