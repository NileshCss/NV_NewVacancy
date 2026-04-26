import { supabase } from './supabase'

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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw dbError(error)
  return data ?? []
}

export const updateRole = async (userId, role) => {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw dbError(error)
}

export const blockUser = async (userId, isBlocked) => {
  const { error } = await supabase.from('profiles').update({ is_blocked: isBlocked }).eq('id', userId)
  if (error) throw dbError(error)
}

export const deleteUser = async (userId) => {
  // ── Strategy 1: Call backend admin API (uses service_role key) ──────────────
  // This deletes from auth.users → CASCADE removes profiles + all related data
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    const response = await fetch(`${apiBase}/admin/delete-user`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ userId }),
    })

    if (response.ok) return  // Backend handled it — cascade deletes everything

    const result = await response.json().catch(() => ({}))
    // If backend route doesn't exist yet (404/500), fall through to profile-only delete
    if (response.status !== 404) throw new Error(result.error || `Delete failed (${response.status})`)
  } catch (fetchErr) {
    // Network error or backend not running — fall through to profile-only delete
    if (!fetchErr.message?.includes('fetch') && !fetchErr.message?.includes('NetworkError') && !fetchErr.message?.includes('Failed to fetch')) {
      throw dbError({ message: fetchErr.message })
    }
    console.warn('[deleteUser] Backend unreachable, falling back to profile-only delete:', fetchErr.message)
  }

  // ── Strategy 2 (fallback): Delete profile row only ─────────────────────────
  // Note: this does NOT delete the auth.users record (user can still log in)
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
