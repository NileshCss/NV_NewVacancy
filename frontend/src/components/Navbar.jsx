import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from '../context/RouterContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const { page, navigate } = useRouter()
  const { user, profile, signOut, isAdmin } = useAuth()
  const toast = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropOpen,   setDropOpen]   = useState(false)
  const dropRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close dropdown on page change
  useEffect(() => { setDropOpen(false) }, [page])

  const navLinks = [
    { id: 'govt-jobs',    label: 'Govt Jobs',    badge: 'HOT' },
    { id: 'private-jobs', label: 'Private Jobs', badge: null  },
    { id: 'news',         label: 'News',         badge: null  },
    { id: 'affiliates',   label: '🎁 Offers',    badge: null  },
    { id: 'career-ai',    label: '🤖 A.I',       badge: 'NEW' },
  ]

  const handleLogout = async () => {
    setDropOpen(false)
    setMobileOpen(false)
    try {
      await signOut()
    } catch (err) {
      // signOut() in AuthContext already catches internal errors.
      // This catch is a last-resort safety net — log but don't alarm user
      // since the session is already cleared from state.
      console.warn('[NV] Logout catch (state already cleared):', err?.message)
    }
    // Navigate to home — the auth state change will handle the UI update
    navigate('home')
  }

  const go = (dest) => { navigate(dest); setDropOpen(false); setMobileOpen(false) }

  // True if current user is admin — double-check both context and profile
  const showAdmin = isAdmin || profile?.role === 'admin'

  // Display name / avatar initial
  const displayName   = profile?.full_name || user?.email?.split('@')[0] || 'User'
  const avatarLetter  = displayName[0].toUpperCase()

  return (
    <header className="navbar">
      <div className="container">
        <nav className="nav-inner">

          {/* Logo */}
          <div className="logo" onClick={() => navigate('home')}>
            <div className="logo-box">NV</div>
            <div className="logo-text"><span>New_</span><span>vacancy</span></div>
          </div>

          {/* Desktop nav links */}
          <div className="nav-links">
            {navLinks.map(l => (
              <div key={l.id}
                className={`nav-link ${page === l.id ? 'active' : ''}`}
                onClick={() => navigate(l.id)}>
                {l.label}
                {l.badge && <span className="nav-badge">{l.badge}</span>}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div className="nav-right">
            <ThemeToggle />

            {user ? (
              <div style={{ position: 'relative' }} ref={dropRef}>
                {/* Avatar trigger */}
                <div
                  id="user-menu-trigger"
                  style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', padding: '.3rem .6rem', borderRadius: '10px', transition: 'background .2s' }}
                  onClick={() => setDropOpen(!dropOpen)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--white-8)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="avatar">{avatarLetter}</div>
                  <span style={{ fontSize: '.82rem', color: 'var(--text-secondary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  {showAdmin && (
                    <span style={{ fontSize: '.6rem', background: 'var(--brand)', color: '#fff', borderRadius: '4px', padding: '1px 5px', fontWeight: 700, letterSpacing: '.03em' }}>
                      ADMIN
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '.7rem', transition: 'transform .2s', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </div>

                {/* Dropdown */}
                {dropOpen && (
                  <div className="dropdown" style={{ minWidth: 210 }}>

                    {/* User info header */}
                    <div style={{ padding: '.6rem 1rem .4rem', borderBottom: '1px solid var(--border)', marginBottom: '.3rem' }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                    </div>

                    {/* ── ADMIN DASHBOARD (only for admins) ── */}
                    {showAdmin && (
                      <div
                        id="admin-dashboard-link"
                        className="dropdown-item"
                        onClick={() => go('admin')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '.6rem',
                          background: page === 'admin' ? 'rgba(249,115,22,0.1)' : undefined,
                          color: 'var(--brand)',
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>⚡</span>
                        <span>Admin Dashboard</span>
                        <span style={{ marginLeft: 'auto', fontSize: '.65rem', background: 'var(--brand)', color: '#fff', borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>
                          ADMIN
                        </span>
                      </div>
                    )}

                    {/* Saved Jobs */}
                    <div className="dropdown-item" onClick={() => go('saved-jobs')}
                      style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                      <span>🔖</span>
                      <span>Saved Jobs</span>
                    </div>

                    <div className="dropdown-divider" />

                    {/* Sign Out */}
                    <div className="dropdown-item danger" onClick={handleLogout}
                      style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                      <span>↩</span>
                      <span>Sign Out</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm"   onClick={() => navigate('login')}>Sign In</button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('signup')}>Get Started</button>
              </>
            )}

            <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
          {navLinks.map(l => (
            <div key={l.id}
              className={`nav-link ${page === l.id ? 'active' : ''}`}
              onClick={() => go(l.id)}>
              {l.label}
            </div>
          ))}

          {user ? (
            <>
              {showAdmin && (
                <div className="nav-link"
                  style={{ color: 'var(--brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.5rem' }}
                  onClick={() => go('admin')}>
                  ⚡ Admin Dashboard
                  <span style={{ fontSize: '.6rem', background: 'var(--brand)', color: '#fff', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>ADMIN</span>
                </div>
              )}
              <div className="nav-link" onClick={() => go('saved-jobs')}>🔖 Saved Jobs</div>
              <div className="nav-link" style={{ color: 'var(--red)' }} onClick={handleLogout}>↩ Sign Out</div>
            </>
          ) : (
            <>
              <div className="nav-link" onClick={() => go('login')}>Sign In</div>
              <div className="nav-link" style={{ color: 'var(--brand-l)' }} onClick={() => go('signup')}>Get Started</div>
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
