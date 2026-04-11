import { useEffect, useState } from 'react'
import { supabase }  from '../services/supabase'
import { useRouter } from '../context/RouterContext'
import { ADMIN_EMAIL } from '../context/AuthContext'

export default function AuthCallbackPage() {
  const { navigate } = useRouter()
  const [msg, setMsg] = useState('Completing sign in...')

  useEffect(() => {
    let done = false

    const handle = async () => {
      try {
        // Exchange code for session
        const { data, error } =
          await supabase.auth.exchangeCodeForSession(
            window.location.search
          )

        if (done) return

        if (error) {
          setMsg('Sign in failed. Redirecting...')
          setTimeout(() => navigate('login'), 1500)
          return
        }

        if (data?.session?.user) {
          const u = data.session.user

          // Fetch profile to check role
          const { data: prof } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', u.id)
            .single()

          const name = prof?.full_name || u.email?.split('@')[0]
          setMsg(`Welcome, ${name}! 🎉`)
          done = true

          setTimeout(() => {
            if (prof?.role === 'admin' ||
                u.email?.toLowerCase() ===
                ADMIN_EMAIL.toLowerCase()) {
              navigate('admin')
            } else {
              navigate('home')
            }
          }, 800)

        } else {
          // Try existing session
          const { data: { session } } =
            await supabase.auth.getSession()

          if (session) {
            navigate('home')
          } else {
            navigate('login')
          }
        }

      } catch (err) {
        console.error('[Callback]', err)
        if (!done) {
          setMsg('Something went wrong...')
          setTimeout(() => navigate('login'), 1500)
        }
      }
    }

    handle()
  }, [])

  return (
    <div style={{
      minHeight:       '100vh',
      background:      'var(--bg-base, #0f172a)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexDirection:   'column',
      gap:             '1.25rem',
      fontFamily:      'DM Sans, sans-serif',
    }}>
      <div style={{
        width:           52,
        height:          52,
        border:          '3px solid rgba(249,115,22,0.25)',
        borderTopColor:  '#f97316',
        borderRadius:    '50%',
        animation:       'nv-spin 0.7s linear infinite',
      }}/>
      <p style={{
        color:      'var(--text-secondary, #94a3b8)',
        fontSize:   '0.9rem',
        fontWeight: 500,
      }}>
        {msg}
      </p>
      <style>{`
        @keyframes nv-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
