import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { daysLeft, fmtDate, timeAgo } from '../utils/helpers'

export default function JobCard({ job }) {
  const { user, savedJobs, toggleSave } = useAuth()
  const toast = useToast()
  const isSaved = savedJobs.includes(job.id)
  const dl = daysLeft(job.last_date)

  const handleSave = (e) => {
    e.stopPropagation()
    if (!user) { toast('Please sign in to save jobs', 'error'); return; }
    toggleSave(job.id)
    toast(isSaved ? 'Removed from saved' : 'Job saved! 🔖', 'success')
  }

  return (
    <div className="job-card anim-up">
      {job.is_featured && <div className="job-featured-badge">Featured</div>}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.4rem' }}>
            <span className={`job-cat-tag ${job.category}`}>
              <span className="job-cat-dot" />
              {job.category === 'govt' ? 'Govt Job' : 'Private Job'}
            </span>
            {dl !== null && dl <= 7 && dl > 0 && <span className="deadline-warn">⚡{dl}d left!</span>}
            {dl !== null && dl <= 0 && <span style={{ fontSize: '.7rem', color: 'var(--grey-5)', fontWeight: 700 }}>Expired</span>}
          </div>
          <div className="job-title">{job.title}</div>
        </div>
        <button className={`job-save-btn ${isSaved ? 'saved' : ''}`} onClick={handleSave} title={isSaved ? 'Remove saved' : 'Save job'}>
          {isSaved ? '🔖' : '🔗'}
        </button>
      </div>

      <div className="job-org">
        <span>🏢</span>
        <span>{job.organization}</span>
        {job.department && <span style={{ color: 'var(--grey-5)' }}>• {job.department}</span>}
      </div>

      <div className="job-meta">
        {(job.state || job.location) && <div className="job-meta-item"><span>📍</span>{job.state || job.location}</div>}
        {job.vacancies && <div className="job-meta-item"><span>👥</span>{job.vacancies.toLocaleString()} posts</div>}
        {job.last_date && <div className="job-meta-item"><span>📅</span>Last: {fmtDate(job.last_date)}</div>}
        {job.qualification && <div className="job-meta-item"><span>🎓</span>{job.qualification}</div>}
      </div>

      {job.salary_range && <div className="job-salary" style={{ marginBottom: '.75rem' }}>💰 {job.salary_range}</div>}

      {job.tags?.length > 0 && (
        <div className="job-tags">
          {job.tags.slice(0, 3).map(t => <span key={t} className="job-tag">{t}</span>)}
        </div>
      )}

      <div className="job-actions">
        <a href={job.apply_url} target="_blank" rel="noreferrer" className="job-apply-btn" onClick={e => e.stopPropagation()}>
          Apply Now <span>↗</span>
        </a>
        {job.notification_url && <button className="job-notif-btn" title="View notification">📄</button>}
      </div>
      <div className="job-time">{timeAgo(job.posted_at)}</div>
    </div>
  )
}
