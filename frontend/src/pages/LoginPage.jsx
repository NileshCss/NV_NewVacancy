import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { isSupabaseConfigured } from '../services/supabase'

export default function LoginPage() {
  const { signIn, signInWithGoogle, user, profile, loading } = useAuth()
  const { navigate } = useRouter()
  const toast = useToast()
  const [form, setForm]           = useState({ email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors]       = useState({})
  const configured = isSupabaseConfigured()

  // ── If user is already logged in, redirect away from login page ──────────
  useEffect(() => {
    if (!loading && user) {
      // Already authenticated — send admin to dashboard, others to home
      if (profile?.role === 'admin') {
        navigate('admin')
      } else {
        navigate('home')
      }
    }
  }, [user, profile, loading, navigate])

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.email.trim())      e.email    = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                 e.email    = 'Enter a valid email'
    if (!form.password)          e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Must be 6+ characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    if (!configured) {
      toast('⚠️ Supabase not configured. Add .env file.', 'error')
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      await signIn({ email: form.email, password: form.password })
      // Navigation is handled by the useEffect above when user/profile updates.
      // We show a toast optimistically — the redirect happens automatically.
      toast('Welcome back! 🎉', 'success')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setErrors({ password: 'Wrong email or password' })
        toast('Wrong email or password', 'error')
      } else if (msg.includes('Email not confirmed')) {
        toast('Please verify your email before signing in', 'error')
      } else if (msg.includes('Too many requests')) {
        toast('Too many attempts. Please wait a moment.', 'error')
      } else {
        toast(msg || 'Login failed. Try again.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    if (!configured) {
      toast('⚠️ Supabase not configured. Add .env file.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await signInWithGoogle()
      // Browser redirects to Google — loading state stays intentionally
    } catch (err) {
      toast(err.message || 'Google sign-in failed', 'error')
      setSubmitting(false)
    }
  }

  // Only disable fields while actively submitting — NOT during initial auth check
  const fieldsDisabled = submitting

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Config Warning */}
        {!configured && (
          <div style={{
            background: '#7c2d12', color: '#fed7aa', borderRadius: 10,
            padding: '.75rem 1rem', marginBottom: '1rem', fontSize: '.82rem',
            border: '1px solid #ea580c', lineHeight: 1.5
          }}>
            ⚠️ <strong>Supabase not configured.</strong><br />
            Create <code>frontend/.env</code> with your Supabase URL &amp; Anon Key.
          </div>
        )}

        <div className="auth-logo">
          <div className="auth-logo-box">NV</div>
          <h1 style={{ color: 'var(--text-primary)' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)' }}>Sign in to your New_vacancy account</p>
        </div>

        <div className="auth-box">
          {/* Google Button */}
          <button
            className="google-btn"
            onClick={handleGoogle}
            disabled={submitting}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {submitting ? 'Please wait...' : 'Continue with Google'}
          </button>

          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">or with email</span>
            <div className="divider-line" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: errors.email ? 'var(--red)' : undefined }}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => { setForm({ ...form, email: e.target.value }); setErrors(er => ({ ...er, email: '' })) }}
                disabled={fieldsDisabled}
              />
              {errors.email && <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>{errors.email}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: errors.password ? 'var(--red)' : undefined }}
                type="password"
                autoComplete="current-password"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={e => { setForm({ ...form, password: e.target.value }); setErrors(er => ({ ...er, password: '' })) }}
                disabled={fieldsDisabled}
              />
              {errors.password && <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>{errors.password}</div>}
            </div>

            <button className="form-submit" type="submit" disabled={submitting}>
              {submitting
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                    Signing in...
                  </span>
                : 'Sign In'
              }
            </button>
          </form>

          <div className="auth-link">
            No account? <a style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => navigate('signup')}>Sign up free</a>
          </div>
        </div>
      </div>
    </div>
  )
}
