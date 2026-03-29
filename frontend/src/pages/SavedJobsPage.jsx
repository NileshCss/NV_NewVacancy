import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useQuery } from '@tanstack/react-query'
import JobCard from '../components/JobCard'
import SkeletonCard from '../components/SkeletonCard'
import { fetchSavedJobs } from '../services/api'

export default function SavedJobsPage() {
  const { user } = useAuth()
  const { navigate } = useRouter()

  const { data: saved = [], isLoading, isError } = useQuery({
    queryKey: ['saved_jobs', user?.id],
    queryFn: () => fetchSavedJobs(user?.id),
    enabled: !!user
  })

  if (!user) return (
    <div className="empty-state" style={{ marginTop: '4rem' }}>
      <div className="empty-icon">🔒</div>
      <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Sign in to view saved jobs</div>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('login')}>Sign In</button>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <h1 style={{ color: 'var(--text-primary)' }}>🔖 Saved Jobs</h1>
          <div className="page-header p" style={{ color: 'var(--text-secondary)' }}>{saved.length} job{saved.length !== 1 ? 's' : ''} saved</div>
        </div>
      </div>
      <div className="container section">
        {isError && (
          <div className="empty-state">
             <div className="empty-icon">⚠️</div>
             <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Failed to load saved jobs</div>
             <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Could not communicate with the server.</div>
          </div>
        )}

        {isLoading ? (
           <div className="jobs-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
        ) : saved.length === 0 && !isError ? (
          <div className="empty-state">
            <div className="empty-icon">🔖</div>
            <div className="empty-title" style={{ color: 'var(--text-primary)' }}>No saved jobs yet</div>
            <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Bookmark jobs to access them here</div>
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
