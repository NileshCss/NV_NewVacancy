import { useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { useRouter } from '../context/RouterContext'

export default function AuthCallbackPage() {
  const { navigate } = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    let safetyTimer = null

    const handleCallback = async () => {
      try {
        const urlParams  = new URLSearchParams(window.location.search)
        const hashString = window.location.hash.replace('#', '')
        const hashParams = new URLSearchParams(hashString)

        const code  = urlParams.get('code')
        const error = urlParams.get('error') || hashParams.get('error')

        if (error) {
          console.error('[NV] OAuth error:', error, urlParams.get('error_description'))
          navigate('login')
          return
        }

        // ── PKCE flow: exchange code for session ──────────────────────────
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('[NV] Code exchange error:', exchangeError.message)
            navigate('login')
            return
          }
          if (data?.session) {
            // Clean URL so the code can't be replayed if user refreshes
            window.history.replaceState({}, document.title, '/')
            navigate('home')
            return
          }
        }

        // ── Implicit / magic-link: access_token already in hash ────────────
        if (hashParams.get('access_token')) {
          // Supabase SDK auto-processes the hash — just read the session
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData?.session) {
            window.history.replaceState({}, document.title, '/')
            navigate('home')
            return
          }
        }

        // ── Fallback: maybe the SDK already set the session ────────────────
        const { data: fallback } = await supabase.auth.getSession()
        if (fallback?.session) {
          navigate('home')
        } else {
          console.warn('[NV] No session after callback — going to login')
          navigate('login')
        }
      } catch (err) {
        console.error('[NV] Callback error:', err)
        navigate('login')
      } finally {
        // Cancel the safety timer since we already navigated
        if (safetyTimer) clearTimeout(safetyTimer)
      }
    }

    // Small delay so Supabase SDK can auto-parse the URL hash first
    setTimeout(handleCallback, 150)

    // Safety net — only kicks in if handleCallback never resolves (network hang)
    safetyTimer = setTimeout(() => {
      console.warn('[NV] Auth callback safety timeout hit')
      navigate('login')
    }, 15_000)

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer)
    }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1.25rem'
    }}>
      <div style={{
        width: 52,
        height: 52,
        border: '3px solid var(--brand)',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '.25rem' }}>
          Signing you in...
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>
          Please wait, this only takes a moment.
        </p>
      </div>
    </div>
  )
}
