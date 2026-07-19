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
  const { navigate }         = useRouter()
  const { isRecoverySession } = useAuth()

  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)

  // 'pending'  — waiting for Supabase to validate the recovery token
  // 'ready'    — session active, show the form
  // 'expired'  — link expired / already used
  const [sessionState, setSessionState] = useState('pending')
  const [sessionMsg,   setSessionMsg]   = useState('')

  const resolvedRef = useRef(false)  // prevent double-resolve

  // ── Resolve recovery session ─────────────────────────────────────────────
  useEffect(() => {

    const resolve = (state, msg = '') => {
      if (resolvedRef.current) return
      resolvedRef.current = true
      setSessionState(state)
      if (msg) setSessionMsg(msg)
    }

    // Fast-path: AuthContext already fired PASSWORD_RECOVERY before we mounted.
    if (isRecoverySession) {
      resolve('ready')
      return
    }

    // ── Check for OTP expired / Auth errors in URL immediately ────────────────
    const params = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, '?'))
    
    if (params.get('error_code') === 'otp_expired' || hash.get('error_code') === 'otp_expired') {
      resolve('expired', 'This reset link has expired. Please request a new one.')
      return
    }
    if (params.get('error') || hash.get('error')) {
      resolve('expired', params.get('error_description') || hash.get('error_description') || 'Invalid or expired reset link.')
      return
    }

    // ── Step 1: Handle PKCE code in URL query string ──────────────────────
    // With flowType:'pkce', Supabase sends the reset link as:
    //   https://site.com/auth/reset-password?code=XXXX
    // Supabase-js does NOT auto-exchange PKCE codes — we must do it explicitly.
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')

    if (code) {
      ;(async () => {
        try {
          const { data, error: exchErr } =
            await supabase.auth.exchangeCodeForSession(window.location.href)

          if (exchErr) {
            console.error('[ResetPassword] PKCE exchange error:', exchErr.message)
            resolve('expired', 'This reset link has expired or has already been used. Please request a new one.')
            return
          }

          // exchangeCodeForSession succeeded → onAuthStateChange will fire
          // PASSWORD_RECOVERY or SIGNED_IN. We also receive the session directly.
          if (data?.session) {
            resolve('ready')
          }
          // If no session returned, let onAuthStateChange handle it below.
        } catch (err) {
          console.error('[ResetPassword] PKCE exchange failed:', err)
          resolve('expired', 'Failed to verify reset link. Please request a new password reset.')
        }
      })()
    }

    // ── Step 2: Hash token (implicit flow) or already-exchanged session ───
    // Supabase-js auto-processes hash tokens when detectSessionInUrl:true,
    // then fires PASSWORD_RECOVERY. Listen for both events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolvedRef.current) return

      if (event === 'PASSWORD_RECOVERY' && session) {
        resolve('ready')
        return
      }

      // Some Supabase versions / configurations fire SIGNED_IN for recovery.
      // Accept it only if we're on a reset-password URL (prevents false positives).
      if (event === 'SIGNED_IN' && session) {
        const h = window.location.hash
        const q = window.location.search
        const onResetPage = window.location.pathname.includes('reset-password')
        const hasRecoveryMarker =
          h.includes('type=recovery') ||
          q.includes('type=recovery') ||
          q.includes('code=')   // PKCE recovery code was in the URL

        if (onResetPage && hasRecoveryMarker) {
          resolve('ready')
        }
      }
    })

    // ── Step 3: Fallback — session was already set before this component mounted
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !resolvedRef.current) {
        resolve('ready')
      }
    })

    // ── Step 4: Timeout guard — link expired or no token at all
    const timer = setTimeout(() => {
      if (!resolvedRef.current) {
        resolve('expired', 'This reset link has expired or has already been used. Please request a new one.')
      }
    }, 15000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [isRecoverySession])

  // ── Form handlers ────────────────────────────────────────────────────────
  const strength = getStrength(password)

  const validate = () => {
    if (!password)            return 'New password is required.'
    if (password.length < 8)  return 'Password must be at least 8 characters.'
    if (strength.score < 2)   return 'Password is too weak. Add uppercase letters, numbers, or symbols.'
    if (password !== confirm)  return 'Passwords do not match.'
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

      // ── Full cleanup ─────────────────────────────────────────────────
      // Mark success for LoginPage to display the banner
      sessionStorage.setItem('pw_reset_success', '1')
      // Clear all auth caches so the old session is fully invalidated
      try { localStorage.removeItem('nv_auth') }    catch {}
      try { localStorage.removeItem('nv_profile') } catch {}
      // Sign out all sessions (scope:'global' invalidates ALL devices)
      await supabase.auth.signOut({ scope: 'global' })

      // Redirect to login after a short success animation
      setTimeout(() => navigate('login'), 2500)

    } catch (err) {
      const msg = err?.message || ''
      if (msg.toLowerCase().includes('same password')) {
        setError('New password must be different from your current password.')
      } else if (msg.toLowerCase().includes('weak')) {
        setError('Password is too weak. Please choose a stronger one.')
      } else if (msg.toLowerCase().includes('session')) {
        setError('Session expired. Please request a new password reset link.')
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
        <h2 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '1.4rem', marginBottom: '0.5rem', margin: '0 0 0.5rem' }}>
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

  // ── Expired / invalid link ─────────────────────────────────────────────
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
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => navigate('login')}
            style={{
              padding: '0.7rem 1.5rem',
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

  // ── Pending (verifying token) ─────────────────────────────────────────
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
