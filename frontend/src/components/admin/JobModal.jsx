/**
 * JobModal — Add / Edit job modal
 * Uses api.js (addJob / updateJob) which no longer call .select().single()
 * so they don't hang when SELECT RLS policy is missing.
 */
import React, { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../context/AuthContext'

const DEFAULTS = {
  title: '', organization: '', location: 'All India',
  salary_range: '', apply_url: '', job_description: '',
  category: 'govt', is_featured: false, is_active: true,
}

const S = {
  input: {
    width: '100%', background: 'var(--bg-input,#1e293b)',
    color: 'var(--text-primary,#f1f5f9)',
    border: '1px solid var(--border,rgba(255,255,255,.12))',
    borderRadius: '8px', padding: '10px 14px', fontSize: '14px',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color .18s',
  },
  label: {
    display: 'block', fontSize: '11px', fontWeight: '700',
    letterSpacing: '0.07em', textTransform: 'uppercase',
    color: 'var(--text-muted,#64748b)', marginBottom: '6px',
  },
}

const Spinner = () => (
  <span style={{
    width: 14, height: 14, flexShrink: 0, display: 'inline-block',
    border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff',
    borderRadius: '50%', animation: '_jm_spin .7s linear infinite',
  }} />
)

const Toggle = ({ active, onToggle, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', userSelect: 'none' }}>
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      style={{
        position: 'relative', width: 46, height: 26,
        borderRadius: 999, border: 'none', cursor: 'pointer',
        flexShrink: 0, padding: 0, overflow: 'hidden',
        background: active
          ? 'linear-gradient(135deg,#22c55e,#16a34a)'
          : 'rgba(100,116,139,0.35)',
        boxShadow: active
          ? '0 0 0 1px rgba(34,197,94,.5),0 2px 8px rgba(34,197,94,.2)'
          : '0 0 0 1px rgba(100,116,139,.4)',
        transition: 'background .22s, box-shadow .22s',
      }}
    >
      {/* Label */}
      <span style={{
        position: 'absolute', fontSize: '9px', fontWeight: 700, lineHeight: 1,
        color: active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.4)',
        left: active ? 6 : 'auto', right: active ? 'auto' : 5,
        top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
      }}>{active ? 'ON' : 'OFF'}</span>
      {/* Thumb */}
      <span style={{
        position: 'absolute', width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        top: 3, left: active ? 23 : 3,
        transition: 'left .22s cubic-bezier(.4,0,.2,1)', pointerEvents: 'none',
      }} />
    </button>
    <span style={{ fontSize: '.85rem', color: 'var(--text-secondary,#94a3b8)' }}>
      {label}
    </span>
  </label>
)

export default function JobModal({ editJob, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const isEdit = Boolean(editJob?.id)

  const [form, setForm] = useState(() =>
    isEdit ? {
      title:           editJob.title           ?? '',
      organization:    editJob.organization    ?? '',
      location:        editJob.location        ?? 'All India',
      salary_range:    editJob.salary_range    ?? '',
      apply_url:       editJob.apply_url       ?? '',
      job_description: editJob.job_description ?? '',
      category:        editJob.category        ?? 'govt',
      is_featured:     editJob.is_featured     ?? false,
      is_active:       editJob.is_active       ?? true,
    } : { ...DEFAULTS }
  )

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set  = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const tog  = (k) => ()   => setForm(f => ({ ...f, [k]: !f[k] }))
  const focus = (e) => { e.target.style.borderColor = 'var(--brand,#f97316)' }
  const blur  = (e) => { e.target.style.borderColor = 'var(--border,rgba(255,255,255,.12))' }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // ── Client-side validation ───────────────────────────────────
    if (!form.title?.trim())        { setError('Job Title is required');    return }
    if (!form.organization?.trim()) { setError('Organization is required'); return }
    if (!form.apply_url?.trim())    { setError('Apply URL is required');    return }

    try {
      const u = new URL(form.apply_url.trim())
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
    } catch { setError('Apply URL must be a valid https:// link'); return }

    setSaving(true)

    // ── Timeout safety net ───────────────────────────────────────
    const timeout = setTimeout(() => {
      setSaving(false)
      setError('Request timed out. Please check your connection.')
    }, 15000)

    try {
      console.log('=== JOB SAVE DEBUG ===')
      console.log('Mode:', isEdit ? 'UPDATE' : 'INSERT')
      console.log('Job ID:', editJob?.id)
      console.log('User:', user?.id)
      console.log('User role:', profile?.role)

      // Build payload with ONLY columns that exist in your DB
      const payload = {
        title:           form.title.trim(),
        organization:    form.organization.trim(),
        location:        form.location?.trim() || 'All India',
        salary_range:    form.salary_range?.trim() || '',
        job_description: form.job_description?.trim() || '',
        apply_url:       form.apply_url.trim(),
        category:        form.category || 'govt',
        is_featured:     Boolean(form.is_featured),
        is_active:       Boolean(form.is_active),
        updated_at:      new Date().toISOString(),
      }

      console.log('[JobModal] Payload:', payload)

      let data, error

      if (isEdit) {
        // ── UPDATE ──
        const res = await supabase
          .from('jobs')
          .update(payload)
          .eq('id', editJob.id)
          .select()
          .single()
        data = res.data
        error = res.error
      } else {
        // ── INSERT ──
        payload.created_at = new Date().toISOString()
        payload.created_by = user?.id || null
        
        const res = await supabase
          .from('jobs')
          .insert([payload])
          .select()
          .single()
        data = res.data
        error = res.error
      }

      // Always check error first
      if (error) {
        console.error('[JobModal] Supabase error:', error)
        
        const errorMessages = {
          '23505': 'A job with this information already exists.',
          '23502': 'A required field is missing. Check all fields.',
          '23503': 'Invalid reference. Please check category or user.',
          '42501': 'Permission denied. Make sure you are logged in as admin.',
          'PGRST116': 'No rows returned. The job may not exist.',
          'PGRST301': 'Database connection failed. Please try again.',
        }

        const userMessage = errorMessages[error.code] || error.message || 'Failed to save job.'
        setError(userMessage)
        setSaving(false)
        clearTimeout(timeout)
        return
      }

      console.log('[JobModal] Success:', data)

      // Notify parent to refresh job list
      if (typeof onSaved === 'function') onSaved(data)
      
      // Close modal
      onClose()

    } catch (err) {
      console.error('[JobModal] Unexpected error:', err)
      setError(err.message || 'An unexpected error occurred. Please try again.')
    } finally {
      clearTimeout(timeout)
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`@keyframes _jm_spin { to { transform: rotate(360deg); } }`}</style>
      <div
        className="modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose?.() }}
      >
        <div className="modal" style={{
          background: 'var(--bg-surface)',
          maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* ── Header ── */}
          <div className="modal-header" style={{
            position: 'sticky', top: 0, zIndex: 2,
            background: 'var(--bg-surface)',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border,rgba(255,255,255,.08))',
          }}>
            <div className="modal-title" style={{ color: 'var(--text-primary)' }}>
              {isEdit ? '✏️ Edit Job' : '➕ Add New Job'}
            </div>
            <button className="modal-close" onClick={() => !saving && onClose?.()}>✕</button>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,.12)',
              border: '1px solid rgba(239,68,68,.35)',
              borderRadius: 8, padding: '10px 14px',
              marginTop: '1rem',
              color: '#f87171', fontSize: '.84rem', lineHeight: 1.5,
              display: 'flex', gap: '.5rem',
            }}>
              <span style={{ flexShrink: 0 }}>❌</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate style={{ paddingTop: '1.25rem', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Title */}
              <div>
                <label style={S.label} htmlFor="jm-title">Job Title *</label>
                <input id="jm-title" type="text" placeholder="e.g. Software Engineer"
                  style={S.input} value={form.title}
                  onChange={set('title')} onFocus={focus} onBlur={blur}
                  disabled={saving} />
              </div>

              {/* Org + Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={S.label} htmlFor="jm-org">Organization *</label>
                  <input id="jm-org" type="text" placeholder="e.g. UPSC, Wipro"
                    style={S.input} value={form.organization}
                    onChange={set('organization')} onFocus={focus} onBlur={blur}
                    disabled={saving} />
                </div>
                <div>
                  <label style={S.label} htmlFor="jm-loc">Location</label>
                  <input id="jm-loc" type="text" placeholder="All India"
                    style={S.input} value={form.location}
                    onChange={set('location')} onFocus={focus} onBlur={blur}
                    disabled={saving} />
                </div>
              </div>

              {/* Salary */}
              <div>
                <label style={S.label} htmlFor="jm-sal">Salary Range</label>
                <input id="jm-sal" type="text" placeholder="₹35,000 – ₹75,000"
                  style={S.input} value={form.salary_range}
                  onChange={set('salary_range')} onFocus={focus} onBlur={blur}
                  disabled={saving} />
              </div>

              {/* Apply URL */}
              <div>
                <label style={S.label} htmlFor="jm-url">Apply URL *</label>
                <input id="jm-url" type="text" placeholder="https://..."
                  style={S.input} value={form.apply_url}
                  onChange={set('apply_url')} onFocus={focus} onBlur={blur}
                  disabled={saving} />
              </div>

              {/* Description */}
              <div>
                <label style={S.label} htmlFor="jm-desc">Job Description</label>
                <textarea id="jm-desc" rows={4}
                  placeholder="Use bullets (•) or newlines for a list..."
                  style={{ ...S.input, resize: 'vertical', minHeight: '90px', lineHeight: 1.6 }}
                  value={form.job_description}
                  onChange={set('job_description')}
                  onFocus={focus} onBlur={blur}
                  disabled={saving}
                />
                
                {/* Live Preview */}
                {form.job_description && (
                  <div style={{ 
                    marginTop: '0.75rem', 
                    padding: '1rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: '8px',
                    border: '1px dashed var(--border)'
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Live Preview</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {form.job_description.split(/[•\n]/).map(p => p.trim()).filter(p => p.length > 0).map((point, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <span style={{ color: 'var(--brand)' }}>•</span>
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label style={S.label} htmlFor="jm-cat">Category</label>
                <select id="jm-cat" style={{ ...S.input, cursor: 'pointer' }}
                  value={form.category} onChange={set('category')} disabled={saving}>
                  <option value="govt">Government</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: '1.75rem', paddingTop: '.25rem' }}>
                <Toggle active={form.is_featured} onToggle={tog('is_featured')} label="Featured" />
                <Toggle active={form.is_active}   onToggle={tog('is_active')}   label="Active"   />
              </div>
            </div>

            {/* ── Actions ── */}
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={saving}
              >
                {saving
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}>
                      <Spinner /> Saving...
                    </span>
                  : isEdit ? '✔ Update Job' : '✔ Save Job'
                }
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onClose?.()}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
