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
const ADMIN_EMAIL = 'rajputnileshsingh3@gmail.com'
const CACHE_KEY   = 'nv_profile'
const CACHE_TTL   = 5 * 60 * 1000  // 5 minutes

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
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
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

  const [user,        setUser]        = useState(null)
  const [profile,     setProfile]     = useState(cache.get())
  const [loading,     setLoading]     = useState(!cache.get())
  const [initialized, setInitialized] = useState(false)
  const [savedJobs,   setSavedJobs]   = useState([])
  const mountedRef = useRef(true)

  // ── Fetch fresh profile from DB ────────────────────────
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
      if (mountedRef.current) setSavedJobs(data?.map(r => r.job_id) || [])
    } catch {}
  }, [])

  // ── Shared: sign out a blocked user ───────────────────
  const signOutBlocked = useCallback(async () => {
    cache.clear()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  // ── Initialize auth on mount ───────────────────────────
  useEffect(() => {
    mountedRef.current = true

    // Safety valve: force ready after 3 s max
    const timeout = setTimeout(() => {
      if (mountedRef.current) { setLoading(false); setInitialized(true) }
    }, 3000)

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mountedRef.current) return

        if (session?.user) {
          setUser(session.user)

          const cached = cache.get()
          if (!cached) {
            const fresh = await fetchProfile(session.user.id)
            if (!mountedRef.current) return
            if (fresh?.is_blocked) { await signOutBlocked(); return }
            setProfile(fresh)
          } else {
            if (cached.is_blocked) { await signOutBlocked(); return }
            // Background refresh — does not block UI
            fetchProfile(session.user.id).then(fresh => {
              if (!mountedRef.current || !fresh) return
              if (fresh.is_blocked) { signOutBlocked(); return }
              setProfile(fresh)
            })
          }
          fetchSavedJobs(session.user.id)
        } else {
          cache.clear()
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('[Auth] Init error:', err)
      } finally {
        if (mountedRef.current) { setLoading(false); setInitialized(true) }
      }
    }

    init()

    // ── Listen for auth state changes ──────────────────
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mountedRef.current) return

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          const p = await fetchProfile(session.user.id)
          if (mountedRef.current) { setProfile(p); fetchSavedJobs(session.user.id) }
        }
        if (event === 'SIGNED_OUT') {
          setUser(null); setProfile(null); setSavedJobs([]); cache.clear()
        }
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [fetchProfile, fetchSavedJobs, signOutBlocked])

  // ─────────────────────────────────────────────────────
  // AUTH ACTIONS
  // ─────────────────────────────────────────────────────

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
    return data
  }

  const signUp = async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName },
        // CRITICAL: tells Supabase where to redirect if user clicks the
        // email link instead of entering the OTP code. Without this,
        // Supabase defaults to localhost and the link breaks in production.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
        redirectTo:  `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    try {
      setUser(null); setProfile(null); setSavedJobs([]); cache.clear()
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[Auth] Sign out error:', err)
    }
  }

  const forgotPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback` }
    )
    if (error) throw error
  }

  // ── UPDATE PROFILE ────────────────────────────────────────────────
  const updateProfile = async (updates) => {
    if (!user) return { success: false, error: 'Not authenticated' }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw error
      // Update local cache
      cache.set(data)
      if (mountedRef.current) setProfile(data)
      return { success: true, data }
    } catch (err) {
      console.error('[Auth] updateProfile error:', err.message)
      return { success: false, error: err.message }
    }
  }

  const toggleSave = async (jobId) => {
    if (!user) return
    const already = savedJobs.includes(jobId)

    // Optimistic update
    setSavedJobs(prev => already ? prev.filter(id => id !== jobId) : [...prev, jobId])

    try {
      if (already) {
        await supabase.from('saved_jobs').delete().eq('user_id', user.id).eq('job_id', jobId)
      } else {
        await supabase.from('saved_jobs').insert({ user_id: user.id, job_id: jobId })
      }
    } catch (err) {
      // Revert on failure
      setSavedJobs(prev => already ? [...prev, jobId] : prev.filter(id => id !== jobId))
      console.error('[Auth] Toggle save error:', err)
    }
  }

  // ─────────────────────────────────────────────────────
  // COMPUTED VALUES — single source of truth
  // ─────────────────────────────────────────────────────
  // NOTE: isAdmin requires role='admin' only.
  // The email hardcode was removed — it blocked any second admin from working.
  const isAdmin = Boolean(
    profile?.role === 'admin' &&
    profile?.is_blocked !== true
  )

  const displayName =
    profile?.full_name         ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name  ||
    user?.email?.split('@')[0] ||
    'User'

  const avatarLetter = displayName[0]?.toUpperCase() || 'U'

  // ─────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────
  const value = {
    user, profile, loading, initialized, isAdmin,
    savedJobs, displayName, avatarLetter,
    signIn, signUp, signInWithGoogle, signOut,
    updateProfile, toggleSave, resendVerification, forgotPassword,
  }

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────
export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export { ADMIN_EMAIL }
