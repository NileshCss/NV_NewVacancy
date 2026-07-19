import { useEffect, useMemo, useState } from 'react'
import { useAuth }   from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast }  from '../context/ToastContext'
import OTPVerifyModal from '../components/OTPVerifyModal'
import {
  EMAIL_RE,
  AuthBanner,
  AuthDivider,
  GoogleButton,
  FormInput,
  SpinnerBtn,
} from '../components/AuthShared'
import { isSupabaseConfigured } from '../services/supabase'

// ── Map Supabase errors to user-friendly messages ─────────────────────────────
function mapLoginError(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return { field: 'password', toast: 'Wrong email or password.', text: 'Wrong email or password' }
  }
  if (m.includes('email not confirmed') || m.includes('email not verified')) {
    return { field: 'email', toast: 'Please verify your email before signing in.', text: 'Email is not verified yet' }
  }
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('over_request_rate_limit')) {
    return { field: 'password', toast: 'Too many login attempts. Please wait and try again.', text: 'Too many attempts. Try again in a few minutes' }
  }
  return { field: null, toast: msg || 'Login failed. Please try again.', text: msg || 'Login failed.' }
}

export default function LoginPage() {
  const { signIn, signInWithGoogle, forgotPassword, user, profile, loading, initialized, isAdmin, isRecoverySession } = useAuth()
  const { navigate } = useRouter()
  const toast = useToast()

  const [form, setFormState]      = useState({ email: '', password: '' })
  const [errors, setErrors]       = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Forgot-password panel state
  const [forgotEmail, setForgotEmail]         = useState('')
  const [showForgotPanel, setShowForgotPanel] = useState(false)
  const [sendingReset, setSendingReset]       = useState(false)

  // OTP modal state
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [otpEmail, setOtpEmail]         = useState('')

  const configured      = isSupabaseConfigured()
  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email])

  // Show success banner when arriving from a completed password reset
  const [passwordResetSuccess] = useState(() => {
    const flag = sessionStorage.getItem('pw_reset_success')
    if (flag) sessionStorage.removeItem('pw_reset_success')
    return !!flag
  })


  // Redirect already-logged-in users.
  // IMPORTANT: wait for `initialized` + `profile` to be set before deciding
  // the destination. Without this guard, profile.role is null when the effect
  // first fires (profile fetch is async), so admins were always sent to 'home'.
  // Also: do NOT redirect during a password recovery session — that would
  // skip the Set New Password screen and silently log the user in.
  useEffect(() => {
    if (!initialized || loading) return          // auth not ready yet
    if (!user) return                            // not logged in
    if (isRecoverySession) return               // recovery session — must set new password first
    if (user && profile === null) return         // user loaded but profile still fetching
    // profile is now confirmed (object or undefined if fetch failed)
    const redirectTo = sessionStorage.getItem('redirect_after_login')
    if (redirectTo) {
      sessionStorage.removeItem('redirect_after_login')
      navigate(redirectTo)
    } else {
      navigate(isAdmin ? 'admin' : 'home')
    }
  }, [initialized, loading, user, profile, isAdmin, isRecoverySession, navigate])

  // ── Field helpers ─────────────────────────────────────────────────────────
  const setField = (field) => (e) => {
    setFormState((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev)    => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const next = {}
    if (!normalizedEmail)                  next.email    = 'Email is required'
    else if (!EMAIL_RE.test(normalizedEmail)) next.email  = 'Enter a valid email address'
    if (!form.password)                    next.password = 'Password is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!configured) { toast('⚠️ Supabase not configured. Add frontend/.env first.', 'error'); return }
    if (!validate()) return
    setSubmitting(true)
    try {
      await signIn({ email: normalizedEmail, password: form.password })
      toast('Welcome back! 🎉', 'success')
    } catch (err) {
      const isEmailUnverified =
        err?.message?.toLowerCase().includes('email not confirmed') ||
        err?.message?.toLowerCase().includes('email not verified')

      if (isEmailUnverified) {
        setOtpEmail(normalizedEmail)
        setShowOTPModal(true)
        toast('Please verify your email first. We sent you an OTP code.', 'info')
        return
      }
      const mapped = mapLoginError(err?.message || '')
      if (mapped.field) setErrors((prev) => ({ ...prev, [mapped.field]: mapped.text }))
      toast(mapped.toast, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    if (!configured) { toast('⚠️ Supabase not configured. Add frontend/.env first.', 'error'); return }
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      toast(err?.message || 'Google login failed.', 'error')
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async () => {
    const email = (forgotEmail || normalizedEmail).trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      toast('Enter a valid email to reset your password.', 'error')
      return
    }
    setSendingReset(true)
    try {
      await forgotPassword(email)
      toast('Password reset link sent. Check your inbox.', 'success')
      setShowForgotPanel(false)
    } catch (err) {
      toast(err?.message || 'Failed to send password reset email.', 'error')
    } finally {
      setSendingReset(false)
    }
  }

  const handleOTPSuccess = () => {
    setShowOTPModal(false)
    toast('Email verified! You are now signed in.', 'success')
    const redirectTo = sessionStorage.getItem('redirect_after_login')
    if (redirectTo) {
      sessionStorage.removeItem('redirect_after_login')
      navigate(redirectTo)
    } else {
      navigate('home')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">
        {!configured && <AuthBanner />}

        <div className="auth-logo">
          <div className="auth-logo-box">NV</div>
          <h1 style={{ color: 'var(--text-primary)' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)' }}>Sign in to continue.</p>
        </div>

        <div className="auth-box">
          {/* Password reset success banner */}
          {passwordResetSuccess && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 10,
              marginBottom: '1rem',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#4ade80',
              fontSize: '0.85rem',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}>
              ✅ Password reset successfully! Please log in with your new password.
            </div>
          )}
          <GoogleButton onClick={handleGoogle} disabled={submitting} />
          <AuthDivider />


          <form onSubmit={handleLogin} noValidate>
            <FormInput label="Email" error={errors.email}>
              <input
                className="form-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={setField('email')}
                disabled={submitting}
                style={{
                  background:   'var(--bg-input)',
                  color:        'var(--text-primary)',
                  borderColor:  errors.email ? 'var(--red)' : undefined,
                }}
              />
            </FormInput>

            {/* Password + Forgot-password link */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Password</label>
                <button
                  type="button"
                  onClick={() => { setShowForgotPanel((p) => !p); setForgotEmail(normalizedEmail) }}
                  style={{
                    background: 'transparent',
                    border:     'none',
                    color:      'var(--brand)',
                    fontSize:   '.72rem',
                    cursor:     'pointer',
                    padding:    0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                className="form-input"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={form.password}
                onChange={setField('password')}
                disabled={submitting}
                style={{
                  background:  'var(--bg-input)',
                  color:       'var(--text-primary)',
                  borderColor: errors.password ? 'var(--red)' : undefined,
                }}
              />
              {errors.password && (
                <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>
                  {errors.password}
                </div>
              )}
            </div>

            <SpinnerBtn loading={submitting} loadingText="Signing in...">
              Sign In
            </SpinnerBtn>
          </form>

          {/* Forgot-password panel */}
          {showForgotPanel && (
            <div
              style={{
                marginTop:  '.9rem',
                padding:    '.75rem',
                borderRadius: 10,
                border:     '1px solid rgba(59,130,246,.3)',
                background: 'rgba(59,130,246,.08)',
                color:      'var(--text-secondary)',
              }}
            >
              <div style={{ fontSize: '.75rem', marginBottom: '.5rem' }}>
                Enter your account email and we will send a reset link.
              </div>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={sendingReset}
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', marginBottom: '.5rem' }}
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={sendingReset}
                style={{
                  width:       '100%',
                  padding:     '.5rem .7rem',
                  borderRadius: 8,
                  border:      '1px solid rgba(59,130,246,.35)',
                  background:  'transparent',
                  color:       '#60a5fa',
                  fontWeight:  600,
                  cursor:      sendingReset ? 'not-allowed' : 'pointer',
                }}
              >
                {sendingReset ? 'Sending reset email...' : 'Send reset link'}
              </button>
            </div>
          )}

          <div className="auth-link">
            No account?{' '}
            <a style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => navigate('signup')}>
              Sign up free
            </a>
          </div>
        </div>

        {showOTPModal && (
          <OTPVerifyModal
            email={otpEmail}
            type="signup"
            onSuccess={handleOTPSuccess}
            onClose={() => setShowOTPModal(false)}
          />
        )}
      </div>
    </div>
  )
}
