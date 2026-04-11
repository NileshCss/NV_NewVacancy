import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react'
import { supabase } from '../services/supabase'

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const ADMIN_EMAIL    = 'rajputnileshsingh3@gmail.com'
const CACHE_KEY      = 'nv_profile'
const CACHE_TTL      = 5 * 60 * 1000  // 5 minutes

// ─────────────────────────────────────────────────────────
// CACHE HELPERS
// ─────────────────────────────────────────────────────────
const cache = {
  get() {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const { data, ts } = JSON.parse(raw)
      return Date.now() - ts < CACHE_TTL ? data : null
    } catch { return null }
  },
  set(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        ts: Date.now(),
      }))
    } catch {}
  },
  clear() {
    try { localStorage.removeItem(CACHE_KEY) } catch {}
  },
}

// ─────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────
const AuthCtx = createContext(null)

export function AuthProvider({ children }) {

  // ── State — initialized from cache for instant render ──
  const [user,        setUser]        = useState(null)
  const [profile,     setProfile]     = useState(cache.get())
  const [loading,     setLoading]     = useState(!cache.get())
  const [initialized, setInitialized] = useState(false)
  const [savedJobs,   setSavedJobs]   = useState([])
  const mountedRef  = useRef(true)

  // ── Fetch fresh profile from Supabase DB ───────────────
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url, is_blocked')
        .eq('id', userId)
        .single()

      if (error || !data) return null

      cache.set(data)
      return data
    } catch { return null }
  }, [])

  // ── Fetch saved job IDs ────────────────────────────────
  const fetchSavedJobs = useCallback(async (userId) => {
    if (!userId) return
    try {
      const { data } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .eq('user_id', userId)
      if (mountedRef.current) {
        setSavedJobs(data?.map(r => r.job_id) || [])
      }
    } catch {}
  }, [])

  // ── Initialize auth on mount ───────────────────────────
  useEffect(() => {
    console.log('[Auth] Initializing...')
    mountedRef.current = true

    // SAFETY: Force initialization after 3 seconds max
    const timeout = setTimeout(() => {
      console.warn('[Auth] Init timeout — forcing ready after 3s')
      if (mountedRef.current) {
        setLoading(false)
        setInitialized(true)
      }
    }, 3000)

    const init = async () => {
      try {
        console.log('[Auth] Getting session...')
        const {
          data: { session },
        } = await supabase.auth.getSession()

        console.log('[Auth] Session:', session?.user?.email || 'no session')

        if (!mountedRef.current) return

        if (session?.user) {
          setUser(session.user)
          console.log('[Auth] User found:', session.user.email)

          // If no cached profile → fetch before showing UI
          // If cached → show instantly, refresh in background
          const cached = cache.get()
          if (!cached) {
            console.log('[Auth] No cache — fetching profile...')
            const fresh = await fetchProfile(session.user.id)
            if (mountedRef.current) {
              // Block check
              if (fresh?.is_blocked) {
                console.warn('[Auth] User is blocked — signing out')
                cache.clear()
                await supabase.auth.signOut()
                setUser(null)
                setProfile(null)
                return
              }
              setProfile(fresh)
            }
          } else {
            console.log('[Auth] Using cached profile')
            // Block check on cached profile
            if (cached.is_blocked) {
              console.warn('[Auth] Cached profile is blocked — signing out')
              cache.clear()
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              return
            }
            // Background refresh — does not block UI
            fetchProfile(session.user.id).then(fresh => {
              if (mountedRef.current && fresh) {
                if (fresh.is_blocked) {
                  console.warn('[Auth] Fresh profile is blocked — signing out')
                  cache.clear()
                  supabase.auth.signOut()
                  setUser(null)
                  setProfile(null)
                  return
                }
                setProfile(fresh)
              }
            })
          }

          fetchSavedJobs(session.user.id)
        } else {
          console.log('[Auth] No user session')
          cache.clear()
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('[Auth] Init error:', err)
      } finally {
        console.log('[Auth] Init complete (in finally)')
        if (mountedRef.current) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    init()

    // ── Listen for auth state changes ──────────────────
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event)
        if (!mountedRef.current) return

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          const p = await fetchProfile(session.user.id)
          if (mountedRef.current) {
            setProfile(p)
            fetchSavedJobs(session.user.id)
          }
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setSavedJobs([])
          cache.clear()
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      })

    return () => {
      console.log('[Auth] Cleanup')
      mountedRef.current = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [fetchProfile, fetchSavedJobs])

  // ─────────────────────────────────────────────────────
  // AUTH ACTIONS — defined once here, used everywhere
  // ─────────────────────────────────────────────────────

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password: password,
    })
    if (error) throw error
    return data
  }

  const signUp = async ({ email, password, fullName }) => {
    // No emailRedirectTo for purely OTP setups to avoid redirect whitelist issues
    const { data, error } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password: password,
      options: {
        data: { full_name: fullName },
      },
    })
    if (error) throw error
    return data
  }

  const resendVerification = async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    })
    if (error) throw error
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt:      'consent',
        },
      },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    try {
      console.log('[Auth] signOut started - clearing state')
      // Always clear local state FIRST (immediately)
      setUser(null)
      setProfile(null)
      setSavedJobs([])
      cache.clear()
      console.log('[Auth] State cleared, calling Supabase signOut...')
      
      // Then try to sign out from Supabase (may fail, but we've already cleared state)
      await supabase.auth.signOut()
      console.log('[Auth] Supabase signOut completed')
    } catch (err) {
      console.error('[Auth] Sign out error:', err)
      // State already cleared above, so error doesn't matter
    }
  }

  const toggleSave = async (jobId) => {
    if (!user) return
    const already = savedJobs.includes(jobId)

    // Optimistic UI update first
    setSavedJobs(prev =>
      already
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    )

    try {
      if (already) {
        await supabase
          .from('saved_jobs')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', jobId)
      } else {
        await supabase
          .from('saved_jobs')
          .insert({ user_id: user.id, job_id: jobId })
      }
    } catch (err) {
      // Revert if DB operation failed
      setSavedJobs(prev =>
        already
          ? [...prev, jobId]
          : prev.filter(id => id !== jobId)
      )
      console.error('[Auth] Toggle save error:', err)
    }
  }

  // ─────────────────────────────────────────────────────
  // COMPUTED VALUES — single source of truth
  // ─────────────────────────────────────────────────────

  // isAdmin is TRUE only when:
  // 1. Profile loaded from DB confirms role = 'admin'
  // 2. AND email matches the admin email
  // 3. AND account is not blocked
  const isAdmin = Boolean(
    profile?.role === 'admin' &&
    profile?.is_blocked !== true &&
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  )

  // Display name — consistent everywhere
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'

  // Avatar letter — consistent everywhere
  const avatarLetter = displayName[0]?.toUpperCase() || 'U'

  // ─────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────
  const value = {
    // State
    user,
    profile,
    loading,
    initialized,
    isAdmin,
    savedJobs,
    displayName,
    avatarLetter,
    // Actions
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    toggleSave,
    resendVerification,
  }

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────

  // Show small spinner only on FIRST load with no cache
  if (loading && !cache.get() && !profile) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-base, #0f172a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        flexDirection: 'column',
      }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid rgba(249,115,22,0.2)',
          borderTopColor: '#f97316',
          borderRadius: '50%',
          animation: 'nv-spin 0.6s linear infinite',
        }}/>
        <style>{`
          @keyframes nv-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  )
}

// ── Hook — single import everywhere ───────────────────
export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error(
    'useAuth must be used inside <AuthProvider>'
  )
  return ctx
}

// ── Export ADMIN_EMAIL for use in other files ──────────
export { ADMIN_EMAIL }
