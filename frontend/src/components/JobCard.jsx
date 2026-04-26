import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { daysLeft, fmtDate, timeAgo } from '../utils/helpers'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSavedJobs, toggleSavedJob } from '../services/api'

export default function JobCard({ job }) {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: saved = [] } = useQuery({
    queryKey: ['saved_jobs', user?.id],
    queryFn: () => fetchSavedJobs(user?.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  })

  const isSaved = !!saved?.find(s => s.id === job.id)
  const dl = daysLeft(job.last_date)

  const mutation = useMutation({
    mutationFn: () => toggleSavedJob(user?.id, job.id),
    onSuccess: (isNowSaved) => {
      queryClient.invalidateQueries({ queryKey: ['saved_jobs', user?.id] })
      toast(isNowSaved ? 'Job saved! 🔖' : 'Removed from saved', 'success')
    },
    onError: () => toast('Failed to save job', 'error'),
  })

  const handleSave = (e) => {
    e.stopPropagation()
    if (!user) { toast('Please sign in to save jobs', 'error'); return }
    mutation.mutate()
  }

  return (
    <div className="job-card anim-up" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

      {/* Featured badge */}
      {job.is_featured && (
        <div className="job-featured-badge" style={{ background: 'var(--brand)' }}>Featured</div>
      )}

      {/* ── HEADER: category + save ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem', marginBottom: '.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' }}>
          <span className={`job-cat-tag ${job.category}`}>
            <span className="job-cat-dot" />
            {job.category === 'govt' ? 'Govt Job' : 'Private Job'}
          </span>
          {dl !== null && dl <= 7 && dl > 0 && (
            <span className="deadline-warn" style={{ color: 'var(--red)' }}>⚡{dl}d left!</span>
          )}
          {dl !== null && dl <= 0 && (
            <span style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Expired</span>
          )}
        </div>
        <button
          className={`job-save-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          title={isSaved ? 'Remove saved' : 'Save job'}
          style={{ flexShrink: 0 }}
        >
          {isSaved ? '🔖' : '🔗'}
        </button>
      </div>

      {/* ── BODY: grows to push footer down ── */}
      <div className="job-card-body">

        {/* Title — always 2-line clamped, min-height reserved */}
        <div className="job-title" style={{ color: 'var(--text-primary)' }}>{job.title}</div>

        {/* Organisation */}
        <div className="job-org" style={{ color: 'var(--text-secondary)' }}>
          <span>🏢</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.organization}</span>
          {job.department && (
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>• {job.department}</span>
          )}
        </div>

        {/* Meta grid — location, posts, date, qualification */}
        <div className="job-meta">
          {(job.state || job.location) && (
            <div className="job-meta-item" style={{ color: 'var(--text-muted)' }}>
              <span>📍</span><span>{job.state || job.location}</span>
            </div>
          )}
          {job.vacancies && (
            <div className="job-meta-item" style={{ color: 'var(--text-muted)' }}>
              <span>👥</span><span>{job.vacancies.toLocaleString()} posts</span>
            </div>
          )}
          {job.last_date && (
            <div className="job-meta-item" style={{ color: 'var(--text-muted)' }}>
              <span>📅</span><span>Last: {fmtDate(job.last_date)}</span>
            </div>
          )}
          {job.qualification && (
            <div className="job-meta-item" style={{ color: 'var(--text-muted)' }}>
              <span>🎓</span><span>{job.qualification}</span>
            </div>
          )}
        </div>

        {/* Salary */}
        {job.salary_range && (
          <div className="job-salary" style={{ color: 'var(--green)' }}>💰 {job.salary_range}</div>
        )}

        {/* Tags */}
        {job.tags?.length > 0 && (
          <div className="job-tags">
            {job.tags.slice(0, 3).map(t => (
              <span key={t} className="job-tag" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Spacer — pushes Apply button to bottom regardless of content length */}
        <div className="job-spacer" />

        {/* ── FOOTER: always at bottom ── */}
        <div className="job-actions">
          <a
            href={job.apply_url}
            target="_blank"
            rel="noreferrer"
            className="job-apply-btn"
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            Apply Now <span>↗</span>
          </a>
          {job.notification_url && (
            <button
              className="job-notif-btn"
              title="View notification"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              📄
            </button>
          )}
        </div>

        <div className="job-time" style={{ color: 'var(--text-muted)' }}>{timeAgo(job.posted_at)}</div>
      </div>
    </div>
  )
}
