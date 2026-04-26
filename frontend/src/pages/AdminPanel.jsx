import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAllJobs, updateJob, deleteJob,
  fetchNews,    addNews,   updateNews,   deleteNews,
  fetchAffiliates, addAffiliate, updateAffiliate, deleteAffiliate,
  fetchUsers, updateRole, blockUser, deleteUser, SUPER_ADMIN_EMAIL,
} from '../services/api'
import { getDashboardStats } from '../services/newsAffiliateService'
import { timeAgo } from '../utils/helpers'
import NewsManager      from '../components/admin/NewsManager'
import AffiliatesManager from '../components/admin/AffiliatesManager'
import AdminAIAssistant  from '../components/admin/AdminAIAssistant'
import LiveUpdatesManager from './admin/LiveUpdatesManager'
import JobVacancyForm from '../components/admin/JobVacancyForm'

// ── Defaults (news + affiliates) ──────────────────────────────────
const NEWS_DEFAULTS = { title: '', summary: '', source_name: '', source_url: '', category: 'govt', is_featured: false, is_active: true }
const AFF_DEFAULTS  = { name: '', description: '', redirect_url: '', category: 'exam-prep', emoji: '📚', placement: 'sidebar', is_active: true }

const INPUT   = { background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
const Spinner = () => (
  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
)

export default function AdminPanel() {
  const { isAdmin, isSuperAdmin, effectiveRole, profile, loading, user } = useAuth()
  const { navigate } = useRouter()
  const toast        = useToast()
  const queryClient  = useQueryClient()

  // ── Section nav ────────────────────────────────────────────────
  const [section, setSection] = useState('dashboard')

  // ── Job modal: null=closed | {}=Add mode | job object=Edit mode
  const [selectedJob, setSelectedJob] = useState(null)

  // ── News / Affiliates modal state ──────────────────────────────
  const [showNewsModal, setShowNewsModal] = useState(false)
  const [showAffModal,  setShowAffModal]  = useState(false)
  const [editNewsId,    setEditNewsId]    = useState(null)
  const [editAffId,     setEditAffId]     = useState(null)
  const [newsForm,      setNewsForm]      = useState(NEWS_DEFAULTS)
  const [affForm,       setAffForm]       = useState(AFF_DEFAULTS)

  // ── Dashboard stats ────────────────────────────────────────────
  const [dashStats, setDashStats] = useState({ totalJobs: 0, totalNews: 0, totalAffiliates: 0, totalUsers: 0 })

  // ── Data queries ───────────────────────────────────────────────
  const { data: jobs  = [] } = useQuery({ queryKey: ['admin_jobs'],  queryFn: () => fetchAllJobs(),  enabled: isAdmin })
  const { data: news  = [] } = useQuery({ queryKey: ['admin_news'],  queryFn: fetchNews,       enabled: isAdmin })
  const { data: affs  = [] } = useQuery({ queryKey: ['admin_affs'],  queryFn: fetchAffiliates, enabled: isAdmin })
  const { data: users = [] } = useQuery({ queryKey: ['admin_users'], queryFn: fetchUsers,      enabled: isAdmin })

  useEffect(() => {
    if (!isAdmin) return
    getDashboardStats()
      .then(stats => setDashStats(stats))
      .catch(err  => console.error('Stats error:', err.message))
  }, [isAdmin])

  // ─────────────────────────────────────────────────────
  // All hooks above – early returns are safe from here
  // ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(249,115,22,0.2)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'nv-spin 0.6s linear infinite' }}/>
        <style>{`@keyframes nv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="empty-state" style={{ marginTop: '5rem' }}>
        <div className="empty-icon">🔒</div>
        <div className="empty-title">Sign In Required</div>
        <div className="empty-text">Please sign in to access the admin panel</div>
        <button className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={() => navigate('login')}>Sign In</button>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="empty-state" style={{ marginTop: '5rem' }}>
        <div className="empty-icon">🚫</div>
        <div className="empty-title">Admin Access Required</div>
        <div className="empty-text">Your account doesn't have admin privileges.</div>
        <button className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={() => navigate('home')}>Go to Home</button>
      </div>
    )
  }

  // ── Job modal helpers ──────────────────────────────────────────
  const openAddJob    = () => setSelectedJob({})   // empty object = Add mode
  const openEditJob   = (j) => setSelectedJob(j)   // job object   = Edit mode
  const handleJobSaved = () => {
    // Refresh both admin list and public jobs page
    queryClient.invalidateQueries({ queryKey: ['admin_jobs'] })
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }

  // ── News / Aff helpers ─────────────────────────────────────────
  const openAddNews  = () => { setEditNewsId(null); setNewsForm(NEWS_DEFAULTS); setShowNewsModal(true) }
  const openAddAff   = () => { setEditAffId(null);  setAffForm(AFF_DEFAULTS);   setShowAffModal(true)  }
  const openEditNews = (n) => { setEditNewsId(n.id); setNewsForm({ title: n.title, summary: n.summary || '', source_name: n.source_name || '', source_url: n.source_url || '', category: n.category, is_featured: n.is_featured ?? false, is_active: n.is_active ?? true }); setShowNewsModal(true) }
  const openEditAff  = (a) => { setEditAffId(a.id);  setAffForm({ name: a.name, description: a.description || '', redirect_url: a.redirect_url, category: a.category, emoji: a.emoji || '📚', placement: a.placement || 'sidebar', is_active: a.is_active ?? true }); setShowAffModal(true)  }
  const closeNewsModal = () => { setShowNewsModal(false); setEditNewsId(null); setNewsForm(NEWS_DEFAULTS); newsMut.reset() }
  const closeAffModal  = () => { setShowAffModal(false);  setEditAffId(null);  setAffForm(AFF_DEFAULTS);   affMut.reset()  }

  // ── Mutations (news + affiliates) ──────────────────────────────
  const newsMut = useMutation({
    mutationFn: (payload) => editNewsId ? updateNews(editNewsId, payload) : addNews(payload),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['admin_news'] }); toast(editNewsId ? 'Article updated! ✅' : 'Article added! ✅', 'success'); closeNewsModal() },
    onError:    (err) => toast(err.message || 'Failed to save article', 'error'),
  })

  const affMut = useMutation({
    mutationFn: (payload) => editAffId ? updateAffiliate(editAffId, payload) : addAffiliate(payload),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['admin_affs'] }); toast(editAffId ? 'Affiliate updated! ✅' : 'Affiliate added! ✅', 'success'); closeAffModal() },
    onError:    (err) => toast(err.message || 'Failed to save affiliate', 'error'),
  })

  // ── Delete mutations ───────────────────────────────────────────
  const delJob     = useMutation({ mutationFn: deleteJob,       onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_jobs']  }); queryClient.invalidateQueries({ queryKey: ['jobs'] }); toast('Job deleted', 'success') },       onError: (e) => toast(e.message, 'error') })
  const delNews    = useMutation({ mutationFn: deleteNews,      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_news']  }); toast('News deleted', 'success') },      onError: (e) => toast(e.message, 'error') })
  const delAff     = useMutation({ mutationFn: deleteAffiliate, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_affs']  }); toast('Affiliate deleted', 'success') }, onError: (e) => toast(e.message, 'error') })
  const roleMut    = useMutation({ mutationFn: ({ id, role }) => updateRole(id, role), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast('Role updated', 'success') }, onError: (e) => toast(e.message, 'error') })
  const blockMut   = useMutation({ mutationFn: ({ id, isBlocked }) => blockUser(id, isBlocked), onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast(v.isBlocked ? 'User blocked 🚫' : 'User unblocked ✅', 'success') }, onError: (e) => toast(e.message, 'error') })
  const delUserMut = useMutation({ mutationFn: (id) => deleteUser(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast('User deleted 🗑️', 'success') }, onError: (e) => toast(e.message, 'error') })

  // ── Quick toggles ──────────────────────────────────────────────
  const inv = (keys) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }))
  const toggleJobActive  = (j) => updateJob(j.id, { is_active:   !j.is_active   }).then(() => { inv(['admin_jobs', 'jobs']); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleJobFeat    = (j) => updateJob(j.id, { is_featured: !j.is_featured }).then(() => { inv(['admin_jobs', 'jobs']); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleNewsActive = (n) => updateNews(n.id, { is_active:   !n.is_active   }).then(() => { inv(['admin_news']); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleNewsFeat   = (n) => updateNews(n.id, { is_featured: !n.is_featured }).then(() => { inv(['admin_news']); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))
  const toggleAffActive  = (a) => updateAffiliate(a.id, { is_active: !a.is_active }).then(() => { inv(['admin_affs']); toast('Updated', 'success') }).catch(e => toast(e.message, 'error'))

  const confirmDel = (msg, fn) => { if (window.confirm(msg)) fn() }

  // ── News / Aff submit handlers ─────────────────────────────────
  const saveNews = (e) => {
    e.preventDefault()
    if (!newsForm.title.trim())       { toast('Title is required', 'error'); return }
    if (!newsForm.source_name.trim()) { toast('Source Name is required', 'error'); return }
    if (newsForm.source_url.trim()) {
      try { new URL(newsForm.source_url.trim()) }
      catch { toast('Source URL must be a valid URL', 'error'); return }
    }
    newsMut.mutate({
      title: newsForm.title.trim(), summary: newsForm.summary || null,
      source_name: newsForm.source_name.trim(), source_url: newsForm.source_url || null,
      category: newsForm.category, is_featured: newsForm.is_featured, is_active: newsForm.is_active,
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
      name: affForm.name.trim(), description: affForm.description || null,
      redirect_url: affForm.redirect_url.trim(), category: affForm.category,
      placement: affForm.placement, emoji: affForm.emoji || '📦', is_active: affForm.is_active,
      ...(editAffId ? {} : { click_count: 0 }),
    })
  }

  // ── Nav + Stats ────────────────────────────────────────────────
  const NAV = [
    { id: 'dashboard',    label: '📊 Dashboard' },
    { id: 'jobs',         label: '💼 Jobs' },
    { id: 'news',         label: '📰 News' },
    { id: 'affiliates',   label: '🎁 Affiliates' },
    { id: 'live-updates', label: '📢 Live Updates' },
    { id: 'users',        label: '👥 Users' },
    { id: 'ai',           label: '✨ AI Assistant' },
  ]
  const STATS = [
    { icon: '💼', val: dashStats.totalJobs,       label: 'Total Jobs' },
    { icon: '📰', val: dashStats.totalNews,       label: 'News Articles' },
    { icon: '🎁', val: dashStats.totalAffiliates, label: 'Affiliates' },
    { icon: '👥', val: dashStats.totalUsers,      label: 'Total Users' },
  ]

  // ── Sub-components ────────────────────────────────────────────
  const ErrBanner = ({ mut }) => mut.isError ? (
    <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid var(--red)', borderRadius: 8, padding: '.65rem 1rem', marginBottom: '.75rem', color: 'var(--red)', fontSize: '.85rem', fontWeight: 500 }}>
      ❌ {mut.error?.message || 'An error occurred. Please try again.'}
    </div>
  ) : null

  const Toggle = ({ active, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? 'Click to disable' : 'Click to enable'}
      style={{
        position:   'relative',
        width:      46,
        height:     26,
        borderRadius: 999,
        border:     'none',
        cursor:     'pointer',
        flexShrink: 0,
        padding:    0,
        overflow:   'hidden',
        background: active
          ? 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)'
          : 'rgba(100,116,139,0.3)',
        boxShadow:  active
          ? '0 0 0 1px rgba(34,197,94,.45), 0 2px 8px rgba(34,197,94,.3)'
          : '0 0 0 1px rgba(100,116,139,.35)',
        transition: 'background .25s, box-shadow .25s',
      }}
    >
      {/* Label */}
      <span style={{
        position:      'absolute',
        fontSize:      '9px',
        fontWeight:    700,
        letterSpacing: '0.04em',
        color:         active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.45)',
        left:          active ? 6 : 'auto',
        right:         active ? 'auto' : 5,
        top:           '50%',
        transform:     'translateY(-50%)',
        userSelect:    'none',
        lineHeight:    1,
        pointerEvents: 'none',
      }}>
        {active ? 'ON' : 'OFF'}
      </span>
      {/* Thumb */}
      <span style={{
        position:     'absolute',
        width:        20,
        height:       20,
        borderRadius: '50%',
        background:   '#ffffff',
        boxShadow:    '0 1px 4px rgba(0,0,0,.3)',
        top:          3,
        left:         active ? 23 : 3,
        transition:   'left .25s cubic-bezier(.4,0,.2,1)',
        pointerEvents: 'none',
      }} />
    </button>
  )


  const ActBtns = ({ onEdit, onDel, delPending }) => (
    <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
      <button className="action-btn action-edit" onClick={onEdit}>✏️ Edit</button>
      <button className="action-btn action-del" disabled={delPending} onClick={onDel}>
        {delPending ? '...' : '🗑️ Del'}
      </button>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="admin-layout" style={{ background: 'var(--bg-base)' }}>

      {/* Mobile nav */}
      <div className="admin-mobile-nav">
        {NAV.map(n => (
          <div key={n.id} className={`admin-mobile-nav-item ${section === n.id ? 'active' : ''}`} onClick={() => setSection(n.id)}>
            {n.label}
          </div>
        ))}
        <div className="admin-mobile-nav-item" onClick={() => navigate('home')}>← Site</div>
      </div>

      {/* Sidebar */}
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

      {/* Content */}
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
                {[...affs].sort((a,b) => (b.click_count||0)-(a.click_count||0)).slice(0,4).map((a,i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{a.emoji} {a.name}</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--brand)', fontWeight: 700 }}>{(a.click_count||0).toLocaleString()} clicks</span>
                  </div>
                ))}
                {affs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No affiliates yet</div>}
              </div>
              <div className="admin-stat-card" style={{ background: 'var(--bg-card)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>📈 Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { setSection('jobs');       openAddJob() }}>+ Add Job</button>
                  <button className="btn btn-ghost btn-sm"   onClick={() => { setSection('news');       openAddNews() }}>+ Add News</button>
                  <button className="btn btn-ghost btn-sm"   onClick={() => { setSection('affiliates'); openAddAff() }}>+ Add Affiliate</button>
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
                  <th>Title</th><th>Org</th><th>Cat</th>
                  <th>Featured</th><th>Active</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id}>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{j.title}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{j.organization?.split(' ').slice(0,2).join(' ')}</td>
                      <td><span className={`badge badge-${j.category === 'govt' ? 'green' : 'blue'}`}>{j.category}</span></td>
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
                  {jobs.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No jobs yet. Click "+ Add Job"</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* NEWS */}
        {section === 'news' && <NewsManager />}

        {/* AFFILIATES */}
        {section === 'affiliates' && <AffiliatesManager />}

        {/* USERS */}
        {section === 'users' && (
          <>
            <div className="admin-header">
              <div className="admin-title" style={{ color: 'var(--text-primary)' }}>👥 Manage Users</div>
              <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{users.length} total users</div>
            </div>
            {!isSuperAdmin && (
              <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8, padding: '.6rem 1rem', marginBottom: '.75rem', fontSize: '.82rem', color: 'var(--brand)' }}>
                ℹ️ Only the Super Admin can promote or demote users. You can block/unblock and delete regular users.
              </div>
            )}
            <div className="admin-table-wrap" style={{ background: 'var(--bg-card)' }}>
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => {
                    const isSelf        = u.id === user?.id
                    const isTargetSuper = u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
                    const targetRole    = isTargetSuper ? 'super_admin' : (u.role || 'user')
                    return (
                      <tr key={u.id} style={{ opacity: u.is_blocked ? 0.6 : 1 }}>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {u.full_name || 'Anonymous'}
                          {isSelf && <span style={{ fontSize: '.7rem', color: 'var(--brand)', marginLeft: '.4rem', fontWeight: 600 }}>(You)</span>}
                          {isTargetSuper && <span style={{ fontSize: '.7rem', color: '#f59e0b', marginLeft: '.4rem', fontWeight: 700 }}>👑</span>}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || u.id}</td>
                        <td>
                          <span className={`badge ${
                            targetRole === 'super_admin' ? '' :
                            targetRole === 'admin'       ? 'badge-blue' : 'badge-green'
                          }`} style={targetRole === 'super_admin' ? { background: 'rgba(245,158,11,.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' } : {}}>
                            {targetRole === 'super_admin' ? '👑 Super Admin' : targetRole}
                          </span>
                        </td>
                        <td>
                          {u.is_blocked
                            ? <span className="badge badge-red" style={{ background: 'rgba(239,68,68,.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' }}>🚫 Blocked</span>
                            : <span className="badge badge-green" style={{ background: 'rgba(34,197,94,.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,.3)' }}>✓ Active</span>
                          }
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          {isTargetSuper ? (
                            // Super admin row — no actions allowed, ever
                            <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>—</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', alignItems: 'center' }}>

                              {/* Promote/Demote — SUPER ADMIN ONLY */}
                              {isSuperAdmin && !isSelf && (
                                targetRole !== 'admin'
                                  ? <button className="action-btn action-edit" onClick={() => confirmDel('Promote this user to admin?', () => roleMut.mutate({ id: u.id, role: 'admin' }))}>👑 Promote</button>
                                  : <button className="action-btn" style={{ background: 'rgba(249,115,22,.1)', color: '#f97316', border: '1px solid rgba(249,115,22,.25)' }} onClick={() => confirmDel('Remove admin rights?', () => roleMut.mutate({ id: u.id, role: 'user' }))}>↓ Demote</button>
                              )}

                              {/* Block/Unblock — admins can block users; only super_admin can block other admins */}
                              {!isSelf && (isSuperAdmin || targetRole === 'user') && (
                                u.is_blocked
                                  ? <button className="action-btn action-edit" disabled={blockMut.isPending} onClick={() => confirmDel('Unblock this user?', () => blockMut.mutate({ id: u.id, isBlocked: false }))}>✅ Unblock</button>
                                  : <button className="action-btn" style={{ background: 'rgba(234,179,8,.1)', color: '#eab308', border: '1px solid rgba(234,179,8,.25)' }} disabled={blockMut.isPending} onClick={() => confirmDel('Block this user?', () => blockMut.mutate({ id: u.id, isBlocked: true }))}>🚫 Block</button>
                              )}

                              {/* Delete — admins can delete users; only super_admin can delete other admins */}
                              {!isSelf && (isSuperAdmin || targetRole === 'user') && (
                                <button className="action-btn action-del" disabled={delUserMut.isPending} onClick={() => confirmDel('⚠️ Permanently delete this user?', () => delUserMut.mutate(u.id))}>
                                  {delUserMut.isPending ? '...' : '🗑️ Delete'}
                                </button>
                              )}
                            </div>
                          )}
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

        {section === 'live-updates' && <LiveUpdatesManager />}
        {section === 'ai'           && <AdminAIAssistant />}
      </div>

      {/* ── JOB FORM (Modern Upgrade) ── */}
      {selectedJob !== null && (
        <JobVacancyForm
          job={selectedJob?.id ? selectedJob : null}
          onClose={() => setSelectedJob(null)}
          onSaved={handleJobSaved}
        />
      )}

      {/* ── NEWS MODAL ────────────────────────────────────────── */}
      {showNewsModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: 'var(--bg-surface)' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--text-primary)' }}>{editNewsId ? '✏️ Edit Article' : '➕ Add Article'}</div>
              <button className="modal-close" onClick={closeNewsModal}>✕</button>
            </div>
            <ErrBanner mut={newsMut} />
            <form onSubmit={saveNews}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { k: 'title',       l: 'Title *',       ph: 'Article title' },
                  { k: 'source_name', l: 'Source Name *', ph: 'e.g. The Hindu' },
                  { k: 'source_url',  l: 'Source URL',    ph: 'https://...' },
                ].map(f => (
                  <div key={f.k} className="form-group">
                    <label className="form-label">{f.l}</label>
                    <input className="form-input" style={INPUT} type="text" placeholder={f.ph}
                      value={newsForm[f.k]} onChange={e => setNewsForm(p => ({ ...p, [f.k]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Summary</label>
                  <textarea className="form-input" style={{ ...INPUT, resize: 'vertical', minHeight: 80 }} rows={3}
                    value={newsForm.summary} onChange={e => setNewsForm(p => ({ ...p, summary: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" style={INPUT} value={newsForm.category} onChange={e => setNewsForm(p => ({ ...p, category: e.target.value }))}>
                    <option value="govt">Government</option>
                    <option value="private">Private</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={newsMut.isPending}>
                  {newsMut.isPending ? <span style={{ display:'flex',alignItems:'center',gap:'.4rem' }}><Spinner/>Saving...</span> : editNewsId ? 'Update' : 'Save'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeNewsModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
