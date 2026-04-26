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

export default function SignupPage() {
  const { signUp, signInWithGoogle, resendVerification, user, loading, profile } = useAuth()
  const { navigate } = useRouter()
  const toast = useToast()

  const [form, setFormState] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors]  = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [resending, setResending]               = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [showOTPModal, setShowOTPModal]           = useState(false)
  const [signupEmail, setSignupEmail]             = useState('')

  const configured      = isSupabaseConfigured()
  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email])

  // Redirect already-logged-in users
  useEffect(() => {
    if (!loading && user) {
      navigate(profile?.role === 'admin' ? 'admin' : 'home')
    }
  }, [loading, user, profile?.role, navigate])

  // ── Field helpers ─────────────────────────────────────────────────────────
  const setField = (field) => (e) => {
    setFormState((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev)    => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim())              next.name = 'Full name is required'
    else if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters'

    if (!normalizedEmail)                    next.email = 'Email is required'
    else if (!EMAIL_RE.test(normalizedEmail)) next.email = 'Enter a valid email address'

    if (!form.password)               next.password = 'Password is required'
    else if (form.password.length < 8) next.password = 'Password must be at least 8 characters'
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
                                       next.password = 'Use at least one letter and one number'

    if (!form.confirmPassword)                          next.confirmPassword = 'Please confirm your password'
    else if (form.confirmPassword !== form.password)    next.confirmPassword = 'Passwords do not match'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault()
    if (!configured) { toast('⚠️ Supabase not configured. Add frontend/.env first.', 'error'); return }
    if (!validate()) return
    setSubmitting(true)
    try {
      const result = await signUp({ email: normalizedEmail, password: form.password, fullName: form.name.trim() })

      const alreadyRegistered =
        !!result?.user &&
        Array.isArray(result.user.identities) &&
        result.user.identities.length === 0

      if (alreadyRegistered) {
        setErrors((prev) => ({ ...prev, email: 'This email is already registered' }))
        setVerificationEmail(normalizedEmail)
        toast('This email already exists. Try signing in instead.', 'error')
        return
      }

      if (result?.session) {
        toast('Account created successfully. Welcome! 🎉', 'success')
        navigate('home')
        return
      }

      // OTP was sent
      setSignupEmail(normalizedEmail)
      setShowOTPModal(true)
      setVerificationEmail(normalizedEmail)
      toast('OTP sent to your email! 📧', 'info')

    } catch (err) {
      const msg   = err?.message || ''
      const lower = msg.toLowerCase()
      if (lower.includes('already registered') || lower.includes('already been registered')) {
        setErrors((prev) => ({ ...prev, email: 'This email is already registered' }))
        setVerificationEmail(normalizedEmail)
        toast('This email already exists. Try signing in instead.', 'error')
      } else if (lower.includes('password')) {
        setErrors((prev) => ({ ...prev, password: 'Password is too weak. Use 8+ chars with letters and numbers.' }))
        toast('Password does not meet security requirements.', 'error')
      } else if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('over_email_send_rate_limit')) {
        toast('Too many requests. Please wait a few minutes before trying again.', 'error')
      } else if (lower.includes('error sending confirmation email')) {
        toast('Email provider error. Please check Supabase SMTP or rate limit settings.', 'error')
      } else {
        toast(msg || 'Signup failed. Please try again.', 'error')
      }
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
      toast(err?.message || 'Google signup failed.', 'error')
      setSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    const emailToResend = verificationEmail || normalizedEmail
    if (!emailToResend) { toast('Enter your email first.', 'error'); return }
    setResending(true)
    try {
      await resendVerification(emailToResend)
      toast('Verification email sent. Please check your inbox.', 'success')
    } catch (err) {
      const msg = err?.message || 'Failed to resend verification email.'
      const isRateLimit = msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many requests')
      toast(isRateLimit ? 'Please wait a minute before requesting another code.' : msg, 'error')
    } finally {
      setResending(false)
    }
  }

  const handleOTPSuccess = (session) => {
    setShowOTPModal(false)
    toast('Email verified! Welcome to New_vacancy 🎉', 'success')
    // NOTE: profile is still null here — it's fetched async by AuthContext
    // after the SIGNED_IN event fires. Navigate to home; the existing
    // useEffect redirect guard will move admins to /admin once profile loads.
    const role = session?.user?.user_metadata?.role
      || session?.profile?.role
      || null
    navigate(role === 'admin' ? 'admin' : 'home')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">
        {!configured && <AuthBanner />}

        <div className="auth-logo">
          <div className="auth-logo-box">NV</div>
          <h1 style={{ color: 'var(--text-primary)' }}>Join New_vacancy</h1>
          <p style={{ color: 'var(--text-muted)' }}>Create your account and start tracking opportunities.</p>
        </div>

        <div className="auth-box">
          <GoogleButton onClick={handleGoogle} disabled={submitting} />
          <AuthDivider />

          <form onSubmit={handleSignup} noValidate>
            <FormInput label="Full Name" error={errors.name}>
              <input
                className="form-input"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={form.name}
                onChange={setField('name')}
                disabled={submitting}
                style={{
                  background:  'var(--bg-input)',
                  color:       'var(--text-primary)',
                  borderColor: errors.name ? 'var(--red)' : undefined,
                }}
              />
            </FormInput>

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
                  background:  'var(--bg-input)',
                  color:       'var(--text-primary)',
                  borderColor: errors.email ? 'var(--red)' : undefined,
                }}
              />
            </FormInput>

            <FormInput label="Password" error={errors.password}>
              <input
                className="form-input"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={setField('password')}
                disabled={submitting}
                style={{
                  background:  'var(--bg-input)',
                  color:       'var(--text-primary)',
                  borderColor: errors.password ? 'var(--red)' : undefined,
                }}
              />
            </FormInput>

            <FormInput label="Confirm Password" error={errors.confirmPassword}>
              <input
                className="form-input"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                disabled={submitting}
                style={{
                  background:  'var(--bg-input)',
                  color:       'var(--text-primary)',
                  borderColor: errors.confirmPassword ? 'var(--red)' : undefined,
                }}
              />
            </FormInput>

            <SpinnerBtn loading={submitting} loadingText="Creating account...">
              Create Account
            </SpinnerBtn>
          </form>

          {/* Resend verification panel */}
          {verificationEmail && (
            <div
              style={{
                marginTop:   '.9rem',
                padding:     '.75rem',
                borderRadius: 10,
                border:      '1px solid rgba(59,130,246,.3)',
                background:  'rgba(59,130,246,.08)',
                color:       'var(--text-secondary)',
                fontSize:    '.78rem',
                lineHeight:  1.5,
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
                  background:   'transparent',
                  border:       '1px solid rgba(59,130,246,.35)',
                  color:        '#60a5fa',
                  borderRadius: 6,
                  padding:      '.35rem .6rem',
                  fontSize:     '.72rem',
                  cursor:       resending ? 'not-allowed' : 'pointer',
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
