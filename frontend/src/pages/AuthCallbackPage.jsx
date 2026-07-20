import { useEffect, useState } from 'react'
import { supabase }  from '../services/supabase'
import { useRouter } from '../context/RouterContext'
import { ADMIN_EMAIL } from '../context/AuthContext'

export default function AuthCallbackPage() {
  const { navigate } = useRouter()
  const [msg, setMsg] = useState('Verifying your account...')
  const [error, setError] = useState('')

  useEffect(() => {
    let done = false

    const redirectUser = async (session) => {
      if (done) return
      done = true

      const u = session.user

      // Fetch profile to check role
      const { data: prof } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', u.id)
        .single()

      const name = prof?.full_name || u.email?.split('@')[0]
      setMsg(`Welcome, ${name}! 🎉`)

      setTimeout(() => {
        // Admin always goes to admin dashboard, regardless of redirectAfterLogin
        if (prof?.role === 'admin' ||
            prof?.role === 'super_admin' ||
            u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          navigate('admin')
          return
        }

        // Honor the page the user was trying to reach before being sent to login
        const savedRedirect = sessionStorage.getItem('redirectAfterLogin')
        if (savedRedirect) {
          sessionStorage.removeItem('redirectAfterLogin')
          navigate(savedRedirect)
        } else {
          navigate('home')
        }
      }, 800)
    }

    const handle = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const hash   = window.location.hash

        // Detect password-recovery flow from URL before any strategy runs
        const isRecovery =
          hash.includes('type=recovery') ||
          params.get('type') === 'recovery'

        // ── Strategy 1: PKCE auto-exchange (detectSessionInUrl:true handles this) ──
        // When detectSessionInUrl:true is set in the Supabase client, it automatically
        // exchanges any ?code= param found in the URL during client init.
        // We must NOT call exchangeCodeForSession() manually — that would consume
        // the one-time PKCE token a second time, causing otp_expired errors.
        // Instead, just check if the auto-exchange already produced a session.
        if (params.has('code')) {
          // Give the auto-exchange a moment to complete, then check for session
          await new Promise(r => setTimeout(r, 300))
          const { data: { session: codeSession } } = await supabase.auth.getSession()
          if (codeSession) {
            if (isRecovery) {
              done = true
              navigate('auth/reset-password')
              return
            }
            await redirectUser(codeSession)
            return
          }
          // If no session yet, fall through to the onAuthStateChange listener below
        }

        // ── Strategy 2: Implicit hash token (older magic links, some email verifications) ──
        if (hash.includes('access_token=')) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            if (isRecovery) {
              done = true
              navigate('auth/reset-password')
              return
            }
            await redirectUser(session)
            return
          }
        }

        // ── Strategy 3: Check existing session (Supabase may have already set it) ──
        const { data: { session: existing } } = await supabase.auth.getSession()
        if (existing) {
          if (isRecovery) {
            done = true
            navigate('auth/reset-password')
            return
          }
          await redirectUser(existing)
          return
        }

        // ── Strategy 4: Listen for auth state change (Supabase processes token async) ──
        setMsg('Completing verification...')
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (done) return
            // PASSWORD_RECOVERY → send to reset-password page
            if (event === 'PASSWORD_RECOVERY') {
              done = true
              subscription.unsubscribe()
              navigate('auth/reset-password')
              return
            }
            if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
              // If the URL was a recovery link but Supabase fired SIGNED_IN instead
              // of PASSWORD_RECOVERY, still route to reset-password.
              if (isRecovery) {
                done = true
                subscription.unsubscribe()
                navigate('auth/reset-password')
                return
              }
              subscription.unsubscribe()
              await redirectUser(session)
            }
          }
        )

        // Timeout fallback
        setTimeout(() => {
          if (!done) {
            subscription.unsubscribe()
            setError('Verification link may have expired. Please sign up again or request a new code.')
          }
        }, 12000)

      } catch (err) {
        console.error('[AuthCallback]', err)
        if (!done) {
          setError(err.message || 'Verification failed. The link may have expired.')
        }
      }
    }

    handle()
  }, [navigate])

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--bg-base, #0f172a)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexDirection:  'column',
      gap:            '1.25rem',
      fontFamily:     'DM Sans, sans-serif',
      padding:        '1rem',
    }}>
      <style>{`@keyframes nv-spin { to { transform: rotate(360deg); } }`}</style>

      {error ? (
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2 style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
            Verification Failed
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('signup')}
            style={{
              padding: '0.7rem 1.5rem',
              background: 'var(--brand, #f97316)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Signup
          </button>
        </div>
      ) : (
        <>
          <div style={{
            width: 52, height: 52,
            border: '3px solid rgba(249,115,22,0.25)',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'nv-spin 0.7s linear infinite',
          }}/>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem', fontWeight: 500 }}>
            {msg}
          </p>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.75rem' }}>
            Please wait, don't close this tab.
          </p>
        </>
      )}
    </div>
  )
}
