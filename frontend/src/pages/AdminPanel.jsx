import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchJobs,    addJob,    updateJob,    deleteJob,
  fetchNews,    addNews,   updateNews,   deleteNews,
  fetchAffiliates, addAffiliate, updateAffiliate, deleteAffiliate,
  fetchUsers, updateRole, blockUser, deleteUser,
} from '../services/api'
import { getDashboardStats } from '../services/newsAffiliateService'
import { timeAgo } from '../utils/helpers'
import AIAssistantPanel from './admin/AIAssistantPanel'
import NewsManager from '../components/admin/NewsManager'
import AffiliatesManager from '../components/admin/AffiliatesManager'
import AdminAIAssistant from '../components/admin/AdminAIAssistant'
import LiveUpdatesManager from './admin/LiveUpdatesManager'

// ── Default form states ────────────────────────────────────────
const JOB_DEFAULTS  = { title: '', organization: '', category: 'govt', location: 'All India', apply_url: '', salary_range: '', vacancies: '', last_date: '', is_featured: false, is_active: true }
const NEWS_DEFAULTS = { title: '', summary: '', source_name: '', source_url: '', category: 'govt', is_featured: false, is_active: true }
const AFF_DEFAULTS  = { name: '', description: '', redirect_url: '', category: 'exam-prep', emoji: '📚', placement: 'sidebar', is_active: true }

