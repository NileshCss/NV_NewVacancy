import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth }   from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast }  from '../context/ToastContext'
import ThemeToggle   from './ThemeToggle'

const NAV_LINKS = [
  { id: 'govt-jobs',    label: 'Govt Jobs',    badge: 'HOT' },
  { id: 'private-jobs', label: 'Private Jobs', badge: null  },
  { id: 'news',         label: 'News',         badge: null  },
  { id: 'affiliates',   label: '🎁 Offers',    badge: 'NEW' },
  { id: 'ai',           label: '🤖 A.I',        badge: 'NEW' },
]

export default function Navbar() {
  const {
    user,
    isAdmin,
    displayName,
    avatarLetter,
    signOut,
  } = useAuth()

  const { page, navigate } = useRouter()
  const toast = useToast()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropOpen,   setDropOpen]   = useState(false)
  const dropRef = useRef(null)

  // ── Close dropdown on outside click ─────────────────
  useEffect(() => {
    const onOutside = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // ── Close mobile menu on nav ─────────────────────────
  const goTo = useCallback((id) => {
    navigate(id)
    setMobileOpen(false)
    setDropOpen(false)
  }, [navigate])

  // ── Sign out handler ─────────────────────────────────
  const handleSignOut = async () => {
    console.log('[Navbar] Sign out clicked')
    setDropOpen(false)
    setMobileOpen(false)
    
    try {
      console.log('[Navbar] Calling signOut...')
      await signOut()
      console.log('[Navbar] signOut completed')
      // Small delay to ensure state updates are flushed before navigation
      await new Promise(resolve => setTimeout(resolve, 50))
      console.log('[Navbar] Navigating to home...')
      navigate('home')
      toast('Signed out successfully', 'success')
    } catch (err) {
      console.error('[Navbar] Sign out error:', err)
      navigate('home')
    }
  }

  return (
    <header className="navbar">
      <div className="container">
        <nav className="nav-inner">

          {/* ── Logo ─────────────────────────────────── */}
          <div className="logo" onClick={() => goTo('home')}>
            <div className="logo-box">NV</div>
            <div className="logo-text">
              <span>New_</span>
              <span>vacancy</span>
            </div>
          </div>

          {/* ── Desktop Nav Links ─────────────────────── */}
          <div className="nav-links">
            {NAV_LINKS.map(link => (
              <div
                key={link.id}
                className={`nav-link ${
                  page === link.id ? 'active' : ''
                }`}
                onClick={() => goTo(link.id)}
              >
                {link.label}
                {link.badge && (
                  <span className="nav-badge">{link.badge}</span>
                )}
              </div>
            ))}
          </div>

          {/* ── Right Side ───────────────────────────── */}
          <div className="nav-right">

            {/* Theme Toggle */}
            <ThemeToggle />

            {user ? (
              /* ── User Dropdown ───────────────────── */
              <div ref={dropRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropOpen(o => !o)}
                  style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         '0.5rem',
                    padding:     '0.35rem 0.6rem',
                    borderRadius:'10px',
                    background:  'transparent',
                    border:      'none',
                    cursor:      'pointer',
                  }}
                >
                  {/* Avatar circle */}
                  <div
                    className="avatar"
                    style={{
                      background: isAdmin
                        ? 'linear-gradient(135deg, #f97316, #ea6c0a)'
                        : 'var(--brand)',
                      boxShadow: isAdmin
                        ? '0 0 10px rgba(249,115,22,0.4)'
                        : 'none',
                    }}
                  >
                    {avatarLetter}
                  </div>

                  {/* Name + role label */}
                  <div style={{
                    display:       'flex',
                    flexDirection: 'column',
                    alignItems:    'flex-start',
                    lineHeight:    1.2,
                  }}>
                    <span style={{
                      fontSize:       '0.82rem',
                      color:          'var(--text-secondary)',
                      maxWidth:       '110px',
                      overflow:       'hidden',
                      textOverflow:   'ellipsis',
                      whiteSpace:     'nowrap',
                      fontWeight:     600,
                    }}>
                      {displayName}
                    </span>
                    {isAdmin && (
                      <span style={{
                        fontSize:      '0.58rem',
                        color:         'var(--brand)',
                        fontWeight:    800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}>
                        ⚡ Admin
                      </span>
                    )}
                  </div>

                  <span style={{
                    color:    'var(--text-muted)',
                    fontSize: '0.65rem',
                  }}>
                    ▾
                  </span>
                </button>

                {/* Dropdown menu */}
                {dropOpen && (
                  <div className="dropdown">
                    {/* Profile header */}
                    <div style={{
                      padding:      '0.75rem 1rem 0.6rem',
                      borderBottom: '1px solid var(--border)',
                      marginBottom: '0.3rem',
                    }}>
                      <div style={{
                        fontSize:  '0.88rem',
                        fontWeight: 700,
                        color:     'var(--text-primary)',
                      }}>
                        {displayName}
                        {isAdmin && (
                          <span style={{
                            marginLeft:    '0.4rem',
                            fontSize:      '0.65rem',
                            color:         'var(--brand)',
                            fontWeight:    800,
                            textTransform: 'uppercase',
                          }}>
                            (Admin)
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize:     '0.73rem',
                        color:        'var(--text-muted)',
                        marginTop:    '0.1rem',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                      }}>
                        {user.email}
                      </div>
                    </div>

                    {/* Saved Jobs */}
                    <div
                      className="dropdown-item"
                      onClick={() => goTo('saved-jobs')}
                    >
                      🔖 Saved Jobs
                    </div>

                    {/* Admin Panel — only for admin */}
                    {isAdmin && (
                      <div
                        className="dropdown-item admin"
                        onClick={() => goTo('admin')}
                      >
                        ⚡ Admin Panel
                      </div>
                    )}

                    <div className="dropdown-divider"/>

                    {/* Sign Out */}
                    <div
                      className="dropdown-item danger"
                      onClick={handleSignOut}
                    >
                      ↩ Sign Out
                    </div>
                  </div>
                )}
              </div>

            ) : (
              /* ── Guest buttons ─────────────────────── */
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => goTo('login')}
                >
                  Sign In
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => goTo('signup')}
                >
                  Get Started
                </button>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </nav>

        {/* ── Mobile Menu ────────────────────────────── */}
        <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
          {NAV_LINKS.map(link => (
            <div
              key={link.id}
              className={`nav-link ${
                page === link.id ? 'active' : ''
              }`}
              onClick={() => goTo(link.id)}
            >
              {link.label}
            </div>
          ))}

          {isAdmin && (
            <div
              className="nav-link"
              style={{ color: 'var(--brand)' }}
              onClick={() => goTo('admin')}
            >
              ⚡ Admin Panel
            </div>
          )}

          {!user && (
            <>
              <div
                className="nav-link"
                onClick={() => goTo('login')}
              >
                Sign In
              </div>
              <div
                className="nav-link"
                style={{ color: 'var(--brand-l)' }}
                onClick={() => goTo('signup')}
              >
                Get Started
              </div>
            </>
          )}

          {user && (
            <div
              className="nav-link"
              style={{ color: 'var(--red)' }}
              onClick={handleSignOut}
            >
              ↩ Sign Out
            </div>
          )}

          <div style={{ padding: '0.75rem 1rem' }}>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}