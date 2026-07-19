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
const ADMIN_EMAIL       = 'rajputnileshsingh3@gmail.com'
const SUPER_ADMIN_EMAIL = 'rajputnileshsingh3@gmail.com'  // immutable — never reassign
const CACHE_KEY         = 'nv_profile'
const CACHE_TTL         = 5 * 60 * 1000  // 5 minutes

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
  const [showProfileCompletion, setShowProfileCompletion] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  // Recovery session: set when Supabase fires PASSWORD_RECOVERY.
  // While true, the user object is set (needed to call updateUser) but
  // the app must NOT treat this as a normal login — no redirects to home/admin.
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  const mountedRef = useRef(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url, is_blocked, provider, profile_completed')
        .eq('id', userId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.warn('[Auth] Profile not found, creating fallback...');
          return await createProfileFallback(userId);
        }
        console.error('[Auth] Error fetching profile:', error);
        return null;
      }
      
      if (data && !data.profile_completed && data.provider === 'google') {
        setShowProfileCompletion(true);
      }
      
      cache.set(data)
      return data
    } catch { return null }
  }, [])

  // ── Fallback: create profile if trigger didn't fire ──
  const createProfileFallback = useCallback(async (userId) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      const provider = authUser.app_metadata?.provider || 'email';

      // Generate a unique 8-char referral code for this user
      const referralCode = Math.random().toString(36).slice(2, 6).toUpperCase() +
                           Math.random().toString(36).slice(2, 6).toUpperCase()

      const newProfile = {
        id: userId,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name 
          || authUser.user_metadata?.name 
          || authUser.email.split('@')[0],
        avatar_url: authUser.user_metadata?.avatar_url 
          || authUser.user_metadata?.picture 
          || '',
        role: 'user',
        provider,
        profile_completed: provider !== 'google',
        is_active: true,
        referral_code: referralCode,
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (error) throw error;
      
      if (!data.profile_completed && provider === 'google') {
        setShowProfileCompletion(true);
      }
      cache.set(data);
      return data;
    } catch (err) {
      console.error('[Auth] createProfileFallback error:', err.message);
      return null;
    }
  }, []);

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
          // Check if this might be a recovery session (page loaded from a
          // reset-password link). The onAuthStateChange listener will handle
          // it properly with the PASSWORD_RECOVERY event — don't pre-emptively
          // treat it as a normal login during init.
          const params = new URLSearchParams(window.location.search)
          const hash   = window.location.hash
          const mightBeRecovery =
            hash.includes('type=recovery') ||
            params.get('type') === 'recovery'

          if (mightBeRecovery) {
            // Let the onAuthStateChange PASSWORD_RECOVERY event handle this.
            // Just mark initialized without setting user as a normal session.
            return
          }

          setUser(session.user)

          const cached = cache.get()
          if (!cached) {
            // ── Parallel fetch: profile + saved jobs at the same time ──────
            const [fresh] = await Promise.all([
              fetchProfile(session.user.id),
              fetchSavedJobs(session.user.id),
            ])
            if (!mountedRef.current) return
            if (fresh?.is_blocked) { await signOutBlocked(); return }
            setProfile(fresh)
          } else {
            if (cached.is_blocked) { await signOutBlocked(); return }
            // Background parallel refresh — does not block UI
            Promise.all([
              fetchProfile(session.user.id),
              fetchSavedJobs(session.user.id),
            ]).then(([fresh]) => {
              if (!mountedRef.current || !fresh) return
              if (fresh.is_blocked) { signOutBlocked(); return }
              setProfile(fresh)
            })
          }
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

        // ── PASSWORD_RECOVERY: user clicked a reset-password email link ──
        // We set the user object so updateUser() will work, but mark this
        // as a recovery session so the rest of the app doesn't treat it
        // as a normal login and redirect to home/admin.
        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          setUser(session.user)
          setIsRecoverySession(true)
          // Do NOT fetch profile or saved jobs — recovery session has no dashboard access
          return
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // If we're already in a recovery session, a SIGNED_IN event fires too
          // (Supabase emits both). Ignore it — let PASSWORD_RECOVERY handling stand.
          if (isRecoverySession) return
          setUser(session.user)
          // ALWAYS clear cache on sign-in so promoted admins get their
          // new role immediately instead of seeing a stale 'user' role.
          cache.clear()
          // ── Parallel fetch: profile + saved jobs ────────────────────────
          const [p] = await Promise.all([
            fetchProfile(session.user.id),
            fetchSavedJobs(session.user.id),
          ])
          if (mountedRef.current) setProfile(p)
        }
        if (event === 'SIGNED_OUT') {
          setUser(null); setProfile(null); setSavedJobs([]); cache.clear();
          setShowProfileCompletion(false); setIsEditingProfile(false);
          setIsRecoverySession(false)
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
      // Clear all local state immediately so the UI feels instant
      setUser(null); setProfile(null); setSavedJobs([]); cache.clear();
      setShowProfileCompletion(false); setIsEditingProfile(false);
      // Clear any saved post-login redirect so it doesn't leak into the next session
      sessionStorage.removeItem('redirectAfterLogin')
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[Auth] Sign out error:', err)
    }
  }

  const forgotPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      // Point directly at the dedicated reset-password route so the
      // recovery token is handled by ResetPasswordPage without any
      // intermediate redirect through /auth/callback.
      { redirectTo: `${window.location.origin}/auth/reset-password` }
    )
    if (error) throw error
  }

  // ── RECORD REFERRAL ───────────────────────────────────────────────
  // Call this after a new user has signed up and has an active session.
  // referralCode: the ?ref= value captured from the signup URL.
  const recordReferral = async (referralCode) => {
    if (!referralCode) return
    try {
      // Look up the referrer's user_id via the DB function (bypasses RLS)
      const { data: referrerId, error: lookupErr } = await supabase
        .rpc('get_referrer_by_code', { p_code: referralCode.trim().toUpperCase() })
      if (lookupErr || !referrerId) {
        console.warn('[Auth] Referral code not found:', referralCode)
        return
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser || currentUser.id === referrerId) return // can't refer yourself

      // Insert the referral record
      const { error: insertErr } = await supabase.from('referrals').insert({
        referrer_id: referrerId,
        referred_id: currentUser.id,
      })
      if (insertErr) console.warn('[Auth] Failed to record referral:', insertErr.message)
      else console.log('[Auth] Referral recorded successfully')

      // Clear the stored code so it's not applied again
      sessionStorage.removeItem('nv_referral_code')
    } catch (err) {
      console.error('[Auth] recordReferral error:', err.message)
    }
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

  // ── MARK PROFILE COMPLETE ─────────────────────────────────────────
  const markProfileComplete = async (updates) => {
    if (!user) return { success: false };
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      cache.set(data);
      if (mountedRef.current) {
        setProfile(data);
        setShowProfileCompletion(false);
        setIsEditingProfile(false);
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Auth] markProfileComplete error:', err.message);
      return { success: false, error: err.message };
    }
  };

  // ── REFRESH PROFILE ───────────────────────────────────────────────
  // Force-busts the cache and re-fetches from DB.
  // Call this after a role change so the affected user sees their new
  // permissions immediately without needing to log out and back in.
  const refreshProfile = useCallback(async () => {
    if (!user) return null
    cache.clear()
    const fresh = await fetchProfile(user.id)
    if (mountedRef.current && fresh) {
      if (fresh.is_blocked) { await signOutBlocked(); return null }
      setProfile(fresh)
    }
    return fresh
  }, [user, fetchProfile, signOutBlocked])

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
  // NOTE: isAdmin is true for BOTH admin and super_admin roles.
  const isAdmin = Boolean(
    (profile?.role === 'admin' || profile?.role === 'super_admin' ||
     user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) &&
    profile?.is_blocked !== true
  )

  // isSuperAdmin: ONLY the hardcoded email — never trust DB role alone for this
  const isSuperAdmin = Boolean(
    user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() &&
    profile?.is_blocked !== true
  )

  // Effective role — what the user's role actually is for display purposes
  const effectiveRole = isSuperAdmin
    ? 'super_admin'
    : profile?.role || 'user'

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
    user, profile, loading, initialized, isAdmin, isSuperAdmin, effectiveRole,
    savedJobs, displayName, avatarLetter, showProfileCompletion,
    setShowProfileCompletion, markProfileComplete,
    isEditingProfile, setIsEditingProfile,
    isRecoverySession,
    signIn, signUp, signInWithGoogle, signOut,
    updateProfile, refreshProfile, toggleSave, resendVerification, forgotPassword,
    recordReferral,
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
