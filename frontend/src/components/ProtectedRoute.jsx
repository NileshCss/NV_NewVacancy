import React, { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'

/**
 * ProtectedRoute
 * --------------
 * Guards pages requiring standard student/user authentication.
 * Redirects to login if not signed in, storing the intended destination.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading, initialized } = useAuth()
  const { page, navigate } = useRouter()

  useEffect(() => {
    if (!initialized || loading) return
    if (!user) {
      sessionStorage.setItem('redirect_after_login', page)
      navigate('login')
    }
  }, [initialized, loading, user, page, navigate])

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
        <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Verifying secure session...</p>
      </div>
    )
  }

  // ── Not signed in (useEffect will handle redirect) ──
  if (!user) {
    return null
  }

  // ── User is authenticated — render content ───────────────────
  return children
}
