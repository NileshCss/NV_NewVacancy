import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useRouter } from '../context/RouterContext'
import { useAuth } from '../context/AuthContext'

export default function ResetPasswordPage() {
  const { navigate } = useRouter()

  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)
  const [showPw,      setShowPw]      = useState(false)

  const [sessionError, setSessionError] = useState('')
  const { isRecoverySession } = useAuth()

  // sessionReady is driven by the global isRecoverySession flag in AuthContext.
  // That flag is set when Supabase fires PASSWORD_RECOVERY — the most reliable
  // signal that the recovery token has been validated and the session is active.
  // We also keep a local getSession() fallback for cases where the event already
  // fired before this component mounted (e.g. very fast token exchange).
  useEffect(() => {
    if (isRecoverySession) {
      setSessionReady(true)
      return
    }

    // Fallback: if the page mounts after the event already fired, getSession()
    // should still return the active recovery session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    // Final timeout: if no session in 12s, the link was expired/already-used.
    const timer = setTimeout(() => {
      setSessionError('This reset link has expired or has already been used. Please request a new one.')
    }, 12000)

    return () => clearTimeout(timer)
  }, [isRecoverySession])


  const validate = () => {
    if (!password) return 'New password is required'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError('')
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr
      setSuccess(true)
      // Store success message so LoginPage can display it
      sessionStorage.setItem('pw_reset_success', '1')
      // Sign out to end the recovery session — user must log in with new password
      await supabase.auth.signOut()
      setTimeout(() => navigate('login'), 2500)
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = {
    minHeight: '100vh',
    background: 'var(--bg-base, #0a0f1e)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', fontFamily: 'DM Sans, Inter, sans-serif',
  }
  const box = {
    width: '100%', maxWidth: 440,
    background: 'var(--bg-surface, #111827)',
    border: '1px solid var(--border, rgba(255,255,255,0.08))',
    borderRadius: 24, padding: '2.5rem 2rem',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  }
  const inputStyle = {
    width: '100%', padding: '12px 14px',
    background: 'var(--bg-input, rgba(255,255,255,0.05))',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 12, color: 'var(--text-primary, #f1f5f9)',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const btn = (disabled) => ({
    width: '100%', padding: '13px',
    background: disabled ? 'var(--text-muted, #64748b)' : 'var(--brand, #f97316)',
    color: '#fff', border: 'none', borderRadius: 14,
    fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
    textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: '0.5rem', transition: 'all 0.2s',
    boxShadow: disabled ? 'none' : '0 8px 24px rgba(249,115,22,0.3)',
  })

  if (success) return (
    <div style={card}>
      <div style={{ ...box, textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
          Password Updated!
        </h2>
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Your password has been changed successfully.<br />
          Redirecting to login...
        </p>
        <div style={{
          marginTop: '1.5rem', width: 40, height: 40,
          border: '3px solid rgba(249,115,22,0.25)', borderTopColor: '#f97316',
          borderRadius: '50%', animation: 'nv-spin 0.7s linear infinite', margin: '1.5rem auto 0',
        }} />
        <style>{`@keyframes nv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  if (sessionError) return (
    <div style={card}>
      <div style={{ ...box, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
        <h2 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '1.3rem', marginBottom: '0.75rem' }}>
          Link Expired
        </h2>
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {sessionError}
        </p>
        <button
          onClick={() => navigate('login')}
          style={{
            padding: '0.7rem 1.5rem',
            background: 'var(--brand, #f97316)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(249,115,22,0.3)',
          }}
        >
          Back to Login
        </button>
        <style>{`@keyframes nv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  if (!sessionReady) return (

    <div style={card}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52,
          border: '3px solid rgba(249,115,22,0.25)', borderTopColor: '#f97316',
          borderRadius: '50%', animation: 'nv-spin 0.7s linear infinite', margin: '0 auto 1rem',
        }} />
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
          Verifying reset link...
        </p>
        <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Please wait, don't close this tab.
        </p>
        <style>{`@keyframes nv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  return (
    <div style={card}>
      <div style={box}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'rgba(249,115,22,0.12)', color: 'var(--brand, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', margin: '0 auto 1rem',
          }}>🔐</div>
          <h1 style={{
            color: 'var(--text-primary, #f1f5f9)', fontSize: '1.5rem',
            fontWeight: 900, margin: '0 0 0.4rem',
          }}>Set New Password</h1>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', margin: 0 }}>
            Choose a strong password for your account
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: '1rem',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center',
          }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* New Password */}
          <div>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-muted, #94a3b8)', marginBottom: '6px',
            }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                style={inputStyle}
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '1rem',
                }}
              >{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-muted, #94a3b8)', marginBottom: '6px',
            }}>Confirm Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Repeat your new password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              style={{
                ...inputStyle,
                borderColor: confirm && password !== confirm ? 'rgba(239,68,68,0.5)' : undefined,
              }}
              disabled={loading}
            />
            {confirm && password !== confirm && (
              <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>
                Passwords do not match
              </p>
            )}
          </div>

          {/* Password strength hint */}
          {password && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: password.length >= 8 ? 'rgba(34,197,94,0.08)' : 'rgba(249,115,22,0.08)',
              border: `1px solid ${password.length >= 8 ? 'rgba(34,197,94,0.2)' : 'rgba(249,115,22,0.2)'}`,
              fontSize: '0.75rem', color: password.length >= 8 ? '#4ade80' : '#fb923c',
            }}>
              {password.length >= 8 ? '✅ Strong enough' : `⚠️ Need ${8 - password.length} more character(s)`}
            </div>
          )}

          <button type="submit" disabled={loading} style={btn(loading)}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => navigate('login')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem',
            }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
