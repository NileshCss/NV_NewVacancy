import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { ALL_JOBS, NEWS_DATA, AFFILIATES } from '../data/mockData'
import { timeAgo } from '../utils/helpers'

export default function AdminPanel() {
  const { isAdmin, navigate: navAuth } = useAuth()
  const { navigate } = useRouter()
  const toast = useToast()
  const [section, setSection] = useState('dashboard')
  const [showAddJob, setShowAddJob] = useState(false)
  const [showAddNews, setShowAddNews] = useState(false)
  const [showAddAff, setShowAddAff] = useState(false)
  const [jobs, setJobs] = useState(ALL_JOBS.slice())
  const [news, setNews] = useState(NEWS_DATA.slice())
  const [affs, setAffs] = useState(AFFILIATES.slice())

  if (!isAdmin) return (
    <div className="empty-state" style={{ marginTop: '5rem' }}>
      <div className="empty-icon">🔒</div>
      <div className="empty-title">Admin Access Required</div>
      <div className="empty-text">Use admin@nv.com / admin123</div>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('login')}>Sign In as Admin</button>
    </div>
  )

  const NAV = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'jobs', label: '💼 Jobs' },
    { id: 'news', label: '📰 News' },
    { id: 'affiliates', label: '🎁 Affiliates' },
  ]

  const STATS_ADMIN = [
    { icon: '💼', val: jobs.filter(j => j.is_active !== false).length, label: 'Active Jobs', color: 'var(--blue)' },
    { icon: '📰', val: news.length, label: 'News Articles', color: 'var(--purple)' },
    { icon: '🎁', val: affs.length, label: 'Affiliates', color: 'var(--brand)' },
    { icon: '👥', val: '1,240', label: 'Total Users', color: 'var(--green)' },
  ]

  // Add Job Form
  const AddJobModal = () => {
    const [f, setF] = useState({ title: '', organization: '', category: 'govt', location: 'All India', apply_url: 'https://', salary_range: '', vacancies: '', last_date: '' })
    const save = (e) => {
      e.preventDefault()
      const newJob = { ...f, id: 'j_' + Date.now(), vacancies: parseInt(f.vacancies) || 0, is_featured: false, is_active: true, tags: [], posted_at: new Date().toISOString() }
      setJobs(j => [newJob, ...j])
      toast('Job added successfully! ✅', 'success')
      setShowAddJob(false)
    }
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">➕ Add New Job</div>
            <button className="modal-close" onClick={() => setShowAddJob(false)}>✕</button>
          </div>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[{ k: 'title', l: 'Job Title', c: '1/-1' }, { k: 'organization', l: 'Organization' }, { k: 'location', l: 'Location' }, { k: 'salary_range', l: 'Salary Range' }, { k: 'vacancies', l: 'No. of Posts', t: 'number' }, { k: 'last_date', l: 'Last Date', t: 'date' }, { k: 'apply_url', l: 'Apply URL', c: '1/-1' }].map(f2 => (
                <div key={f2.k} className="form-group" style={{ gridColumn: f2.c || 'auto' }}>
                  <label className="form-label">{f2.l}</label>
                  <input className="form-input" type={f2.t || 'text'} required={['title', 'organization', 'apply_url'].includes(f2.k)} value={f[f2.k]} onChange={e => setF({ ...f, [f2.k]: e.target.value })} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="filter-select form-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
                  <option value="govt">Government</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Job</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddJob(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Add News Modal
  const AddNewsModal = () => {
    const [f, setF] = useState({ title: '', summary: '', source_name: '', source_url: 'https://', category: 'govt' })
    const save = (e) => {
      e.preventDefault()
      setNews(n => [{ ...f, id: 'n_' + Date.now(), is_featured: false, is_active: true, published_at: new Date().toISOString() }, ...n])
      toast('News article added! ✅', 'success')
      setShowAddNews(false)
    }
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">➕ Add News Article</div>
            <button className="modal-close" onClick={() => setShowAddNews(false)}>✕</button>
          </div>
          <form onSubmit={save}>
            <div className="form-group"><label className="form-label">Title</label><input className="form-input" required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Summary</label><textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group"><label className="form-label">Source Name</label><input className="form-input" required value={f.source_name} onChange={e => setF({ ...f, source_name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Category</label>
                <select className="filter-select form-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
                  {['govt', 'tech', 'education', 'general'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Source URL</label><input className="form-input" type="url" value={f.source_url} onChange={e => setF({ ...f, source_url: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Article</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddNews(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Add Affiliate Modal
  const AddAffModal = () => {
    const [f, setF] = useState({ name: '', description: '', redirect_url: 'https://', category: 'exam-prep', emoji: '📚', placement: 'sidebar' })
    const save = (e) => {
      e.preventDefault()
      setAffs(a => [...a, { ...f, id: 'a_' + Date.now(), clicks: 0, is_active: true }])
      toast('Affiliate added! ✅', 'success')
      setShowAddAff(false)
    }
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">➕ Add Affiliate</div>
            <button className="modal-close" onClick={() => setShowAddAff(false)}>✕</button>
          </div>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Name</label><input className="form-input" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><input className="form-input" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Redirect URL</label><input className="form-input" type="url" required value={f.redirect_url} onChange={e => setF({ ...f, redirect_url: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Category</label>
                <select className="filter-select form-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
                  {['exam-prep', 'courses', 'books', 'tools', 'general'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Placement</label>
                <select className="filter-select form-input" value={f.placement} onChange={e => setF({ ...f, placement: e.target.value })}>
                  {['hero', 'sidebar', 'inline', 'footer'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Emoji Icon</label><input className="form-input" value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Affiliate</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddAff(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-title">Admin Panel</div>
        {NAV.map(n => (
          <div key={n.id} className={`admin-nav-item ${section === n.id ? 'active' : ''}`} onClick={() => setSection(n.id)}>
            {n.label}
          </div>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--white-8)', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <div className="admin-nav-item" onClick={() => navigate('home')}>← Back to Site</div>
        </div>
      </div>

      {/* Content */}
      <div className="admin-content">
        {/* Dashboard */}
        {section === 'dashboard' && (
          <>
            <div className="admin-header">
              <div className="admin-title">📊 Dashboard</div>
              <div style={{ fontSize: '.82rem', color: 'var(--grey-5)' }}>Welcome, Admin ⚡</div>
            </div>
            <div className="admin-cards">
              {STATS_ADMIN.map(s => (
                <div key={s.label} className="admin-stat-card">
                  <div className="admin-stat-icon">{s.icon}</div>
                  <div className="admin-stat-val">{s.val}</div>
                  <div className="admin-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="admin-stat-card">
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>📈 Recent Activity</div>
                {[{ t: 'New job posted: SSC CGL 2024', time: '2m ago' }, { t: 'News article updated: UPSC Calendar', time: '15m ago' }, { t: 'Affiliate click: Adda247 (×12)', time: '1h ago' }, { t: 'New user signup', time: '2h ago' }].map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '.6rem 0', borderBottom: '1px solid var(--white-8)', fontSize: '.82rem' }}>
                    <span style={{ color: 'var(--grey-3)' }}>{a.t}</span>
                    <span style={{ color: 'var(--grey-5)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>{a.time}</span>
                  </div>
                ))}
              </div>
              <div className="admin-stat-card">
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>🎁 Top Affiliates</div>
                {affs.slice(0, 4).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem 0', borderBottom: '1px solid var(--white-8)' }}>
                    <span style={{ fontSize: '.85rem', color: 'var(--grey-3)' }}>{a.emoji} {a.name}</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--brand-l)', fontWeight: 700 }}>{(a.clicks || 0).toLocaleString()} clicks</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Jobs Management */}
        {section === 'jobs' && (
          <>
            <div className="admin-header">
              <div className="admin-title">💼 Manage Jobs</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddJob(true)}>+ Add Job</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Title</th><th>Org</th><th>Category</th><th>Vacancies</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</td>
                      <td>{j.organization.split(' ').slice(0, 2).join(' ')}</td>
                      <td><span className={`badge badge-${j.category === 'govt' ? 'green' : 'blue'}`}>{j.category}</span></td>
                      <td>{(j.vacancies || 0).toLocaleString()}</td>
                      <td><span className={`badge ${j.is_active !== false ? 'badge-green' : 'badge-red'}`}>{j.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '.35rem' }}>
                          <button className="action-btn action-edit" onClick={() => toast('Edit coming soon', 'info')}>Edit</button>
                          <button className="action-btn action-del" onClick={() => { setJobs(js => js.filter(x => x.id !== j.id)); toast('Job deleted', 'success'); }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* News Management */}
        {section === 'news' && (
          <>
            <div className="admin-header">
              <div className="admin-title">📰 Manage News</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddNews(true)}>+ Add Article</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Title</th><th>Source</th><th>Category</th><th>Published</th><th>Actions</th></tr></thead>
                <tbody>
                  {news.map(n => (
                    <tr key={n.id}>
                      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</td>
                      <td>{n.source_name}</td>
                      <td><span className="badge badge-blue">{n.category}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{timeAgo(n.published_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '.35rem' }}>
                          <button className="action-btn action-edit" onClick={() => toast('Edit coming soon', 'info')}>Edit</button>
                          <button className="action-btn action-del" onClick={() => { setNews(ns => ns.filter(x => x.id !== n.id)); toast('Article deleted', 'success'); }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Affiliates Management */}
        {section === 'affiliates' && (
          <>
            <div className="admin-header">
              <div className="admin-title">🎁 Manage Affiliates</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddAff(true)}>+ Add Affiliate</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Category</th><th>Placement</th><th>Clicks</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {affs.map(a => (
                    <tr key={a.id}>
                      <td>{a.emoji} {a.name}</td>
                      <td>{a.category}</td>
                      <td><span className="badge badge-blue">{a.placement}</span></td>
                      <td style={{ color: 'var(--brand-l)', fontWeight: 700 }}>{(a.clicks || 0).toLocaleString()}</td>
                      <td><span className="badge badge-green">Active</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '.35rem' }}>
                          <button className="action-btn action-edit" onClick={() => toast('Edit coming soon', 'info')}>Edit</button>
                          <button className="action-btn action-del" onClick={() => { setAffs(as => as.filter(x => x.id !== a.id)); toast('Affiliate deleted', 'success'); }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showAddJob && <AddJobModal />}
      {showAddNews && <AddNewsModal />}
      {showAddAff && <AddAffModal />}
    </div>
  )
}
