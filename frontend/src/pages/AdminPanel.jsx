import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchJobs, addJob, deleteJob,
  fetchNews, addNews, deleteNews,
  fetchAffiliates, addAffiliate, deleteAffiliate,
  fetchUsers, updateRole,
} from '../services/api'
import { timeAgo } from '../utils/helpers'
import AIAssistantPanel from './admin/AIAssistantPanel'

// ── Default form states ────────────────────────────────────────
const JOB_DEFAULTS  = { title: '', organization: '', category: 'govt', location: 'All India', apply_url: '', salary_range: '', vacancies: '', last_date: '' }
const NEWS_DEFAULTS = { title: '', summary: '', source_name: '', source_url: '', category: 'govt' }
const AFF_DEFAULTS  = { name: '', description: '', redirect_url: '', category: 'exam-prep', emoji: '📚', placement: 'sidebar' }

const INPUT = { background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }

export default function AdminPanel() {
  const { isAdmin, profile, loadingAuth } = useAuth()
  const { navigate } = useRouter()
  const toast        = useToast()
  const queryClient  = useQueryClient()

  // ── Section nav ───────────────────────────────────────────────
  const [section, setSection] = useState('dashboard')

  // ── Modal open/close flags ────────────────────────────────────
  const [showAddJob,  setShowAddJob]  = useState(false)
  const [showAddNews, setShowAddNews] = useState(false)
  const [showAddAff,  setShowAddAff]  = useState(false)

  // ── Inline form states (top-level, no nested hooks) ───────────
  const [jobForm,  setJobForm]  = useState(JOB_DEFAULTS)
  const [newsForm, setNewsForm] = useState(NEWS_DEFAULTS)
  const [affForm,  setAffForm]  = useState(AFF_DEFAULTS)

  // ── Data queries ──────────────────────────────────────────────
  const { data: jobs  = [] } = useQuery({ queryKey: ['admin_jobs'],  queryFn: () => fetchJobs(),     enabled: isAdmin })
  const { data: news  = [] } = useQuery({ queryKey: ['admin_news'],  queryFn: fetchNews,              enabled: isAdmin })
  const { data: affs  = [] } = useQuery({ queryKey: ['admin_affs'],  queryFn: fetchAffiliates,        enabled: isAdmin })
  const { data: users = [] } = useQuery({ queryKey: ['admin_users'], queryFn: fetchUsers,             enabled: isAdmin })

  // ── Mutations ─────────────────────────────────────────────────
  const addJobMut = useMutation({
    mutationFn: addJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] })
      toast('Job added! ✅', 'success')
      setShowAddJob(false)
      setJobForm(JOB_DEFAULTS)
    },
    onError: (err) => toast(err.message || 'Failed to add job', 'error'),
  })

  const addNewsMut = useMutation({
    mutationFn: addNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_news'] })
      toast('News article added! ✅', 'success')
      setShowAddNews(false)
      setNewsForm(NEWS_DEFAULTS)
    },
    onError: (err) => toast(err.message || 'Failed to add news', 'error'),
  })

  const addAffMut = useMutation({
    mutationFn: addAffiliate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_affs'] })
      toast('Affiliate added! ✅', 'success')
      setShowAddAff(false)
      setAffForm(AFF_DEFAULTS)
    },
    onError: (err) => toast(err.message || 'Failed to add affiliate', 'error'),
  })

  const deleteJobMut  = useMutation({ mutationFn: deleteJob,      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_jobs']  }); toast('Job deleted',       'success') }, onError: (e) => toast(e.message, 'error') })
  const deleteNewsMut = useMutation({ mutationFn: deleteNews,     onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_news']  }); toast('News deleted',      'success') }, onError: (e) => toast(e.message, 'error') })
  const deleteAffMut  = useMutation({ mutationFn: deleteAffiliate,onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_affs']  }); toast('Affiliate deleted', 'success') }, onError: (e) => toast(e.message, 'error') })
  const updateRoleMut = useMutation({ mutationFn: ({ id, role }) => updateRole(id, role), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast('Role updated', 'success') }, onError: (e) => toast(e.message, 'error') })

  // ── Form submit handlers ──────────────────────────────────────
  const saveJob = (e) => {
    e.preventDefault()

    // ── Client-side validation ──────────────────────────────────
    if (!jobForm.title.trim()) { toast('Job Title is required', 'error'); return }
    if (!jobForm.organization.trim()) { toast('Organization is required', 'error'); return }
    if (!jobForm.apply_url.trim()) { toast('Apply URL is required', 'error'); return }

    // Validate that apply_url is an actual URL
    try {
      const url = new URL(jobForm.apply_url.trim())
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol')
    } catch {
      toast('Apply URL must be a valid URL starting with https://', 'error')
      return
    }

    addJobMut.mutate({
      ...jobForm,
      title:       jobForm.title.trim(),
      organization: jobForm.organization.trim(),
      apply_url:   jobForm.apply_url.trim(),
      location:    jobForm.location.trim() || 'All India',
      vacancies:   parseInt(jobForm.vacancies) || 0,
      is_featured: false,
      is_active:   true,
      tags:        [],
    })
  }

  const saveNews = (e) => {
    e.preventDefault()
    if (!newsForm.title.trim())       { toast('Title is required', 'error'); return }
    if (!newsForm.source_name.trim()) { toast('Source Name is required', 'error'); return }
    // Validate source_url if provided
    if (newsForm.source_url.trim()) {
      try { new URL(newsForm.source_url.trim()) }
      catch { toast('Source URL must be a valid URL', 'error'); return }
    }
    addNewsMut.mutate({ ...newsForm, is_featured: false, is_active: true })
  }

  const saveAff = (e) => {
    e.preventDefault()
    if (!affForm.name.trim()) { toast('Name is required', 'error'); return }
    if (!affForm.redirect_url.trim()) { toast('Redirect URL is required', 'error'); return }
    try {
      const url = new URL(affForm.redirect_url.trim())
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol')
    } catch {
      toast('Redirect URL must be a valid URL starting with https://', 'error')
      return
    }
    addAffMut.mutate({ ...affForm, clicks: 0, is_active: true })
  }

  // ── Guards ────────────────────────────────────────────────────
  if (loadingAuth) return (
    <div className="empty-state" style={{ marginTop: '5rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
    </div>
  )

  if (!profile) return (
    <div className="empty-state" style={{ marginTop: '5rem' }}>
      <div className="empty-icon">🔒</div>
      <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Sign In Required</div>
      <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Please sign in to access the Admin Panel</div>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('login')}>Sign In</button>
    </div>
  )

  if (!isAdmin && profile?.role !== 'admin') return (
    <div className="empty-state" style={{ marginTop: '5rem' }}>
      <div className="empty-icon">🔒</div>
      <div className="empty-title" style={{ color: 'var(--text-primary)' }}>Admin Access Required</div>
      <div className="empty-text" style={{ color: 'var(--text-muted)' }}>Your account does not have admin privileges.</div>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('home')}>Go Home</button>
    </div>
  )

  const NAV = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'jobs',      label: '💼 Jobs' },
    { id: 'news',      label: '📰 News' },
    { id: 'affiliates',label: '🎁 Affiliates' },
    { id: 'users',     label: '👥 Users' },
    { id: 'ai',        label: '🤖 AI Assistant' },
  ]

  const STATS = [
    { icon: '💼', val: jobs.length,  label: 'Total Jobs' },
    { icon: '📰', val: news.length,  label: 'News Articles' },
    { icon: '🎁', val: affs.length,  label: 'Affiliates' },
    { icon: '👥', val: users.length, label: 'Total Users' },
  ]

  return (
    <div className="admin-layout" style={{ background: 'var(--bg-base)' }}>

      {/* ── Sidebar ── */}
      <div className="admin-sidebar" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="admin-sidebar-title" style={{ color: 'var(--text-muted)' }}>Admin Panel</div>
        {NAV.map(n => (
          <div key={n.id} className={`admin-nav-item ${section === n.id ? 'active' : ''}`}
            style={{ color: section === n.id ? 'var(--brand)' : 'var(--text-secondary)' }}
            onClick={() => setSection(n.id)}>
            {n.label}
          </div>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div className="admin-nav-item" style={{ color: 'var(--text-secondary)' }} onClick={() => navigate('home')}>← Back to Site</div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="admin-content">

        {/* DASHBOARD */}
        {section === 'dashboard' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>📊 Dashboard</div>
              <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>Welcome, {profile?.full_name || 'Admin'} ⚡</div>
            </div>
            <div className="admin-cards">
              {STATS.map(s => (
                <div key={s.label} className="admin-stat-card" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="admin-stat-icon">{s.icon}</div>
                  <div className="admin-stat-val" style={{ color: 'var(--text-primary)' }}>{s.val}</div>
                  <div className="admin-stat-label" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="admin-stat-card" style={{ background: 'var(--bg-card)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>🎁 Top Affiliates</div>
                {[...affs].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 4).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{a.emoji} {a.name}</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--brand)', fontWeight: 700 }}>{(a.clicks || 0).toLocaleString()} clicks</span>
                  </div>
                ))}
                {affs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No affiliates yet</div>}
              </div>
              <div className="admin-stat-card" style={{ background: 'var(--bg-card)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>📈 Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { setSection('jobs'); setShowAddJob(true) }}>+ Add Job</button>
                  <button className="btn btn-ghost btn-sm"   onClick={() => { setSection('news'); setShowAddNews(true) }}>+ Add News</button>
                  <button className="btn btn-ghost btn-sm"   onClick={() => { setSection('affiliates'); setShowAddAff(true) }}>+ Add Affiliate</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* JOBS */}
        {section === 'jobs' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>💼 Manage Jobs</div>
              <button className="btn btn-primary btn-sm" onClick={() => { setJobForm(JOB_DEFAULTS); setShowAddJob(true) }}>+ Add Job</button>
            </div>
            <div className="admin-table-wrap" style={{ background: 'var(--bg-card)' }}>
              <table className="admin-table">
                <thead><tr><th>Title</th><th>Org</th><th>Category</th><th>Posts</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id}>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{j.title}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{j.organization?.split(' ').slice(0, 2).join(' ')}</td>
                      <td><span className={`badge badge-${j.category === 'govt' ? 'green' : 'blue'}`}>{j.category}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{(j.vacancies || 0).toLocaleString()}</td>
                      <td><span className={`badge ${j.is_active !== false ? 'badge-green' : 'badge-red'}`}>{j.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '.35rem' }}>
                          <button className="action-btn action-del" onClick={() => window.confirm('Delete this job?') && deleteJobMut.mutate(j.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No jobs yet. Click "+ Add Job"</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* NEWS */}
        {section === 'news' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>📰 Manage News</div>
              <button className="btn btn-primary btn-sm" onClick={() => { setNewsForm(NEWS_DEFAULTS); setShowAddNews(true) }}>+ Add Article</button>
            </div>
            <div className="admin-table-wrap" style={{ background: 'var(--bg-card)' }}>
              <table className="admin-table">
                <thead><tr><th>Title</th><th>Source</th><th>Category</th><th>Published</th><th>Actions</th></tr></thead>
                <tbody>
                  {news.map(n => (
                    <tr key={n.id}>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{n.title}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{n.source_name}</td>
                      <td><span className="badge badge-blue">{n.category}</span></td>
                      <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{timeAgo(n.published_at)}</td>
                      <td><button className="action-btn action-del" onClick={() => window.confirm('Delete this article?') && deleteNewsMut.mutate(n.id)}>Del</button></td>
                    </tr>
                  ))}
                  {news.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No articles yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* AFFILIATES */}
        {section === 'affiliates' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>🎁 Manage Affiliates</div>
              <button className="btn btn-primary btn-sm" onClick={() => { setAffForm(AFF_DEFAULTS); setShowAddAff(true) }}>+ Add Affiliate</button>
            </div>
            <div className="admin-table-wrap" style={{ background: 'var(--bg-card)' }}>
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Category</th><th>Placement</th><th>Clicks</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {affs.map(a => (
                    <tr key={a.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.emoji} {a.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.category}</td>
                      <td><span className="badge badge-blue">{a.placement}</span></td>
                      <td style={{ color: 'var(--brand)', fontWeight: 700 }}>{(a.clicks || 0).toLocaleString()}</td>
                      <td><span className="badge badge-green">Active</span></td>
                      <td><button className="action-btn action-del" onClick={() => window.confirm('Delete affiliate?') && deleteAffMut.mutate(a.id)}>Del</button></td>
                    </tr>
                  ))}
                  {affs.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No affiliates yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* USERS */}
        {section === 'users' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>👥 Manage Users</div>
            </div>
            <div className="admin-table-wrap" style={{ background: 'var(--bg-card)' }}>
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.full_name || 'Anonymous'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.email || u.id}</td>
                      <td><span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>{u.role || 'user'}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        {u.role !== 'admin'
                          ? <button className="action-btn action-edit" onClick={() => window.confirm('Make admin?') && updateRoleMut.mutate({ id: u.id, role: 'admin' })}>Make Admin</button>
                          : <button className="action-btn action-del"  onClick={() => window.confirm('Remove admin?') && updateRoleMut.mutate({ id: u.id, role: 'user' })}>Remove Admin</button>
                        }
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* AI ASSISTANT */}
        {section === 'ai' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>🤖 AI Assistant</div>
            </div>
            <AIAssistantPanel />
          </>
        )}
      </div>

      {/* ══ ADD JOB MODAL ══ */}
      {showAddJob && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: 'var(--bg-surface)' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--text-primary)' }}>➕ Add New Job</div>
              <button className="modal-close" onClick={() => { setShowAddJob(false); addJobMut.reset(); setJobForm(JOB_DEFAULTS) }}>✕</button>
            </div>

            {/* Visible error banner */}
            {addJobMut.isError && (
              <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid var(--red)', borderRadius: 8, padding: '.65rem 1rem', marginBottom: '.75rem', color: 'var(--red)', fontSize: '.85rem', fontWeight: 500 }}>
                ❌ {addJobMut.error?.message || 'Failed to save job. Please try again.'}
              </div>
            )}

            <form onSubmit={saveJob}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { k: 'title',        l: 'Job Title *',   c: '1/-1', ph: 'e.g. Junior Engineer' },
                  { k: 'organization', l: 'Organization *', ph: 'e.g. UPSC' },
                  { k: 'location',     l: 'Location',      ph: 'e.g. All India' },
                  { k: 'salary_range', l: 'Salary Range',  ph: 'e.g. ₹35,000 – ₹75,000' },
                  { k: 'vacancies',    l: 'No. of Posts',  t: 'number', ph: '0' },
                  { k: 'last_date',    l: 'Last Date',     t: 'date' },
                  { k: 'apply_url',    l: 'Apply URL *',   c: '1/-1', t: 'url', ph: 'https://example.gov.in/apply' },
                ].map(f => (
                  <div key={f.k} className="form-group" style={{ gridColumn: f.c || 'auto' }}>
                    <label className="form-label">{f.l}</label>
                    <input
                      className="form-input" style={INPUT}
                      type={f.t || 'text'}
                      placeholder={f.ph || ''}
                      required={['title', 'organization', 'apply_url'].includes(f.k)}
                      value={jobForm[f.k]}
                      onChange={e => setJobForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" style={INPUT} value={jobForm.category} onChange={e => setJobForm(prev => ({ ...prev, category: e.target.value }))}>
                    <option value="govt">Government</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={addJobMut.isPending}>
                  {addJobMut.isPending
                    ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}>
                        <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                        Saving...
                      </span>
                    : 'Save Job'
                  }
                </button>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowAddJob(false); addJobMut.reset(); setJobForm(JOB_DEFAULTS) }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ ADD NEWS MODAL ══ */}
      {showAddNews && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: 'var(--bg-surface)' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--text-primary)' }}>➕ Add News Article</div>
              <button className="modal-close" onClick={() => { setShowAddNews(false); addNewsMut.reset(); setNewsForm(NEWS_DEFAULTS) }}>✕</button>
            </div>

            {addNewsMut.isError && (
              <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid var(--red)', borderRadius: 8, padding: '.65rem 1rem', marginBottom: '.75rem', color: 'var(--red)', fontSize: '.85rem', fontWeight: 500 }}>
                ❌ {addNewsMut.error?.message || 'Failed to save article.'}
              </div>
            )}

            <form onSubmit={saveNews}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" style={INPUT} required placeholder="Article headline" value={newsForm.title} onChange={e => setNewsForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Summary</label>
                <textarea className="form-input" style={{ ...INPUT, resize: 'vertical' }} rows={3} placeholder="Brief description..." value={newsForm.summary} onChange={e => setNewsForm(p => ({ ...p, summary: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Source Name *</label>
                  <input className="form-input" style={INPUT} required placeholder="e.g. Economic Times" value={newsForm.source_name} onChange={e => setNewsForm(p => ({ ...p, source_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" style={INPUT} value={newsForm.category} onChange={e => setNewsForm(p => ({ ...p, category: e.target.value }))}>
                    {['govt', 'tech', 'education', 'general'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Source URL</label>
                <input className="form-input" style={INPUT} type="url" placeholder="https://example.com/article" value={newsForm.source_url} onChange={e => setNewsForm(p => ({ ...p, source_url: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={addNewsMut.isPending}>
                  {addNewsMut.isPending
                    ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}>
                        <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                        Saving...
                      </span>
                    : 'Save Article'
                  }
                </button>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowAddNews(false); addNewsMut.reset(); setNewsForm(NEWS_DEFAULTS) }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ ADD AFFILIATE MODAL ══ */}
      {showAddAff && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: 'var(--bg-surface)' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--text-primary)' }}>➕ Add Affiliate</div>
              <button className="modal-close" onClick={() => { setShowAddAff(false); addAffMut.reset(); setAffForm(AFF_DEFAULTS) }}>✕</button>
            </div>

            {addAffMut.isError && (
              <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid var(--red)', borderRadius: 8, padding: '.65rem 1rem', marginBottom: '.75rem', color: 'var(--red)', fontSize: '.85rem', fontWeight: 500 }}>
                ❌ {addAffMut.error?.message || 'Failed to save affiliate.'}
              </div>
            )}

            <form onSubmit={saveAff}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Name *</label>
                  <input className="form-input" style={INPUT} required placeholder="e.g. Testbook" value={affForm.name} onChange={e => setAffForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Description</label>
                  <input className="form-input" style={INPUT} placeholder="Short description" value={affForm.description} onChange={e => setAffForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Redirect URL *</label>
                  <input className="form-input" style={INPUT} type="url" required placeholder="https://affiliate.example.com" value={affForm.redirect_url} onChange={e => setAffForm(p => ({ ...p, redirect_url: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" style={INPUT} value={affForm.category} onChange={e => setAffForm(p => ({ ...p, category: e.target.value }))}>
                    {['exam-prep', 'courses', 'books', 'tools', 'general'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Placement</label>
                  <select className="form-input" style={INPUT} value={affForm.placement} onChange={e => setAffForm(p => ({ ...p, placement: e.target.value }))}>
                    {['hero', 'sidebar', 'inline', 'footer'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Emoji Icon</label>
                  <input className="form-input" style={INPUT} placeholder="📚" value={affForm.emoji} onChange={e => setAffForm(p => ({ ...p, emoji: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={addAffMut.isPending}>
                  {addAffMut.isPending
                    ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}>
                        <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                        Saving...
                      </span>
                    : 'Save Affiliate'
                  }
                </button>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowAddAff(false); addAffMut.reset(); setAffForm(AFF_DEFAULTS) }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
