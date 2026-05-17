import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Returns true only when both env vars are present
export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

// Create a real client only when configured; otherwise a dummy stub
// so importing this module never crashes the app.
export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken:   true,
        persistSession:     true,
        detectSessionInUrl: true,
        flowType:           'pkce',
        storageKey:         'nv_auth',
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

// Returns a fresh client instance to prevent stale state issues on repeated saves
// Takes an explicit token to prevent async localStorage initialization delays causing RLS drops.
export const createFreshClient = (accessToken) => {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers },
    auth: {
      persistSession: false, // Ephemeral client, don't overlap with global storage
      autoRefreshToken: false,
    },
  })
}

// Ensure session is valid, attempting a refresh if missing
export const ensureActiveSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { error } = await supabase.auth.refreshSession()
    if (error) throw new Error('Auth session expired. Please refresh the page.')
  }
}
