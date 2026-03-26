import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from '../context/RouterContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const { page, navigate } = useRouter()
  const { user, logout, isAdmin } = useAuth()
  const toast = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navLinks = [
    { id: 'govt-jobs', label: 'Govt Jobs', badge: 'HOT' },
    { id: 'private-jobs', label: 'Private Jobs', badge: null },
    { id: 'news', label: 'News', badge: null },
    { id: 'affiliates', label: '🎁 Offers', badge: 'NEW' },
  ]

  const handleLogout = () => {
    logout()
    setDropOpen(false)
    toast('Signed out successfully', 'success')
    navigate('home')
  }

  return (
    <header className="navbar">
      <div className="container">
        <nav className="nav-inner">
          <div className="logo" onClick={() => navigate('home')}>
            <div className="logo-box">NV</div>
            <div className="logo-text"><span>New_</span><span>vacancy</span></div>
          </div>

          <div className="nav-links">
            {navLinks.map(l => (
              <div key={l.id} className={`nav-link ${page === l.id ? 'active' : ''}`} onClick={() => navigate(l.id)}>
                {l.label}
                {l.badge && <span className="nav-badge">{l.badge}</span>}
              </div>
            ))}
          </div>

          <div className="nav-right">
            <ThemeToggle />

            {user ? (
              <div style={{ position: 'relative' }} ref={dropRef}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', padding: '.3rem .6rem', borderRadius: '10px' }} onClick={() => setDropOpen(!dropOpen)}>
                  <div className="avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
                  <span style={{ fontSize: '.82rem', color: 'var(--text-secondary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>▾</span>
                </div>
                {dropOpen && (
                  <div className="dropdown">
                    <div className="dropdown-item" onClick={() => { navigate('saved-jobs'); setDropOpen(false); }}>🔖 Saved Jobs</div>
                    {isAdmin && <div className="dropdown-item admin" onClick={() => { navigate('admin'); setDropOpen(false); }}>⚡ Admin Panel</div>}
                    <div className="dropdown-divider" />
                    <div className="dropdown-item danger" onClick={handleLogout}>↩ Sign Out</div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('login')}>Sign In</button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('signup')}>Get Started</button>
              </>
            )}
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </nav>

        <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
          {navLinks.map(l => (
            <div key={l.id} className={`nav-link ${page === l.id ? 'active' : ''}`} onClick={() => { navigate(l.id); setMobileOpen(false); }}>
              {l.label}
            </div>
          ))}
          {!user && (
            <>
              <div className="nav-link" onClick={() => { navigate('login'); setMobileOpen(false); }}>Sign In</div>
              <div className="nav-link" style={{ color: 'var(--brand-l)' }} onClick={() => { navigate('signup'); setMobileOpen(false); }}>Get Started</div>
            </>
          )}
          <div style={{ padding: '0.75rem 1rem' }}>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
