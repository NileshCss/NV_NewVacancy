import React, { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'

/**
 * ProtectedAdminRoute
 * -------------------
 * Guards admin-only pages. Shows a spinner while auth is loading,
 * redirects to login if not signed in, shows "Access Denied" if not admin.
 */
export default function ProtectedAdminRoute({ children }) {
  const { user, profile, loading, initialized, isAdmin, signOut } = useAuth()
  const { navigate } = useRouter()

  // If auth finishes loading and there's no user, send to login
  useEffect(() => {
    if (!initialized || loading) return
    if (!user) navigate('login')
  }, [initialized, loading, user, navigate])

  // ── Still loading session ─────────────────────────────────────
  if (!initialized || loading) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 44,
          height: 44,
          border: '3px solid var(--brand)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Verifying access...</p>
      </div>
    )
  }

  // ── Not signed in (render nothing — useEffect handles redirect) ──
  if (!user) {
    return null
  }

  // ── Profile still loading (just signed in, profile fetch in progress) ──
  // Wait up to a moment for profile to arrive before showing access denied
  if (!profile) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 44,
          height: 44,
          border: '3px solid var(--brand)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Loading profile...</p>
      </div>
    )
  }

  // ── Signed in but not admin ────────────────────────────────────────────────
  // Use `isAdmin` as the single source of truth (it checks role + is_blocked).
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'var(--bg-base)',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <div style={{ fontSize: '3rem' }}>⛔</div>
        <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Access Denied</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>
          Your account (<strong style={{ color: 'var(--text-secondary)' }}>{user?.email}</strong>) does not
          have admin privileges. Contact the site owner if you believe this is a mistake.
        </p>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('home')}>Go Home</button>
          <button
            className="btn btn-ghost"
            onClick={async () => { await signOut(); navigate('login') }}
          >
            Sign in as Admin
          </button>
        </div>
      </div>
    )
  }

  // ── User is admin — render protected content ───────────────────
  return children
}
