import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { useRouter } from '../context/RouterContext'
import { useAuth } from '../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD STRENGTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '#475569' }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Too weak',  color: '#ef4444' }
  if (score === 2) return { score, label: 'Weak',     color: '#f97316' }
  if (score === 3) return { score, label: 'Fair',     color: '#eab308' }
  if (score === 4) return { score, label: 'Strong',   color: '#22c55e' }
  return               { score, label: 'Very strong', color: '#16a34a' }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const { navigate }          = useRouter()
  const { isRecoverySession } = useAuth()

  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)

  // 'pending'  — waiting for Supabase PASSWORD_RECOVERY event
  // 'ready'    — recovery session active, show the form
  // 'expired'  — link expired / invalid / already used
  const [sessionState, setSessionState] = useState('pending')
  const [sessionMsg,   setSessionMsg]   = useState('')

  const resolvedRef = useRef(false) // ensure we only resolve once

  // ── Resolve recovery session ──────────────────────────────────────────────
  //
  // HOW THIS WORKS (PKCE flow):
  //
  // The Supabase client is created with detectSessionInUrl:true + flowType:'pkce'.
  // When the user clicks the reset email link:
  //   https://newvacancy.live/auth/reset-password?code=XXXX
  //
  // Supabase-js automatically detects the ?code= param and calls
  // exchangeCodeForSession() internally during client initialisation.
  // After a successful exchange, it fires onAuthStateChange('PASSWORD_RECOVERY').
  //
  // ⚠️  DO NOT call exchangeCodeForSession() manually here.
  //     That would consume the one-time PKCE token a second time,
  //     causing Supabase to return otp_expired — exactly the bug we had.
  //
  // The correct approach: just listen for the events Supabase fires.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {

    const resolve = (state, msg = '') => {
      if (resolvedRef.current) return
      resolvedRef.current = true
      setSessionState(state)
      if (msg) setSessionMsg(msg)
    }

    // ── Fast path: AuthContext already captured PASSWORD_RECOVERY ─────────
    // AuthContext's onAuthStateChange listener runs application-wide.
    // If it already received PASSWORD_RECOVERY before this component mounted,
    // isRecoverySession is already true — skip straight to the form.
    if (isRecoverySession) {
      resolve('ready')
      return
    }

    // ── Check for explicit error params in URL (Supabase sends these when ──
    // the link is already expired/invalid before we even try to use it).
    // Example: ?error=access_denied&error_code=otp_expired&error_description=...
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, '?'))

    const urlError = params.get('error') || hashParams.get('error')
    const urlErrorCode = params.get('error_code') || hashParams.get('error_code')
    const urlErrorDesc = params.get('error_description') || hashParams.get('error_description')

    if (urlError || urlErrorCode === 'otp_expired') {
      const msg = urlErrorDesc
        ? decodeURIComponent(urlErrorDesc.replace(/\+/g, ' '))
        : 'This reset link has expired or has already been used.'
      resolve('expired', msg)
      return
    }

    // ── Listen for Supabase auth events ──────────────────────────────────
    // detectSessionInUrl:true causes the client to auto-exchange the ?code=
    // param. After exchange it fires PASSWORD_RECOVERY (or SIGNED_IN for
    // some Supabase versions). We listen here and resolve accordingly.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolvedRef.current) return

      if (event === 'PASSWORD_RECOVERY' && session) {
        resolve('ready')
        return
      }

      // Some Supabase JS versions fire SIGNED_IN instead of PASSWORD_RECOVERY
      // for recovery links. Accept it only when on the reset page AND there's
      // a recovery marker in the URL to avoid false positives from normal logins.
      if (event === 'SIGNED_IN' && session) {
        const onResetPage = window.location.pathname.includes('reset-password')
        const hasCode = params.has('code')
        const hasRecoveryHash =
          window.location.hash.includes('type=recovery') ||
          window.location.search.includes('type=recovery')

        if (onResetPage && (hasCode || hasRecoveryHash)) {
          resolve('ready')
        }
      }
    })

    // ── Timeout: if no event arrives within 12s, the link was bad ─────────
    const timer = setTimeout(() => {
      if (!resolvedRef.current) {
        resolve('expired', 'This reset link has expired or has already been used. Please request a new one.')
      }
    }, 12000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [isRecoverySession])

  // ── Password update ───────────────────────────────────────────────────────
  const strength = getStrength(password)

  const validate = () => {
    if (!password)           return 'New password is required.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (strength.score < 2)  return 'Password is too weak. Add uppercase letters, numbers, or symbols.'
    if (password !== confirm) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError('')
    try {
      // Wrap updateUser in a 10-second timeout so we never hang forever
      const updatePromise = supabase.auth.updateUser({ password })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 10000)
      )
      const { error: updateErr } = await Promise.race([updatePromise, timeoutPromise])
      if (updateErr) throw updateErr

      // Show success IMMEDIATELY — don't block on server-side cleanup
      sessionStorage.setItem('pw_reset_success', '1')
      setSuccess(true)

      // Clear local caches synchronously (instant)
      try { localStorage.removeItem('nv_auth') }    catch {}
      try { localStorage.removeItem('nv_profile') } catch {}

      // Fire-and-forget: sign out in background WITHOUT awaiting.
      // scope:'global' is a heavy server call (5–15s) — never block the UI on it.
      supabase.auth.signOut().catch(() => {})

      // Redirect to login after success animation
      setTimeout(() => navigate('login'), 2500)

    } catch (err) {
      const msg = err?.message || ''
      if (msg.toLowerCase().includes('same password')) {
        setError('New password must be different from your current password.')
      } else if (msg.toLowerCase().includes('weak')) {
        setError('Password is too weak. Please choose a stronger one.')
      } else if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('timed out')) {
        setError(msg.includes('timed out')
          ? 'Request timed out. Please refresh the page and try again.'
          : 'Session expired. Please request a new password reset link.')
      } else {
        setError(msg || 'Failed to update password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────

  const S = {
    page: {
      minHeight: '100vh',
      background: 'var(--bg-base, #0a0f1e)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'DM Sans, Inter, sans-serif',
    },
    card: {
      width: '100%', maxWidth: 440,
      background: 'var(--bg-surface, #111827)',
      border: '1px solid var(--border, rgba(255,255,255,0.08))',
      borderRadius: 24, padding: '2.5rem 2rem',
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    },
    label: {
      display: 'block', fontSize: 11, fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--text-muted, #94a3b8)', marginBottom: 6,
    },
    input: {
      width: '100%', padding: '12px 44px 12px 14px',
      background: 'var(--bg-input, rgba(255,255,255,0.05))',
      border: '1px solid var(--border, rgba(255,255,255,0.1))',
      borderRadius: 12, color: 'var(--text-primary, #f1f5f9)',
      fontSize: 14, outline: 'none', boxSizing: 'border-box',
      transition: 'border-color 0.2s',
    },
    eyeBtn: {
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-muted, #64748b)', fontSize: '1.1rem', lineHeight: 1,
      padding: 0,
    },
    submitBtn: (dis) => ({
      width: '100%', padding: '13px',
      background: dis ? '#334155' : 'linear-gradient(135deg,#f97316,#ea580c)',
      color: dis ? '#64748b' : '#fff',
      border: 'none', borderRadius: 14,
      fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
      textTransform: 'uppercase', cursor: dis ? 'not-allowed' : 'pointer',
      marginTop: '0.5rem', transition: 'all 0.2s',
      boxShadow: dis ? 'none' : '0 8px 24px rgba(249,115,22,0.3)',
    }),
  }

  const KF = `@keyframes nv-spin { to { transform: rotate(360deg); } }
              @keyframes nv-pop  { 0%{transform:scale(.7);opacity:0} 80%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }`

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER STATES
  // ─────────────────────────────────────────────────────────────────────────

  // ── Success ──────────────────────────────────────────────────────────────
  if (success) return (
    <div style={S.page}>
      <style>{KF}</style>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem', animation: 'nv-pop 0.4s ease' }}>✅</div>
        <h2 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '1.4rem', margin: '0 0 0.5rem' }}>
          Password Updated!
        </h2>
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          Your password has been changed successfully.<br />
          You've been signed out of all devices.<br />
          Redirecting to login...
        </p>
        <div style={{
          width: 36, height: 36,
          border: '3px solid rgba(249,115,22,0.2)', borderTopColor: '#f97316',
          borderRadius: '50%', animation: 'nv-spin 0.7s linear infinite', margin: '0 auto',
        }} />
      </div>
    </div>
  )

  // ── Expired / invalid link ────────────────────────────────────────────────
  if (sessionState === 'expired') return (
    <div style={S.page}>
      <style>{KF}</style>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
        <h2 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '1.3rem', margin: '0 0 0.75rem' }}>
          Link Expired
        </h2>
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          {sessionMsg || 'This reset link has expired or has already been used.'}
          <br />
          <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Reset links expire after 1 hour and can only be used once.</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => navigate('login')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(249,115,22,0.3)',
            }}
          >
            Request New Reset Link
          </button>
          <button
            onClick={() => navigate('home')}
            style={{
              padding: '0.6rem', background: 'none', border: 'none',
              color: 'var(--text-muted, #94a3b8)', fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  )

  // ── Pending (verifying token) ─────────────────────────────────────────────
  if (sessionState === 'pending') return (
    <div style={S.page}>
      <style>{KF}</style>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{
          width: 52, height: 52,
          border: '3px solid rgba(249,115,22,0.2)', borderTopColor: '#f97316',
          borderRadius: '50%', animation: 'nv-spin 0.7s linear infinite', margin: '0 auto 1.25rem',
        }} />
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem', fontWeight: 500 }}>
          Verifying reset link...
        </p>
        <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.78rem', marginTop: '0.4rem' }}>
          Please wait, don't close this tab.
        </p>
      </div>
    </div>
  )

  // ── Form (sessionState === 'ready') ──────────────────────────────────────
  const pwMismatch = confirm && password !== confirm
  const isWeak     = password && strength.score < 2

  return (
    <div style={S.page}>
      <style>{KF}</style>
      <div style={S.card}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'rgba(249,115,22,0.12)', color: '#f97316',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.7rem', margin: '0 auto 1rem',
          }}>🔐</div>
          <h1 style={{
            color: 'var(--text-primary, #f1f5f9)', fontSize: '1.5rem',
            fontWeight: 900, margin: '0 0 0.4rem',
          }}>Set New Password</h1>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', margin: 0 }}>
            Choose a strong password for your account
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: '1rem',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: '0.85rem', display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span>❌</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* New Password */}
          <div>
            <label style={S.label}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="new-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                style={{
                  ...S.input,
                  borderColor: isWeak && password ? 'rgba(239,68,68,0.5)' : undefined,
                }}
                disabled={loading}
                autoFocus
              />
              <button type="button" onClick={() => setShowPw(p => !p)} style={S.eyeBtn} tabIndex={-1}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Strength bar */}
            {password && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 4,
                      background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: '0.73rem', color: strength.color, margin: 0, fontWeight: 600 }}>
                  {strength.label}
                  {strength.score < 2 && ' — add uppercase, numbers or symbols'}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label style={S.label}>Confirm Password</label>
            <input
              id="confirm-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat your new password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              style={{
                ...S.input,
                borderColor: pwMismatch ? 'rgba(239,68,68,0.5)' : undefined,
              }}
              disabled={loading}
            />
            {pwMismatch && (
              <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: 4, marginBottom: 0 }}>
                ⚠️ Passwords do not match
              </p>
            )}
            {confirm && !pwMismatch && (
              <p style={{ color: '#4ade80', fontSize: '0.75rem', marginTop: 4, marginBottom: 0 }}>
                ✅ Passwords match
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            id="update-password-btn"
            type="submit"
            disabled={loading || !!pwMismatch || isWeak}
            style={S.submitBtn(loading || !!pwMismatch || isWeak)}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    borderRadius: '50%', animation: 'nv-spin 0.7s linear infinite', display: 'inline-block',
                  }} />
                  Updating...
                </span>
              : 'Update Password'
            }
          </button>
        </form>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => navigate('login')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem',
              textDecoration: 'underline', textDecorationColor: 'transparent',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.target.style.color = '#f97316'}
            onMouseLeave={e => e.target.style.color = 'var(--text-muted, #94a3b8)'}
          >
            ← Back to Login
          </button>
        </div>

      </div>
    </div>
  )
}
