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

  // Full whitelist — matches all 22 confirmed columns in live Supabase DB
  const payload = {
    title:            String(job.title || '').trim(),
    organization:     String(job.organization || '').trim(),
    category:         job.category || 'govt',
    department:       job.department        ? String(job.department).trim()        : '',
    location:         String(job.location || 'All India').trim(),
    state:            job.state             ? String(job.state).trim()             : null,
    qualification:    job.qualification     ? String(job.qualification).trim()     : '',
    vacancies:        job.vacancies         ? Number(job.vacancies)                : 1,
    salary_range:     job.salary_range      ? String(job.salary_range).trim()      : null,
    age_limit:        job.age_limit         ? String(job.age_limit).trim()         : null,
    apply_url:        String(job.apply_url || '').trim(),
    notification_url: job.notification_url  ? String(job.notification_url).trim()  : null,
    last_date:        job.last_date         || null,
    job_description:  String(job.job_description || '').trim(),
    is_featured:      Boolean(job.is_featured ?? false),
    is_active:        Boolean(job.is_active   ?? true),
    tags:             Array.isArray(job.tags) ? job.tags : [],
    experience_range: job.experience_range   || '0-1',
    posted_at:        now,
    created_by:       job.created_by         || null,
  }

  console.log('[addJob] payload:', payload)
  const { error } = await supabase.from('jobs').insert(payload)
  if (error) {
    console.error('[addJob] Supabase error:', error)
    throw dbError(error)
  }
  console.log('[addJob] success')
}

export const updateJob = async (id, job) => {
  // Full whitelist — matches all 22 confirmed columns in live Supabase DB
  const payload = {
    title:            String(job.title || '').trim(),
    organization:     String(job.organization || '').trim(),
    category:         job.category || 'govt',
    department:       job.department        ? String(job.department).trim()        : '',
    location:         String(job.location || 'All India').trim(),
    state:            job.state             ? String(job.state).trim()             : null,
    qualification:    job.qualification     ? String(job.qualification).trim()     : '',
    vacancies:        job.vacancies         ? Number(job.vacancies)                : 1,
    salary_range:     job.salary_range      ? String(job.salary_range).trim()      : null,
    age_limit:        job.age_limit         ? String(job.age_limit).trim()         : null,
    apply_url:        String(job.apply_url || '').trim(),
    notification_url: job.notification_url  ? String(job.notification_url).trim()  : null,
    last_date:        job.last_date         || null,
    job_description:  String(job.job_description || '').trim(),
    is_featured:      Boolean(job.is_featured ?? false),
    is_active:        Boolean(job.is_active   ?? true),
    tags:             Array.isArray(job.tags) ? job.tags : [],
    experience_range: job.experience_range   || '0-1',
    updated_at:       new Date().toISOString(),
  }

  console.log('[updateJob] id:', id, 'payload:', payload)
  const { error } = await supabase.from('jobs').update(payload).eq('id', id)
  if (error) {
    console.error('[updateJob] Supabase error:', error)
    throw dbError(error)
  }
  console.log('[updateJob] success')
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

// ── USERS (Admin only) — Direct Supabase (no backend dependency) ──────────
export const fetchUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url, is_blocked, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw dbError(error)

  // Compute effective role client-side
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
 * Block or unblock a user — Direct Supabase (no backend required).
 */
export const blockUser = async (userId, isBlocked) => {
  const { error } = await supabase
    .from('profiles')
    .update({ is_blocked: isBlocked, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw dbError(error)
  return { success: true }
}

/**
 * Delete a user — removes from profiles table (cascade handles the rest).
 */
export const deleteUser = async (userId) => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
  if (error) throw dbError(error)
  return { success: true }
}

/**
 * Update user role directly in Supabase — no backend required.
 * Only super_admin should call promote; RBAC is enforced in UI layer.
 */
export const updateRole = async (userId, role) => {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw dbError(error)
  return { success: true }
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
