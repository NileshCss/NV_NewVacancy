import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import OTPVerifyModal from '../components/OTPVerifyModal'
import { isSupabaseConfigured } from '../services/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function mapLoginError(errorMessage = '') {
  const lower = errorMessage.toLowerCase()

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return {
      field: 'password',
      toast: 'Wrong email or password.',
      text: 'Wrong email or password',
    }
  }

  if (lower.includes('email not confirmed') || lower.includes('email not verified')) {
    return {
      field: 'email',
      toast: 'Please verify your email before signing in.',
      text: 'Email is not verified yet',
    }
  }

  if (lower.includes('too many requests') || lower.includes('rate limit') || lower.includes('over_request_rate_limit')) {
    return {
      field: 'password',
      toast: 'Too many login attempts. Please wait and try again.',
      text: 'Too many attempts. Try again in a few minutes',
    }
  }

  return {
    field: null,
    toast: errorMessage || 'Login failed. Please try again.',
    text: errorMessage || 'Login failed. Please try again.',
  }
}

export default function LoginPage() {
  const { signIn, signInWithGoogle, forgotPassword, user, profile, loading } = useAuth()
  const { navigate } = useRouter()
  const toast = useToast()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [showForgotPanel, setShowForgotPanel] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')

  const configured = isSupabaseConfigured()

  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email])

  useEffect(() => {
    if (!loading && user) {
      if (profile?.role === 'admin') {
        navigate('admin')
      } else {
        navigate('home')
      }
    }
  }, [loading, navigate, profile?.role, user])

  const validate = () => {
    const nextErrors = {}

    if (!normalizedEmail) {
      nextErrors.email = 'Email is required'
    } else if (!EMAIL_RE.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address'
    }

    if (!form.password) {
      nextErrors.password = 'Password is required'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const setField = (field) => (event) => {
    const value = event.target.value
    setForm((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: '' }))
  }

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!configured) {
      toast('⚠️ Supabase not configured. Add frontend/.env first.', 'error')
      return
    }

    if (!validate()) return

    setSubmitting(true)

    try {
      await signIn({
        email: normalizedEmail,
        password: form.password,
      })

      toast('Welcome back! 🎉', 'success')
    } catch (error) {
      const mapped = mapLoginError(error?.message || '')
      
      // Check if email is not confirmed — show OTP modal
      if (error?.message?.includes('Email not confirmed') || error?.message?.includes('email not verified')) {
        setOtpEmail(normalizedEmail)
        setShowOTPModal(true)
        toast('Please verify your email first. We sent you an OTP code.', 'info')
        return
      }
      
      if (mapped.field) {
        setErrors((previous) => ({ ...previous, [mapped.field]: mapped.text }))
      }
      toast(mapped.toast, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    if (!configured) {
      toast('⚠️ Supabase not configured. Add frontend/.env first.', 'error')
      return
    }

    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      toast(error?.message || 'Google login failed.', 'error')
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async () => {
    const emailToUse = (forgotEmail || normalizedEmail || '').trim().toLowerCase()

    if (!emailToUse || !EMAIL_RE.test(emailToUse)) {
      toast('Enter a valid email to reset your password.', 'error')
      return
    }

    setSendingReset(true)
    try {
      await forgotPassword(emailToUse)
      toast('Password reset link sent. Check your inbox.', 'success')
      setShowForgotPanel(false)
    } catch (error) {
      toast(error?.message || 'Failed to send password reset email.', 'error')
    } finally {
      setSendingReset(false)
    }
  }

  const handleOTPSuccess = (session) => {
    setShowOTPModal(false)
    toast('Email verified! You are now signed in.', 'success')
    navigate('home')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {!configured && (
          <div
            style={{
              background: '#7c2d12',
              color: '#fed7aa',
              borderRadius: 10,
              padding: '.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '.82rem',
              border: '1px solid #ea580c',
              lineHeight: 1.5,
            }}
          >
            ⚠️ <strong>Supabase not configured.</strong>
            <br />
            Create <code>frontend/.env</code> with your Supabase URL and anon key.
          </div>
        )}

        <div className="auth-logo">
          <div className="auth-logo-box">NV</div>
          <h1 style={{ color: 'var(--text-primary)' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)' }}>Sign in to continue.</p>
        </div>

        <div className="auth-box">
          <button className="google-btn" onClick={handleGoogle} disabled={submitting} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {submitting ? 'Please wait...' : 'Continue with Google'}
          </button>

          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">or with email</span>
            <div className="divider-line" />
          </div>

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={setField('email')}
                disabled={submitting}
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  borderColor: errors.email ? 'var(--red)' : undefined,
                }}
              />
              {errors.email && (
                <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>{errors.email}</div>
              )}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPanel((previous) => !previous)
                    setForgotEmail(normalizedEmail)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--brand)',
                    fontSize: '.72rem',
                    cursor: 'pointer',
                    padding: 0,
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
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  borderColor: errors.password ? 'var(--red)' : undefined,
                }}
              />
              {errors.password && (
                <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>
                  {errors.password}
                </div>
              )}
            </div>

            <button className="form-submit" type="submit" disabled={submitting}>
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,.4)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin .7s linear infinite',
                      display: 'inline-block',
                    }}
                  />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {showForgotPanel && (
            <div
              style={{
                marginTop: '.9rem',
                padding: '.75rem',
                borderRadius: 10,
                border: '1px solid rgba(59,130,246,.3)',
                background: 'rgba(59,130,246,.08)',
                color: 'var(--text-secondary)',
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
                onChange={(event) => setForgotEmail(event.target.value)}
                disabled={sendingReset}
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  marginBottom: '.5rem',
                }}
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={sendingReset}
                style={{
                  width: '100%',
                  padding: '.5rem .7rem',
                  borderRadius: 8,
                  border: '1px solid rgba(59,130,246,.35)',
                  background: 'transparent',
                  color: '#60a5fa',
                  fontWeight: 600,
                  cursor: sendingReset ? 'not-allowed' : 'pointer',
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
