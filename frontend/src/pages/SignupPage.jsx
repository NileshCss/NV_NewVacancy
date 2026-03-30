import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { isSupabaseConfigured } from '../services/supabase'

export default function SignupPage() {
  const { signUp, signInWithGoogle, user, loading } = useAuth()
  const { navigate } = useRouter()
  const toast = useToast()
  const [form, setForm]         = useState({ name: '', email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors]     = useState({})
  const configured = isSupabaseConfigured()

  // ── Redirect if already logged in ───────────────────────────────────
  useEffect(() => {
    if (!loading && user) navigate('home')
  }, [user, loading, navigate])

  // ── Field-level validation ───────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.name.trim())        e.name     = 'Full name is required'
    if (!form.email.trim())       e.email    = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                  e.email    = 'Enter a valid email'
    if (!form.password)           e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Must be 6+ characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────
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
      const result = await signUp({
        email: form.email,
        password: form.password,
        fullName: form.name,
      })

      // If email confirmation disabled → session returned immediately
      if (result?.session) {
        toast('Welcome to New_vacancy! 🎉', 'success')
        navigate('home')
      } else {
        // Email confirmation required
        toast('Account created! ✅ Check your email to verify your account.', 'success')
        navigate('login')
      }
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('User already registered') || msg.includes('already been registered')) {
        setErrors({ email: 'This email is already registered' })
        toast('Email already in use. Try logging in.', 'error')
      } else if (msg.includes('Password should be')) {
        setErrors({ password: 'Password too weak. Use at least 6 characters.' })
        toast('Password too weak', 'error')
      } else {
        toast(msg || 'Signup failed. Try again.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Google OAuth ─────────────────────────────────────────────
  const handleGoogle = async () => {
    if (!configured) {
      toast('⚠️ Supabase not configured. Add .env file.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      toast(err.message || 'Google sign-up failed', 'error')
      setSubmitting(false)
    }
  }

  const setField = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    setErrors(er => ({ ...er, [key]: '' }))
  }

  const fields = [
    { k: 'name',     l: 'Full Name', t: 'text',     p: 'Your full name',    ac: 'name' },
    { k: 'email',    l: 'Email',     t: 'email',    p: 'you@example.com',   ac: 'email' },
    { k: 'password', l: 'Password',  t: 'password', p: 'Min 6 characters',  ac: 'new-password' },
  ]

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
          <h1 style={{ color: 'var(--text-primary)' }}>Join New_vacancy</h1>
          <p style={{ color: 'var(--text-muted)' }}>Get alerts for your dream jobs – free!</p>
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

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {fields.map(f => (
              <div key={f.k} className="form-group">
                <label className="form-label">{f.l}</label>
                <input
                  className="form-input"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: errors[f.k] ? 'var(--red)' : undefined }}
                  type={f.t}
                  autoComplete={f.ac}
                  placeholder={f.p}
                  value={form[f.k]}
                  onChange={setField(f.k)}
                  disabled={submitting}
                />
                {errors[f.k] && (
                  <div style={{ color: 'var(--red)', fontSize: '.75rem', marginTop: '.3rem' }}>{errors[f.k]}</div>
                )}
              </div>
            ))}

            <button className="form-submit" type="submit" disabled={submitting}>
              {submitting
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                    Creating account...
                  </span>
                : 'Create Account'
              }
            </button>
          </form>

          <div className="auth-link">
            Have account? <a style={{ cursor: 'pointer', color: 'var(--brand)' }} onClick={() => navigate('login')}>Sign in</a>
          </div>
        </div>
      </div>
    </div>
  )
}
