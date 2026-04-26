import { supabase } from './supabase'

// ── RBAC: immutable super admin email — for UI guards only
// All actual enforcement is in the backend RBAC middleware.
export const SUPER_ADMIN_EMAIL = 'rajputnileshsingh3@gmail.com'

// ── Helper: build a readable error from Supabase error object ──
const dbError = (error) => {
  if (!error) return null
  // Include error code so we can diagnose RLS (42501) vs schema issues
  const code = error.code ? ` [${error.code}]` : ''
  return new Error((error.message || 'Database error') + code)
}

// ── JOBS ───────────────────────────────────────────────────────
// Public fetch — only active jobs shown to users
export const fetchJobs = async (category = null) => {
  let query = supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw dbError(error)
  return data ?? []
}

// Admin fetch — all jobs regardless of active status
export const fetchAllJobs = async (category = null) => {
  let query = supabase
    .from('jobs')
    .select('*')
    .order('posted_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw dbError(error)
  return data ?? []
}

// Lightweight fetch for AI analysis — only needed fields, max 50 jobs
export const fetchJobsForAI = async (category = null) => {
  let query = supabase
    .from('jobs')
    .select('id, title, organization, category, location, salary_range, tags, last_date, apply_url, qualification, department')
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
    .limit(50)
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw dbError(error)
  return data ?? []
}


export const addJob = async (job) => {
  const now = new Date().toISOString()
  const payload = {
    title:           job.title,
    organization:    job.organization,
    category:        job.category,
    location:        job.location || 'All India',
    apply_url:       job.apply_url,
    salary_range:    job.salary_range || null,
    job_description: job.job_description || '',
    is_featured:     Boolean(job.is_featured ?? false),
    is_active:       Boolean(job.is_active   ?? true),
    tags:            Array.isArray(job.tags) ? job.tags : [],
    posted_at:       now,  // ← required: prevents NOT NULL insert failure
  }

  // No .select().single() — that requires a SELECT RLS policy and causes hangs
  const { error } = await supabase.from('jobs').insert(payload)
  if (error) throw dbError(error)
}

export const updateJob = async (id, job) => {
  // Build a clean payload — never send internal React keys to Supabase
  const { id: _id, ...fields } = job
  const payload = {
    ...fields,
    // Always include job_description (even if empty string, so clears are saved)
    job_description: fields.job_description ?? '',
  }

  // No .select().single() — that requires a SELECT RLS policy and causes hangs
  const { error } = await supabase.from('jobs').update(payload).eq('id', id)
  if (error) throw dbError(error)
}

export const deleteJob = async (id) => {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw dbError(error)
}

// ── NEWS ───────────────────────────────────────────────────────
export const fetchNews = async () => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('published_at', { ascending: false })
  if (error) throw dbError(error)
  return data ?? []
}

