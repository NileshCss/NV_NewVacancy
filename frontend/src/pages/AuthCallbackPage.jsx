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
        if (prof?.role === 'admin' ||
            u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          navigate('admin')
        } else {
          navigate('home')
        }
      }, 800)
    }

    const handle = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const hash   = window.location.hash

        // ── Strategy 1: PKCE code exchange (Google OAuth, email link in newer Supabase) ──
        if (params.has('code')) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.search)
          if (error) throw error
          if (data?.session) { await redirectUser(data.session); return }
        }

        // ── Strategy 2: Implicit hash token (older magic links, some email verifications) ──
        if (hash.includes('access_token=')) {
          // Supabase JS automatically handles hash tokens — just get session
          const { data: { session } } = await supabase.auth.getSession()
          if (session) { await redirectUser(session); return }
        }

        // ── Strategy 3: Check existing session (Supabase may have already set it) ──
        const { data: { session: existing } } = await supabase.auth.getSession()
        if (existing) { await redirectUser(existing); return }

        // ── Strategy 4: Listen for auth state change (Supabase processes token async) ──
        setMsg('Completing verification...')
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (done) return
            if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
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
