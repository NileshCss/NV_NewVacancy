import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggleSavedJob } from '../../services/api'

/**
 * JobApplyModal — popup that appears when user clicks "Apply Now"
 * Mirrors the existing JobCard light/dark styles exactly.
 */
export default function JobApplyModal({ job, isOpen, onClose, isSavedInitially = false }) {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  
  const [applyState, setApplyState] = useState('idle') // idle | loading | success
  const [isSaved, setIsSaved] = useState(isSavedInitially)

  // Sync with prop when it changes
  useEffect(() => {
    setIsSaved(isSavedInitially)
  }, [isSavedInitially])

  // ── Lock body scroll while open ────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── Escape key closes ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // ── Reset state when a new job is opened ───────────────────
  useEffect(() => {
    if (isOpen && job?.id) {
      setApplyState('idle')
    }
  }, [job?.id, isOpen])

  const mutation = useMutation({
    mutationFn: () => toggleSavedJob(user?.id, job.id),
    onSuccess: (isNowSaved) => {
      setIsSaved(isNowSaved)
      queryClient.invalidateQueries({ queryKey: ['saved_jobs', user?.id] })
      toast(isNowSaved ? 'Job saved! 🔖' : 'Removed from saved', 'success')
    },
    onError: () => toast('Failed to save job', 'error'),
  })

  const handleSave = () => {
    if (!user) { toast('Please sign in to save jobs', 'error'); return }
    mutation.mutate()
  }

  const handleApply = () => {
    if (applyState !== 'idle') return
    setApplyState('loading')
    setTimeout(() => {
      window.open(job.apply_url, '_blank', 'noopener,noreferrer')
      setApplyState('success')
      setTimeout(onClose, 1200)
    }, 700)
  }

  if (!isOpen || !job) return null

  const applyLabel = {
    idle: 'Apply Now ↗',
    loading: 'Redirecting...',
    success: '✓ Opening...',
  }[applyState]

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────── */}
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
        }}
      />

      {/* ── Modal box ───────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        className="job-card"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 1001,
          width: 'calc(100% - 2rem)',
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
          borderRadius: '24px',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          animation: 'nv-popup 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Orange top bar */}
        <div style={{ height: '4px', background: 'var(--brand)', flexShrink: 0 }} />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'var(--white-8)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            cursor: 'pointer',
            border: '1px solid var(--border)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          ✕
        </button>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ padding: '1.5rem 1.5rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          {/* Badge */}
          <div style={{ marginBottom: '.75rem' }}>
            <span className={`job-cat-tag ${job.category}`}>
              <span className="job-cat-dot" />
              {job.category === 'govt' ? 'Govt Job' : 'Private Job'}
            </span>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '1.3rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            marginBottom: '.75rem',
            fontFamily: 'Sora, sans-serif'
          }}>
            {job.title}
          </h2>

          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>🏢 {job.organization}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>📍 {job.state || job.location}</span>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Salary',   value: job.salary_range  || 'Not specified', icon: '💰' },
              { label: 'Vacancies', value: job.vacancies ? `${job.vacancies.toLocaleString()} posts` : 'Not specified', icon: '👥' },
              { label: 'Qualification', value: job.qualification || 'Not specified', icon: '🎓' },
              { label: 'Last Date', value: job.last_date ? new Date(job.last_date).toLocaleDateString() : 'N/A', icon: '📅' },
            ].map(item => (
              <div key={item.label} style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '0.75rem'
              }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.icon} {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Job Description */}
          {job.job_description && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                fontSize: '0.65rem', 
                textTransform: 'uppercase', 
                letterSpacing: '0.1em', 
                color: 'var(--text-muted)', 
                marginBottom: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ width: '12px', height: '1px', background: 'var(--border)' }} />
                Job Description
              </div>
              <div style={{ 
                fontSize: '0.92rem', 
                color: 'var(--text-secondary)', 
                lineHeight: 1.6,
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '0.75rem',
                scrollbarWidth: 'thin',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {job.job_description.split(/[•\n]/).map(p => p.trim()).filter(p => p.length > 0).map((point, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                      <span style={{ 
                        color: 'var(--brand)', 
                        fontSize: '1.4rem', 
                        lineHeight: 0.8,
                        marginTop: '0.1rem',
                        userSelect: 'none'
                      }}>•</span>
                      <span style={{ 
                        flex: 1, 
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontWeight: 450,
                        letterSpacing: '-0.01em'
                      }}>
                        {point}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Apply URL preview */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            fontSize: '0.75rem', 
            color: 'var(--text-muted)', 
            background: 'var(--bg-input)', 
            padding: '0.6rem 0.8rem', 
            borderRadius: '10px',
            border: '1px solid var(--border)'
          }}>
            <span>🔗</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {job.apply_url}
            </span>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button
            className="job-apply-btn"
            onClick={handleApply}
            disabled={applyState !== 'idle'}
            style={{
              flex: 1,
              background: applyState === 'success' ? 'var(--green)' : 'var(--brand)',
              opacity: applyState === 'loading' ? 0.8 : 1
            }}
          >
            {applyLabel}
          </button>

          {user && (
            <button
              className={`job-save-btn ${isSaved ? 'saved' : ''}`}
              onClick={handleSave}
              disabled={mutation.isPending}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: isSaved ? 'rgba(249,115,22,0.1)' : 'var(--bg-input)',
                border: `1px solid ${isSaved ? 'var(--brand)' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}
            >
              {isSaved ? '🔖' : '🔗'}
            </button>
          )}
        </div>

      </div>

      <style>{`
        @keyframes nv-popup {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  )
}