const INPUT = { background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
const Spinner = () => (
  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
)

export default function AdminPanel() {
  const { isAdmin, profile, loading, user } = useAuth()
  const { navigate } = useRouter()
  const toast        = useToast()
  const queryClient  = useQueryClient()

  // ── Admin guard check ──────────────────────────────────────────
  // While auth is loading — show skeleton not redirect
  if (loading) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid rgba(249,115,22,0.2)',
          borderTopColor: '#f97316',
          borderRadius: '50%',
          animation: 'nv-spin 0.6s linear infinite',
        }}/>
        <style>{`
          @keyframes nv-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  // Not logged in at all
  if (!user) {
    return (
      <div className="empty-state" style={{ marginTop: '5rem' }}>
        <div className="empty-icon">🔒</div>
        <div className="empty-title">Sign In Required</div>
        <div className="empty-text">
          Please sign in to access the admin panel
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: '1.25rem' }}
          onClick={() => navigate('login')}
        >
          Sign In
        </button>
      </div>
    )
  }

  // Logged in but not admin
  if (!isAdmin) {
    return (
      <div className="empty-state" style={{ marginTop: '5rem' }}>
        <div className="empty-icon">🚫</div>
        <div className="empty-title">Admin Access Required</div>
        <div className="empty-text">
          Your account doesn't have admin privileges.
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: '1.25rem' }}
          onClick={() => navigate('home')}
        >
          Go to Home
        </button>
      </div>
    )
  }

  // ✅ Admin verified — render full admin panel below

  // ── Section nav ───────────────────────────────────────────────
  const [section, setSection] = useState('dashboard')

  // ── Modal open/close flags ────────────────────────────────────
  const [showJobModal,  setShowJobModal]  = useState(false)
  const [showNewsModal, setShowNewsModal] = useState(false)
  const [showAffModal,  setShowAffModal]  = useState(false)

  // ── Edit ID — null = Add mode, id = Edit mode ─────────────────
  const [editJobId,  setEditJobId]  = useState(null)
  const [editNewsId, setEditNewsId] = useState(null)
  const [editAffId,  setEditAffId]  = useState(null)

  // ── Form states ───────────────────────────────────────────────
  const [jobForm,  setJobForm]  = useState(JOB_DEFAULTS)
  const [newsForm, setNewsForm] = useState(NEWS_DEFAULTS)
  const [affForm,  setAffForm]  = useState(AFF_DEFAULTS)

  // ── Dashboard stats ───────────────────────────────────────────
  const [dashStats, setDashStats] = useState({ totalJobs: 0, totalNews: 0, totalAffiliates: 0, totalUsers: 0 })

  // ── Data queries ──────────────────────────────────────────────
  const { data: jobs  = [] } = useQuery({ queryKey: ['admin_jobs'],  queryFn: () => fetchJobs(),  enabled: isAdmin })
  const { data: news  = [] } = useQuery({ queryKey: ['admin_news'],  queryFn: fetchNews,          enabled: isAdmin })
  const { data: affs  = [] } = useQuery({ queryKey: ['admin_affs'],  queryFn: fetchAffiliates,    enabled: isAdmin })
  const { data: users = [] } = useQuery({ queryKey: ['admin_users'], queryFn: fetchUsers,         enabled: isAdmin })

  // Load dashboard stats on mount
  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    try {
      const stats = await getDashboardStats()
      setDashStats(stats)
    } catch (err) {
      console.error('Failed to load stats:', err.message)
    }
  }

  // ── Helper: open modal in Add mode ───────────────────────────
  const openAddJob  = () => { setEditJobId(null);  setJobForm(JOB_DEFAULTS);   setShowJobModal(true)  }
  const openAddNews = () => { setEditNewsId(null); setNewsForm(NEWS_DEFAULTS); setShowNewsModal(true) }
  const openAddAff  = () => { setEditAffId(null);  setAffForm(AFF_DEFAULTS);   setShowAffModal(true)  }

  // ── Helper: open modal in Edit mode ──────────────────────────
  const openEditJob  = (j) => { setEditJobId(j.id);  setJobForm({ title: j.title, organization: j.organization, category: j.category, location: j.location || 'All India', apply_url: j.apply_url, salary_range: j.salary_range || '', vacancies: j.vacancies || '', last_date: j.last_date || '', is_featured: j.is_featured ?? false, is_active: j.is_active ?? true }); setShowJobModal(true)  }
  const openEditNews = (n) => { setEditNewsId(n.id); setNewsForm({ title: n.title, summary: n.summary || '', source_name: n.source_name || '', source_url: n.source_url || '', category: n.category, is_featured: n.is_featured ?? false, is_active: n.is_active ?? true }); setShowNewsModal(true) }
  const openEditAff  = (a) => { setEditAffId(a.id);  setAffForm({ name: a.name, description: a.description || '', redirect_url: a.redirect_url, category: a.category, emoji: a.emoji || '📚', placement: a.placement || 'sidebar', is_active: a.is_active ?? true }); setShowAffModal(true)  }

  // ── Close helpers ─────────────────────────────────────────────
  const closeJobModal  = () => { setShowJobModal(false);  setEditJobId(null);  setJobForm(JOB_DEFAULTS);   jobMut.reset()  }
  const closeNewsModal = () => { setShowNewsModal(false); setEditNewsId(null); setNewsForm(NEWS_DEFAULTS); newsMut.reset() }
  const closeAffModal  = () => { setShowAffModal(false);  setEditAffId(null);  setAffForm(AFF_DEFAULTS);   affMut.reset()  }

  // ── Unified mutations (Add + Edit) ────────────────────────────
  const jobMut = useMutation({
    mutationFn: (payload) => editJobId
      ? updateJob(editJobId, payload)
      : addJob(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] })
      toast(editJobId ? 'Job updated! ✅' : 'Job added! ✅', 'success')
      closeJobModal()
    },
    onError: (err) => toast(err.message || 'Failed to save job', 'error'),
  })

  const newsMut = useMutation({
    mutationFn: (payload) => editNewsId
      ? updateNews(editNewsId, payload)
      : addNews(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_news'] })
      toast(editNewsId ? 'Article updated! ✅' : 'Article added! ✅', 'success')
      closeNewsModal()
    },
    onError: (err) => toast(err.message || 'Failed to save article', 'error'),
  })

  const affMut = useMutation({
    mutationFn: (payload) => editAffId
      ? updateAffiliate(editAffId, payload)
      : addAffiliate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_affs'] })
      toast(editAffId ? 'Affiliate updated! ✅' : 'Affiliate added! ✅', 'success')
      closeAffModal()
    },
    onError: (err) => toast(err.message || 'Failed to save affiliate', 'error'),
  })

  // ── Delete mutations ──────────────────────────────────────────
  const delJob  = useMutation({ mutationFn: deleteJob,      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_jobs']  }); toast('Job deleted',       'success') }, onError: (e) => toast(e.message, 'error') })
  const delNews = useMutation({ mutationFn: deleteNews,     onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_news']  }); toast('News deleted',      'success') }, onError: (e) => toast(e.message, 'error') })
  const delAff  = useMutation({ mutationFn: deleteAffiliate,onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_affs']  }); toast('Affiliate deleted', 'success') }, onError: (e) => toast(e.message, 'error') })
  const roleMut = useMutation({ mutationFn: ({ id, role }) => updateRole(id, role), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast('Role updated', 'success') }, onError: (e) => toast(e.message, 'error') })
  const blockMut = useMutation({ mutationFn: ({ id, isBlocked }) => blockUser(id, isBlocked), onSuccess: (_, vars) => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast(vars.isBlocked ? 'User blocked 🚫' : 'User unblocked ✅', 'success') }, onError: (e) => toast(e.message, 'error') })
  const delUserMut = useMutation({ mutationFn: (id) => deleteUser(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast('User deleted 🗑️', 'success') }, onError: (e) => toast(e.message, 'error') })

  // ── Quick is_active / is_featured toggles ────────────────────
  const toggleJobActive  = (j) => updateJob(j.id, { is_active: !j.is_active  }).then(() => { queryClient.invalidateQueries({ queryKey: ['admin_jobs'] }); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleJobFeat    = (j) => updateJob(j.id, { is_featured: !j.is_featured }).then(() => { queryClient.invalidateQueries({ queryKey: ['admin_jobs'] }); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleNewsActive = (n) => updateNews(n.id, { is_active: !n.is_active    }).then(() => { queryClient.invalidateQueries({ queryKey: ['admin_news'] }); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleNewsFeat   = (n) => updateNews(n.id, { is_featured: !n.is_featured}).then(() => { queryClient.invalidateQueries({ queryKey: ['admin_news'] }); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleAffActive  = (a) => updateAffiliate(a.id, { is_active: !a.is_active}).then(() => { queryClient.invalidateQueries({ queryKey: ['admin_affs'] }); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))

  // ── Confirm delete helper ─────────────────────────────────────
  const confirmDel = (msg, fn) => { if (window.confirm(msg)) fn() }

  // ── Form validators / submit handlers ────────────────────────
  const saveJob = (e) => {
    e.preventDefault()
    if (!jobForm.title.trim())        { toast('Job Title is required', 'error'); return }
    if (!jobForm.organization.trim()) { toast('Organization is required', 'error'); return }
    if (!jobForm.apply_url.trim())    { toast('Apply URL is required', 'error'); return }
    try {
      const u = new URL(jobForm.apply_url.trim())
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
    } catch { toast('Apply URL must start with https://', 'error'); return }

    jobMut.mutate({
      title:        jobForm.title.trim(),
      organization: jobForm.organization.trim(),
      category:     jobForm.category,
      location:     jobForm.location.trim() || 'All India',
      apply_url:    jobForm.apply_url.trim(),
      salary_range: jobForm.salary_range || null,
      vacancies:    parseInt(jobForm.vacancies) || 0,
      last_date:    jobForm.last_date || null,
      is_featured:  jobForm.is_featured,
      is_active:    jobForm.is_active,
      tags:         [],
    })
  }

  const saveNews = (e) => {
    e.preventDefault()
    if (!newsForm.title.trim())       { toast('Title is required', 'error'); return }
    if (!newsForm.source_name.trim()) { toast('Source Name is required', 'error'); return }
    if (newsForm.source_url.trim()) {
      try { new URL(newsForm.source_url.trim()) }
      catch { toast('Source URL must be a valid URL', 'error'); return }
    }
    newsMut.mutate({
      title:       newsForm.title.trim(),
      summary:     newsForm.summary     || null,
      source_name: newsForm.source_name.trim(),
      source_url:  newsForm.source_url  || null,
      category:    newsForm.category,
      is_featured: newsForm.is_featured,
      is_active:   newsForm.is_active,
    })
  }

  const saveAff = (e) => {
    e.preventDefault()
    if (!affForm.name.trim())         { toast('Name is required', 'error'); return }
    if (!affForm.redirect_url.trim()) { toast('Redirect URL is required', 'error'); return }
    try {
      const u = new URL(affForm.redirect_url.trim())
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
    } catch { toast('Redirect URL must start with https://', 'error'); return }

    affMut.mutate({
      name:         affForm.name.trim(),
      description:  affForm.description || null,
      redirect_url: affForm.redirect_url.trim(),
      category:     affForm.category,
      placement:    affForm.placement,
      emoji:        affForm.emoji || '📦',
      is_active:    affForm.is_active,
      ...(editAffId ? {} : { click_count: 0 }),
    })
  }



  // ── Nav + Stats ───────────────────────────────────────────────
  const NAV = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'jobs',      label: '💼 Jobs' },
    { id: 'news',      label: '📰 News' },
    { id: 'affiliates',label: '🎁 Affiliates' },
    { id: 'live-updates', label: '📢 Live Updates' },
    { id: 'users',     label: '👥 Users' },
    { id: 'ai',        label: '✨ AI Assistant' },
  ]
  const STATS = [
    { icon: '💼', val: dashStats.totalJobs,  label: 'Total Jobs' },
    { icon: '📰', val: dashStats.totalNews,  label: 'News Articles' },
    { icon: '🎁', val: dashStats.totalAffiliates,  label: 'Affiliates' },
    { icon: '👥', val: dashStats.totalUsers, label: 'Total Users' },
  ]

  // ── Shared sub-components ─────────────────────────────────────
  const ErrBanner = ({ mut }) => mut.isError ? (
    <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid var(--red)', borderRadius: 8, padding: '.65rem 1rem', marginBottom: '.75rem', color: 'var(--red)', fontSize: '.85rem', fontWeight: 500 }}>
      ❌ {mut.error?.message || 'An error occurred. Please try again.'}
    </div>
  ) : null

  const SaveBtn = ({ mut, label, editLabel }) => (
    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={mut.isPending}>
      {mut.isPending ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}><Spinner /> Saving...</span>
        : (editLabel && mut.variables !== undefined && editLabel) || label}
    </button>
  )

  const Toggle = ({ active, onToggle, size = 'sm' }) => {
    const isSmall = size === 'sm'
    return (
      <button
        type="button"
        onClick={onToggle}
        title={active ? 'Disable' : 'Enable'}
        aria-pressed={active}
        style={{
          width: isSmall ? 44 : 52,
          height: isSmall ? 24 : 28,
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          position: 'relative',
          background: active ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
          boxShadow: active 
            ? 'inset 0 2px 4px rgba(0,0,0,0.1), 0 4px 12px rgba(34, 197, 94, 0.3)' 
            : 'inset 0 2px 4px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.08)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: active ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Inner circle/thumb */}
        <span
          style={{
            position: 'absolute',
            width: isSmall ? 20 : 24,
            height: isSmall ? 20 : 24,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transform: `translateX(${active ? (isSmall ? 20 : 24) : 2}px)`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {/* Active indicator icons/text */}
        {isSmall && (
          <>
            <span
              style={{
                position: 'absolute',
                left: 4,
                fontSize: '10px',
                opacity: active ? 0 : 0.6,
                transition: 'opacity 0.2s',
                fontWeight: '600',
                color: '#666',
              }}
            >
              OFF
            </span>
            <span
              style={{
                position: 'absolute',
                right: 4,
                fontSize: '10px',
                opacity: active ? 1 : 0,
                transition: 'opacity 0.2s',
                fontWeight: '600',
                color: '#fff',
              }}
            >
              ON
            </span>
          </>
        )}
      </button>
    )
  }

  // ── Row action buttons ────────────────────────────────────────
  const ActBtns = ({ onEdit, onDel, delPending }) => (
    <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
      <button className="action-btn action-edit" onClick={onEdit}>✏️ Edit</button>
      <button className="action-btn action-del" disabled={delPending} onClick={onDel}>
        {delPending ? '...' : '🗑️ Del'}
      </button>
    </div>
  )

  // ──────────────────────────────────────────────────────────────
  return (
    <div className="admin-layout" style={{ background: 'var(--bg-base)' }}>

      {/* Mobile horizontal nav */}
      <div className="admin-mobile-nav">
        {NAV.map(n => (
          <div key={n.id}
            className={`admin-mobile-nav-item ${section === n.id ? 'active' : ''}`}
            onClick={() => setSection(n.id)}>
            {n.label}
          </div>
        ))}
        <div className="admin-mobile-nav-item" onClick={() => navigate('home')}>← Site</div>
      </div>

      {/* Sidebar (≥ 900px) */}
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
            <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="admin-stat-card" style={{ background: 'var(--bg-card)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>🎁 Top Affiliates</div>
                {[...affs].sort((a, b) => (b.clicks || b.click_count || 0) - (a.clicks || a.click_count || 0)).slice(0, 4).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{a.emoji} {a.name}</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--brand)', fontWeight: 700 }}>{(a.clicks || a.click_count || 0).toLocaleString()} clicks</span>
                  </div>
                ))}
                {affs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No affiliates yet</div>}
              </div>
              <div className="admin-stat-card" style={{ background: 'var(--bg-card)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>📈 Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { setSection('jobs');      openAddJob()  }}>+ Add Job</button>
                  <button className="btn btn-ghost btn-sm"   onClick={() => { setSection('news');      openAddNews() }}>+ Add News</button>
                  <button className="btn btn-ghost btn-sm"   onClick={() => { setSection('affiliates');openAddAff()  }}>+ Add Affiliate</button>
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
              <button className="btn btn-primary btn-sm" onClick={openAddJob}>+ Add Job</button>
            </div>
            <div className="admin-table-wrap" style={{ background: 'var(--bg-card)' }}>
              <table className="admin-table">
                <thead><tr>
                  <th>Title</th><th>Org</th><th>Cat</th><th>Posts</th>
                  <th>Featured</th><th>Active</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id}>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{j.title}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{j.organization?.split(' ').slice(0, 2).join(' ')}</td>
                      <td><span className={`badge badge-${j.category === 'govt' ? 'green' : 'blue'}`}>{j.category}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{(j.vacancies || 0).toLocaleString()}</td>
                      <td><Toggle active={j.is_featured} onToggle={() => toggleJobFeat(j)} /></td>
                      <td><Toggle active={j.is_active !== false} onToggle={() => toggleJobActive(j)} /></td>
                      <td>
                        <ActBtns
                          onEdit={() => openEditJob(j)}
                          onDel={() => confirmDel('Delete this job?', () => delJob.mutate(j.id))}
                          delPending={delJob.isPending}
                        />
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No jobs yet. Click "+ Add Job"</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* NEWS */}
        {section === 'news' && (
          <NewsManager />
        )}

        {/* AFFILIATES */}
        {section === 'affiliates' && (
          <AffiliatesManager />
        )}

        {/* USERS */}
        {section === 'users' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>👥 Manage Users</div>
              <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{users.length} total users</div>
            </div>
            <div className="admin-table-wrap" style={{ background: 'var(--bg-card)' }}>
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => {
                    const isSelf = u.email?.toLowerCase() === user?.email?.toLowerCase()
                    return (
                      <tr key={u.id} style={{ opacity: u.is_blocked ? 0.6 : 1 }}>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {u.full_name || 'Anonymous'}
                          {isSelf && <span style={{ fontSize: '.7rem', color: 'var(--brand)', marginLeft: '.4rem', fontWeight: 600 }}>(You)</span>}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || u.id}</td>
                        <td><span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>{u.role || 'user'}</span></td>
                        <td>
                          {u.is_blocked
                            ? <span className="badge badge-red" style={{ background: 'rgba(239,68,68,.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' }}>🚫 Blocked</span>
                            : <span className="badge badge-green" style={{ background: 'rgba(34,197,94,.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,.3)' }}>✓ Active</span>
                          }
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Role toggle */}
                            {u.role !== 'admin'
                              ? <button className="action-btn action-edit" onClick={() => confirmDel('Make this user an admin?', () => roleMut.mutate({ id: u.id, role: 'admin' }))}>👑 Admin</button>
                              : !isSelf && <button className="action-btn" style={{ background: 'rgba(249,115,22,.1)', color: '#f97316', border: '1px solid rgba(249,115,22,.25)' }} onClick={() => confirmDel('Remove admin rights?', () => roleMut.mutate({ id: u.id, role: 'user' }))}>Remove Admin</button>
                            }
                            {/* Block / Unblock — hide for self */}
                            {!isSelf && (
                              u.is_blocked
                                ? <button className="action-btn action-edit" disabled={blockMut.isPending} onClick={() => confirmDel('Unblock this user?', () => blockMut.mutate({ id: u.id, isBlocked: false }))}>✅ Unblock</button>
                                : <button className="action-btn" style={{ background: 'rgba(234,179,8,.1)', color: '#eab308', border: '1px solid rgba(234,179,8,.25)' }} disabled={blockMut.isPending} onClick={() => confirmDel('Block this user? They won\'t be able to log in.', () => blockMut.mutate({ id: u.id, isBlocked: true }))}>🚫 Block</button>
                            )}
                            {/* Delete — hide for self */}
                            {!isSelf && (
                              <button className="action-btn action-del" disabled={delUserMut.isPending} onClick={() => confirmDel('⚠️ Permanently delete this user? This cannot be undone!', () => delUserMut.mutate(u.id))}>
                                {delUserMut.isPending ? '...' : '🗑️ Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* LIVE UPDATES */}
        {section === 'live-updates' && (
          <LiveUpdatesManager />
        )}

        {/* AI ASSISTANT */}
        {section === 'ai' && (
          <AdminAIAssistant />
        )}
      </div>

      {/* ══════════════════════════════════════════
          JOB MODAL (Add / Edit)
      ══════════════════════════════════════════ */}
      {showJobModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: 'var(--bg-surface)' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--text-primary)' }}>
                {editJobId ? '✏️ Edit Job' : '➕ Add New Job'}
              </div>
              <button className="modal-close" onClick={closeJobModal}>✕</button>
            </div>
            <ErrBanner mut={jobMut} />
            <form onSubmit={saveJob}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { k: 'title',        l: 'Job Title *',   c: '1/-1', ph: 'e.g. Junior Engineer' },
                  { k: 'organization', l: 'Organization *', ph: 'e.g. UPSC' },
                  { k: 'location',     l: 'Location',      ph: 'All India' },
                  { k: 'salary_range', l: 'Salary Range',  ph: '₹35,000 – ₹75,000' },
                  { k: 'vacancies',    l: 'No. of Posts',  t: 'number', ph: '0' },
                  { k: 'last_date',    l: 'Last Date',     t: 'date' },
                  { k: 'apply_url',    l: 'Apply URL *',   c: '1/-1', t: 'url', ph: 'https://example.gov.in/apply' },
                ].map(f => (
                  <div key={f.k} className="form-group" style={{ gridColumn: f.c || 'auto' }}>
                    <label className="form-label">{f.l}</label>
                    <input
                      className="form-input" style={INPUT}
                      type={f.t || 'text'} placeholder={f.ph || ''}
                      required={['title', 'organization', 'apply_url'].includes(f.k)}
                      value={jobForm[f.k]}
                      onChange={e => setJobForm(p => ({ ...p, [f.k]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" style={INPUT} value={jobForm.category} onChange={e => setJobForm(p => ({ ...p, category: e.target.value }))}>
                    <option value="govt">Government</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                {/* Toggles row */}
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '.6rem 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--text-secondary)', fontSize: '.85rem', cursor: 'pointer' }}>
                    <Toggle active={jobForm.is_featured} onToggle={() => setJobForm(p => ({ ...p, is_featured: !p.is_featured }))} />
                    Featured
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--text-secondary)', fontSize: '.85rem', cursor: 'pointer' }}>
                    <Toggle active={jobForm.is_active} onToggle={() => setJobForm(p => ({ ...p, is_active: !p.is_active }))} />
                    Active
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={jobMut.isPending}>
                  {jobMut.isPending ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}><Spinner /> Saving...</span>
                    : editJobId ? 'Update Job' : 'Save Job'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeJobModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  )
}
