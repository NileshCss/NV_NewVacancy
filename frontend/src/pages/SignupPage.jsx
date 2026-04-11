import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import OTPVerifyModal from '../components/OTPVerifyModal'
import { isSupabaseConfigured } from '../services/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignupPage() {
  const { signUp, signInWithGoogle, resendVerification, user, loading, profile } = useAuth()
  const { navigate } = useRouter()
  const toast = useToast()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')

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

    if (!form.name.trim()) {
      nextErrors.name = 'Full name is required'
    } else if (form.name.trim().length < 2) {
      nextErrors.name = 'Name must be at least 2 characters'
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Email is required'
    } else if (!EMAIL_RE.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address'
    }

    if (!form.password) {
      nextErrors.password = 'Password is required'
    } else if (form.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters'
    } else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      nextErrors.password = 'Use at least one letter and one number'
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password'
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const setField = (field) => (event) => {
    const value = event.target.value
    setForm((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: '' }))
  }

  const handleSignup = async (event) => {
    event.preventDefault()

    if (!configured) {
      toast('⚠️ Supabase not configured. Add frontend/.env first.', 'error')
      return
    }

    if (!validate()) return

    setSubmitting(true)

    try {
      const result = await signUp({
        email: normalizedEmail,
        password: form.password,
        fullName: form.name.trim(),
      })

      const alreadyRegistered =
        !!result?.user &&
        Array.isArray(result.user.identities) &&
        result.user.identities.length === 0

      if (alreadyRegistered) {
        setErrors((previous) => ({ ...previous, email: 'This email is already registered' }))
        setVerificationEmail(normalizedEmail)
        toast('This email already exists. Try signing in instead.', 'error')
        return
      }

      if (result?.session) {
        toast('Account created successfully. Welcome! 🎉', 'success')
        navigate('home')
        return
      }

      // OTP was sent — SHOW THE OTP MODAL
      setSignupEmail(normalizedEmail)
      setShowOTPModal(true)
      setVerificationEmail(normalizedEmail)
      toast('OTP sent to your email! 📧', 'info')

    } catch (error) {
      const message = error?.message || ''
      const lower = message.toLowerCase()

      if (lower.includes('already registered') || lower.includes('already been registered')) {
        setErrors((previous) => ({ ...previous, email: 'This email is already registered' }))
        setVerificationEmail(normalizedEmail)
        toast('This email already exists. Try signing in instead.', 'error')
      } else if (lower.includes('password')) {
        setErrors((previous) => ({
          ...previous,
          password: 'Password is too weak. Use 8+ chars with letters and numbers.',
        }))
        toast('Password does not meet security requirements.', 'error')
      } else {
        toast(message || 'Signup failed. Please try again.', 'error')
      }
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
      toast(error?.message || 'Google signup failed.', 'error')
      setSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    const emailToResend = verificationEmail || normalizedEmail
    if (!emailToResend) {
      toast('Enter your email first.', 'error')
      return
    }

    setResending(true)
    try {
      await resendVerification(emailToResend)
      toast('Verification email sent. Please check your inbox.', 'success')
    } catch (error) {
      toast(error?.message || 'Failed to resend verification email.', 'error')
    } finally {
      setResending(false)
    }
  }

  const handleOTPSuccess = async (session) => {
    setShowOTPModal(false)
    toast('Email verified! Welcome to New_vacancy 🎉', 'success')

    if (session?.user) {
      const userIsAdmin = profile?.role === 'admin'
      navigate(userIsAdmin ? 'admin' : 'home')
    } else {
      navigate('home')
    }
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
          <h1 style={{ color: 'var(--text-primary)' }}>Join New_vacancy</h1>
          <p style={{ color: 'var(--text-muted)' }}>Create your account and start tracking opportunities.</p>
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

          <form onSubmit={handleSignup} noValidate>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={form.name}
                onChange={setField('name')}
                disabled={submitting}
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  borderColor: errors.name ? 'var(--red)' : undefined,
                }}
              />
              {errors.name && (
                <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>{errors.name}</div>
              )}
            </div>

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
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
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
                <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>{errors.password}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                disabled={submitting}
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  borderColor: errors.confirmPassword ? 'var(--red)' : undefined,
                }}
              />
              {errors.confirmPassword && (
                <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>
                  {errors.confirmPassword}
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
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {verificationEmail && (
            <div
              style={{
                marginTop: '.9rem',
                padding: '.75rem',
                borderRadius: 10,
                border: '1px solid rgba(59,130,246,.3)',
                background: 'rgba(59,130,246,.08)',
                color: 'var(--text-secondary)',
                fontSize: '.78rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ marginBottom: '.45rem' }}>
                Verification email sent to <strong>{verificationEmail}</strong>. Check inbox/spam.
              </div>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(59,130,246,.35)',
                  color: '#60a5fa',
                  borderRadius: 6,
                  padding: '.35rem .6rem',
                  fontSize: '.72rem',
                  cursor: resending ? 'not-allowed' : 'pointer',
                }}
              >
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>
          )}

          <div className="auth-link">
            Have account?{' '}
            <a style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => navigate('login')}>
              Sign in
            </a>
          </div>
        </div>

        {showOTPModal && (
          <OTPVerifyModal
            email={signupEmail}
            type="signup"
            onSuccess={handleOTPSuccess}
            onClose={() => setShowOTPModal(false)}
          />
        )}
      </div>
    </div>
  )
}