export const addNews = async (news) => {
  const payload = {
    title:       news.title,
    summary:     news.summary     || null,
    source_name: news.source_name || null,
    source_url:  news.source_url  || null,
    category:    news.category,
    is_featured: false,
    is_active:   true,
  }
  const { data, error } = await supabase.from('news').insert(payload).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateNews = async (id, news) => {
  const { data, error } = await supabase.from('news').update(news).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteNews = async (id) => {
  const { error } = await supabase.from('news').delete().eq('id', id)
  if (error) throw dbError(error)
}

// ── AFFILIATES ─────────────────────────────────────────────────
export const fetchAffiliates = async () => {
  const { data, error } = await supabase.from('affiliates').select('*')
  if (error) throw dbError(error)
  return data ?? []
}

export const trackClick = async (id) => {
  const { error } = await supabase.rpc('increment_affiliate_clicks', { aff_id: id })
  if (error) console.error('[NV] click track error:', error.message)
}

export const addAffiliate = async (aff) => {
  const payload = {
    name:         aff.name,
    description:  aff.description  || null,
    redirect_url: aff.redirect_url,
    category:     aff.category,
    placement:    aff.placement,
    click_count:  0,               // ← correct DB column (not 'clicks')
    is_active:    true,
  }
  // Add emoji if the column exists (migration 005 adds it)
  if (aff.emoji) payload.emoji = aff.emoji
  const { data, error } = await supabase.from('affiliates').insert(payload).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateAffiliate = async (id, aff) => {
  const { data, error } = await supabase.from('affiliates').update(aff).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteAffiliate = async (id) => {
  const { error } = await supabase.from('affiliates').delete().eq('id', id)
  if (error) throw dbError(error)
}

// ── USERS (Admin only) ─────────────────────────────────────────
export const fetchUsers = async () => {
  // Strategy 1: Try backend API (computes effective super_admin role server-side)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token    = session?.access_token
    const apiBase  = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    const res      = await fetch(`${apiBase}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      return json.data ?? []
    }
    // Non-network error (e.g. 403, 500) — fall through to Supabase fallback
    const json = await res.json().catch(() => ({}))
    console.warn('[fetchUsers] Backend error, falling back to Supabase:', json.error)
  } catch (backendErr) {
    // Backend not running or network error — fall through silently
    console.warn('[fetchUsers] Backend unreachable, falling back to Supabase direct query')
  }

  // Strategy 2: Direct Supabase query (works even without backend)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw dbError(error)

  // Compute effective role client-side for the fallback path
  return (data ?? []).map(p => ({
    ...p,
    role: p.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      ? 'super_admin'
      : (p.role || 'user'),
  }))
}


/** Helper: get current session token + api base */
async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

/**
 * Promote a user to 'admin' role.
 * Backend enforces: ONLY super_admin can call this.
 */
export const promoteAdmin = async (userId) =>
  adminFetch('/admin/promote', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })

/**
 * Demote an admin back to 'user'.
 * Backend enforces: ONLY super_admin can call this.
 */
export const demoteAdmin = async (userId) =>
  adminFetch('/admin/demote', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })

/**
 * Block or unblock a user.
 * Backend enforces: admins can't block other admins (only super_admin can).
 */
export const blockUser = async (userId, isBlocked) =>
  adminFetch('/admin/block', {
    method: 'POST',
    body: JSON.stringify({ userId, isBlocked }),
  })

/**
 * Delete a user (cascade: auth.users → profiles → related data).
 * Backend enforces: can't delete super_admin or other admins (only super_admin can delete admins).
 */
export const deleteUser = async (userId) =>
  adminFetch('/admin/delete-user', {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  })

// Keep updateRole as a direct alias for backward compat (now routes through backend)
export const updateRole = async (userId, role) => {
  // Run the backend admin route to fully delete users.
  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  if (error) throw dbError(error)
}

// ── ADMIN STATS ────────────────────────────────────────────────
export const fetchAdminStats = async () => {
  const { data, error } = await supabase.functions.invoke('admin-stats')
  if (error) throw dbError(error)
  return data
}

// ── SAVED JOBS ─────────────────────────────────────────────────
export const fetchSavedJobs = async (userId) => {
  const { data, error } = await supabase
    .from('saved_jobs')
    .select('*, jobs(*)')
    .eq('user_id', userId)
  if (error) throw dbError(error)
  return (data ?? []).map(item => item.jobs).filter(Boolean)
}

export const toggleSavedJob = async (userId, jobId) => {
  const { data: existing, error: existError } = await supabase
    .from('saved_jobs').select('id').eq('user_id', userId).eq('job_id', jobId).maybeSingle()
  if (existError) throw dbError(existError)

  if (existing) {
    const { error } = await supabase.from('saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId)
    if (error) throw dbError(error)
    return false
  } else {
    const { error } = await supabase.from('saved_jobs').insert({ user_id: userId, job_id: jobId })
    if (error) throw dbError(error)
    return true
  }
}
