import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Dev-mode diagnostics ──────────────────────────────────────
if (import.meta.env.DEV) {
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    console.error(
      '%c[NV] ⚠️  VITE_SUPABASE_URL is missing or placeholder!\n' +
      'Create frontend/.env and set:\n' +
      '  VITE_SUPABASE_URL=https://xxxx.supabase.co\n' +
      '  VITE_SUPABASE_ANON_KEY=your-anon-key',
      'color: #f97316; font-size: 14px; font-weight: bold;'
    )
  } else {
    console.info('%c[NV] ✅ Supabase connected to:', 'color: #22c55e;', supabaseUrl)
  }
}

export const supabase = createClient(
  supabaseUrl     || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken:  true,
      persistSession:    true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'nv-auth-token',      // unique key avoids clashes in dev
    },
    global: {
      headers: { 'x-client-info': 'new-vacancy/1.0' },
    },
  }
)

// ── Handy helper to check config at runtime ───────────────────
export const isSupabaseConfigured = () =>
  !!supabaseUrl &&
  !supabaseUrl.includes('placeholder') &&
  !!supabaseAnonKey &&
  supabaseAnonKey !== 'placeholder-anon-key'
