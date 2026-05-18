import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useQuery } from '@tanstack/react-query'
import JobCard from '../components/JobCard'
import SkeletonCard from '../components/SkeletonCard'
import JobApplyModal from '../components/jobs/JobApplyModal'
import { fetchSavedJobs } from '../services/api'

export default function SavedJobsPage() {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const [selectedJob, setSelectedJob] = useState(null)

  const { data: saved = [], isLoading, isError } = useQuery({
    queryKey: ['saved_jobs', user?.id],
    queryFn: () => fetchSavedJobs(user?.id),
    enabled: !!user
  })

  const handleApplyClick = (job) => {
    setSelectedJob(job)
  }

  if (!user) return (
    <div className="empty-state" style={{ marginTop: '4rem' }}>
      <div className="empty-icon">🔒</div>
      <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Sign in to view saved jobs</div>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('login')}>Sign In</button>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ background: 'var(--bg-surface)', position: 'relative', overflow: 'hidden' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
          <div style={{ flex: 1, maxWidth: '60%' }}>
            <h1 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              🔖 Saved Jobs
            </h1>
            <div className="page-header p" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Jobs you've bookmarked for later. Keep track of opportunities you're interested in.
            </div>
            <div className="job-count-tag" style={{ color: 'var(--brand)', fontSize: '1rem', fontWeight: '700' }}>
              {saved.length} job{saved.length !== 1 ? 's' : ''} saved
            </div>
          </div>
          
          {/* Illustration SVG */}
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '250px', opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 240 180" width="240" height="180" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
              {/* Bookmark icons */}
              <g>
                <rect x="30" y="40" width="50" height="70" fill="var(--brand)" opacity="0.7" rx="4" />
                <path d="M40 45 L40 105 L55 90 L70 105 L70 45" fill="var(--brand)" opacity="0.9" />
                <rect x="100" y="60" width="50" height="70" fill="var(--brand)" opacity="0.5" rx="4" />
                <path d="M110 65 L110 125 L125 110 L140 125 L140 65" fill="var(--brand)" opacity="0.7" />
                <rect x="170" y="50" width="50" height="70" fill="var(--brand)" opacity="0.6" rx="4" />
                <path d="M180 55 L180 115 L195 100 L210 115 L210 55" fill="var(--brand)" opacity="0.8" />
              </g>
            </svg>
          </div>
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
           <div className="jobs-grid">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
        ) : saved.length === 0 && !isError ? (
          <div className="empty-state">
            <div className="empty-icon">🔖</div>
            <div className="empty-title" style={{ color: 'var(--text-primary)' }}>No saved jobs yet</div>
            <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Bookmark jobs to access them here</div>
            <button className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={() => navigate('govt-jobs')}>Browse Jobs</button>
          </div>
        ) : (
          <div className="jobs-grid">
            {saved.map(j => <JobCard key={j.id} job={j} onApplyClick={handleApplyClick} />)}
          </div>
        )}
      </div>

      <JobApplyModal 
        job={selectedJob} 
        isOpen={!!selectedJob} 
        onClose={() => setSelectedJob(null)} 
        isSavedInitially={true}
      />
    </div>
  )
}
