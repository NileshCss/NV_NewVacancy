import { supabase, createFreshClient, ensureActiveSession } from './supabase'

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
// Falls back to active-only if RLS blocks inactive jobs (pre-migration safety)
export const fetchAllJobs = async (category = null) => {
  let query = supabase
    .from('jobs')
    .select('*')
    .order('posted_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) {
    // RLS is blocking inactive jobs — fall back to public active-only fetch
    console.warn('[fetchAllJobs] Full fetch blocked by RLS, falling back to active-only:', error.message)
    let fallback = supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('posted_at', { ascending: false })
    if (category) fallback = fallback.eq('category', category)
    const { data: fd, error: fe } = await fallback
    if (fe) throw dbError(fe)
    return fd ?? []
  }
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
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  
  const now = new Date().toISOString()

  // Handle both old and new form field names gracefully
  const vacanciesRaw = job.positions || job.vacancies
  const vacanciesInt = vacanciesRaw ? parseInt(String(vacanciesRaw).replace(/[^0-9]/g, ''), 10) : null

  const payload = {
    title:            String(job.title || '').trim(),
    organization:     String(job.organization || '').trim(),
    category:         job.category || 'govt',
    department:       job.department        ? String(job.department).trim()        : null,
    location:         String(job.location || 'All India').trim(),
    state:            job.state             ? String(job.state).trim()             : null,
    qualification:    job.qualification     ? String(job.qualification).trim()     : null,
    experience:       job.experience        ? String(job.experience).trim()        : null,
    vacancies:        !isNaN(vacanciesInt) ? vacanciesInt : null,
    salary_range:     job.salary_range      ? String(job.salary_range).trim()      : null,
    age_limit:        job.age_limit         ? String(job.age_limit).trim()         : null,
    apply_url:        String(job.apply_url || '').trim(),
    notification_url: job.notification_url  ? String(job.notification_url).trim()  : null,
    last_date:        job.last_date         || null,
    job_description:  job.description || job.job_description ? String(job.description || job.job_description).trim() : null,
    is_featured:      Boolean(job.is_featured ?? false),
    is_active:        Boolean(job.visible ?? job.is_active ?? true),
    tags:             Array.isArray(job.skill_tags || job.tags) ? (job.skill_tags || job.tags) : [],
    posted_at:        now,
    created_by:       job.created_by         || null,
  }

  console.log('[addJob] payload:', payload)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  
  try {
    const { data, error } = await freshClient.from('jobs').insert(payload).select().single().abortSignal(controller.signal)
    if (error) {
      console.error('[addJob] Supabase error:', error)
      throw dbError(error)
    }
    console.log('[addJob] success')
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

export const updateJob = async (id, job) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  
  const payload = { updated_at: new Date().toISOString() }

  if ('title' in job) payload.title = String(job.title || '').trim()
  if ('organization' in job) payload.organization = String(job.organization || '').trim()
  if ('category' in job) payload.category = job.category || 'govt'
  if ('department' in job) payload.department = job.department ? String(job.department).trim() : null
  if ('location' in job) payload.location = String(job.location || 'All India').trim()
  if ('state' in job) payload.state = job.state ? String(job.state).trim() : null
  if ('qualification' in job) payload.qualification = job.qualification ? String(job.qualification).trim() : null
  if ('experience' in job) payload.experience = job.experience ? String(job.experience).trim() : null
  
  if ('positions' in job || 'vacancies' in job) {
    const v = parseInt(String(job.positions || job.vacancies || '').replace(/[^0-9]/g, ''), 10)
    payload.vacancies = !isNaN(v) ? v : null
  }
  
  if ('salary_range' in job) payload.salary_range = job.salary_range ? String(job.salary_range).trim() : null
  if ('age_limit' in job) payload.age_limit = job.age_limit ? String(job.age_limit).trim() : null
  if ('apply_url' in job) payload.apply_url = String(job.apply_url || '').trim()
  if ('notification_url' in job) payload.notification_url = job.notification_url ? String(job.notification_url).trim() : null
  if ('last_date' in job) payload.last_date = job.last_date || null
  
  if ('description' in job || 'job_description' in job) payload.job_description = (job.description || job.job_description) ? String(job.description || job.job_description).trim() : null
  if ('is_featured' in job) payload.is_featured = Boolean(job.is_featured)
  if ('visible' in job || 'is_active' in job) payload.is_active = Boolean(job.visible ?? job.is_active)
  if ('skill_tags' in job || 'tags' in job) payload.tags = Array.isArray(job.skill_tags || job.tags) ? (job.skill_tags || job.tags) : []

  console.log('[updateJob] id:', id, 'payload:', payload)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  
  try {
    const { data, error } = await freshClient.from('jobs').update(payload).eq('id', id).select().single().abortSignal(controller.signal)
    if (error) {
      console.error('[updateJob] Supabase error:', error)
      throw dbError(error)
    }
    console.log('[updateJob] success')
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

export const deleteJob = async (id) => {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw dbError(error)
}

// ── WHATSAPP EDGE FUNCTION ──────────────────────────────────────
export const notifyJobOnWhatsApp = async (job, action = 'new') => {
  console.log(`[notifyJobOnWhatsApp] Triggering WhatsApp Edge Function for job ${job.id}`)
  
  const { data, error } = await supabase.functions.invoke('whatsapp-notify', {
    body: { action, vacancyData: job }
  })
  
  if (error) {
    console.error('[notifyJobOnWhatsApp] Edge Function Error:', error)
    throw new Error(error.message || 'Failed to trigger WhatsApp notification')
  }
  
  if (!data?.success) {
    console.error('[notifyJobOnWhatsApp] WhatsApp API Error:', data?.error)
    throw new Error(data?.error || 'Unknown WhatsApp API error')
  }
  
  return data
}

export const testWhatsAppConnection = async () => {
  const { data, error } = await supabase.functions.invoke('whatsapp-notify', {
    body: { action: 'test' }
  })
  
  if (error) throw new Error(error.message)
  if (!data?.success) throw new Error(data?.error)
  
  return data
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
    .select('id, email, full_name, role, avatar_url, is_blocked, provider, profile_completed, created_at, updated_at')
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

// ── JOB URL SCRAPER ────────────────────────────────────────────────────────
/**
 * Scrape a job URL and extract structured data via Claude AI.
 * Returns preview JSON — does NOT save to DB.
 * Admin reviews in form modal before clicking Save.
 *
 * @param {string} url - The job page URL
 * @returns {Promise<{ success: true, data: object, meta: object }>}
 * @throws on network error or when job is expired (code: 'URL_EXPIRED' | 'JOB_EXPIRED')
 */
export const scrapeJobPreview = async (url) => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${apiBase}/admin/scrape-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
      signal: controller.signal
    })

    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, ...json }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, success: false, error: 'Extraction timed out after 20 seconds. Please try again or fill manually.' }
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Manually trigger the nightly expiry check (super-admin only).
 * @returns {Promise<{ success: boolean, results: object }>}
 */
export const triggerExpiryCheck = async () =>
  adminFetch('/admin/trigger-expiry-check', { method: 'POST' })


/**
 * Promote a user to 'admin' role.
 */
export const promoteAdmin = async (userId) => {
  const { error } = await supabase.rpc('super_admin_promote_user', { target_user_id: userId })
  if (error) throw dbError(error)
  return { success: true }
}

/**
 * Demote an admin back to 'user'.
 */
export const demoteAdmin = async (userId) => {
  const { error } = await supabase.rpc('super_admin_demote_user', { target_user_id: userId })
  if (error) throw dbError(error)
  return { success: true }
}

/**
 * Block or unblock a user.
 */
export const blockUser = async (userId, isBlocked) => {
  const { error } = await supabase.rpc('admin_block_user', { target_user_id: userId, set_is_blocked: isBlocked })
  if (error) throw dbError(error)
  return { success: true }
}

/**
 * Permanently delete a user.
 */
export const deleteUser = async (userId) => {
  const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
  if (error) throw dbError(error)
  return { success: true }
}

/**
 * Update user role.
 */
export const updateRole = async (userId, role) => {
  if (role === 'admin') {
    return promoteAdmin(userId)
  } else {
    return demoteAdmin(userId)
  }
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
