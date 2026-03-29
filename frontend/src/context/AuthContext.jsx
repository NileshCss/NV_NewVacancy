import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null)
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)   // true until first session check
  const [authError, setAuthError] = useState(null)

  // ── Fetch user profile row ────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    if (!userId || !isSupabaseConfigured()) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url, is_blocked')
        .eq('id', userId)
        .maybeSingle()
      if (error) {
        console.warn('[NV] Profile fetch warning:', error.message)
        return
      }
      if (data) setProfile(data)
    } catch (err) {
      console.error('[NV] fetchProfile error:', err.message)
    }
  }, [])

  // ── Auth state listener (single source of truth) ──────────────────────────
  // We rely ONLY on onAuthStateChange which fires INITIAL_SESSION on mount
  // for any stored session, SIGNED_IN after login, SIGNED_OUT after logout.
  useEffect(() => {
    let mounted = true

    // ── Safety timeout: if INITIAL_SESSION never fires (network/config issue)
    // unblock loading after 5 s so the UI doesn't stay frozen forever.
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(prev => {
          if (prev) console.warn('[NV] Auth loading timeout — forcing loading=false')
          return false
        })
      }
    }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        console.info('[NV] Auth event:', event)

        if (event === 'INITIAL_SESSION') {
          // Fired once on startup — session is the stored one or null
          clearTimeout(safetyTimer)  // cancel the safety timer
          if (session?.user) {
            setUser(session.user)
            setAuthError(null)
            await fetchProfile(session.user.id)
          } else {
            setUser(null)
            setProfile(null)
          }
          setLoading(false)   // ← loading ends here, always, on first event
          return
        }

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          setAuthError(null)
          await fetchProfile(session.user.id)
          setLoading(false)
          return
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
          return
        }

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setUser(null)
          setProfile(null)
          setAuthError(null)
          setLoading(false)
          return
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = async ({ email, password }) => {
    if (!email?.trim())    throw new Error('Email is required')
    if (!password?.trim()) throw new Error('Password is required')
    if (password.length < 6) throw new Error('Password must be at least 6 characters')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
    return data
  }

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const signUp = async ({ email, password, fullName }) => {
    if (!email?.trim())    throw new Error('Email is required')
    if (!password?.trim()) throw new Error('Password is required')
    if (password.length < 6) throw new Error('Password must be at least 6 characters')
    if (!fullName?.trim()) throw new Error('Full name is required')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) throw new Error('Please enter a valid email address')

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return data
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw error
    return data
  }

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    // Clear React state immediately so UI updates right away
    setUser(null)
    setProfile(null)
    setAuthError(null)
    // Purge any lingering localStorage keys
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('nv-auth'))
        .forEach(k => localStorage.removeItem(k))
    } catch { /* ignore storage errors */ }
    // Call Supabase signOut — 'local' scope signs out this tab only (faster)
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      console.warn('[NV] Supabase sign out error (session already cleared):', err?.message)
    }
  }

  // ── Get profile role by email (used right after login) ────────────────────
  const getProfileByEmail = async (email) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      return data
    } catch {
      return null
    }
  }

  const isAdmin   = profile?.role === 'admin'
  const isBlocked = profile?.is_blocked === true

  // Legacy aliases
  const login       = signIn
  const logout      = signOut
  const signup      = signUp
  const loginGoogle = signInWithGoogle

  return (
    <AuthCtx.Provider value={{
      user,
      profile,
      loading,
      loadingAuth: loading,
      authError,
      isAdmin,
      isBlocked,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      fetchProfile,
      getProfileByEmail,
      login,
      logout,
      signup,
      loginGoogle,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
