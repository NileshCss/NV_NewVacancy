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

// ── Helper: get backend API base URL with guaranteed /api suffix ──
const getApiBase = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
  url = url.replace(/\/+$/, '') // remove trailing slash
  if (!url.endsWith('/api')) {
    url += '/api'
  }
  return url
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
    apply_url:        job.apply_url         ? String(job.apply_url).trim()         : null,
    notification_url: job.notification_url  ? String(job.notification_url).trim()  : null,
    last_date:        job.last_date         || null,
    job_description:  job.description || job.job_description ? String(job.description || job.job_description).trim() : null,
    is_featured:      Boolean(job.is_featured ?? false),
    is_active:        Boolean(job.visible ?? job.is_active ?? true),
    tags:             Array.isArray(job.skill_tags || job.tags) ? (job.skill_tags || job.tags) : [],
    posted_at:        now,
    created_by:       job.created_by         || null,
    // Required DB fields with safe defaults (DB may have NOT NULL on these)
    status:           'published',
    employment_type:  job.employment_type   || 'Full-time',
    work_mode:        job.work_mode         || 'Office',
  }

  console.log('[addJob] payload:', payload)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  
  try {
    // Try the service-role admin path first (bypasses RLS)
    let adminResponse = null
    try {
      adminResponse = await adminFetch(`/admin/jobs`, {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: controller.signal
      })
    } catch (adminErr) {
      // Only fall through if the backend itself is unreachable (network error, 401 auth)
      // NOT if backend returned a proper error body
      console.warn('[addJob] Admin endpoint unreachable, falling back to direct DB insert:', adminErr.message)
    }

    if (adminResponse !== null) {
      // Backend responded — check result
      if (adminResponse.success) {
        console.log('[addJob] success via admin service')
        return adminResponse.data
      }
      // Backend is up but returned an error (e.g. DB error, validation) — surface it directly
      const errMsg = adminResponse.error || 'Admin service rejected the job creation'
      console.error('[addJob] Admin service error:', errMsg)
      throw new Error(errMsg)
    }

    // Fallback: direct Supabase insert (subject to RLS — only works if RLS allows this role)
    const { data, error } = await freshClient.from('jobs').insert(payload).select().single().abortSignal(controller.signal)
    if (error) {
      console.error('[addJob] Supabase error:', error)
      throw dbError(error)
    }
    console.log('[addJob] success via direct DB')
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
  const timeoutId = setTimeout(() => controller.abort(), 30000)  // 30s — updates can be slower
  
  try {
    // Try the service-role admin path first (bypasses RLS)
    try {
      const response = await adminFetch(`/admin/jobs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        signal: controller.signal
      })
      if (response && response.success) {
        console.log('[updateJob] success via admin service')
        return response.data
      }
    } catch (adminErr) {
      // If backend is unreachable or user is not admin, fallback to direct Supabase client
      console.warn('[updateJob] Admin update failed, falling back to direct DB update:', adminErr.message)
    }

    // Fallback: direct Supabase update (subject to RLS)
    const { data, error } = await freshClient.from('jobs').update(payload).eq('id', id).select().single().abortSignal(controller.signal)
    if (error) {
      console.error('[updateJob] Supabase error:', error)
      throw dbError(error)
    }
    console.log('[updateJob] success via direct DB')
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

export const deleteJob = async (id) => {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw dbError(error)
}

// ── WHATSAPP BACKEND SERVICE ──────────────────────────────────────
export const notifyJobOnWhatsApp = async (job, action = 'new') => {
  console.log(`[notifyJobOnWhatsApp] Triggering backend WhatsApp service for job ${job.id}`)

  // Wrap in a 15-second timeout
  const invokePromise = adminFetch('/whatsapp/notify-job', {
    method: 'POST',
    body: JSON.stringify({ action, job }),
  })

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('WhatsApp notification timed out after 15 seconds')), 15000)
  )

  try {
    const data = await Promise.race([invokePromise, timeoutPromise])

    if (!data?.success) {
      console.error('[notifyJobOnWhatsApp] WhatsApp Backend Error:', data?.error)
      throw new Error(data?.error || 'Unknown WhatsApp API error')
    }

    return data
  } catch (error) {
    console.error('[notifyJobOnWhatsApp] Request Error:', error)
    throw error
  }
}

export const testWhatsAppConnection = async () => {
  try {
    const data = await adminFetch('/whatsapp/test', {
      method: 'POST',
      body: JSON.stringify({ message: `✅ *NewVacancy WhatsApp Bot* is live!\nTest sent at ${new Date().toLocaleString('en-IN')}` }),
    })

    if (!data?.success) {
      throw new Error(data?.error || 'Unknown WhatsApp API error')
    }

    return data
  } catch (error) {
    console.error('[testWhatsAppConnection] Backend Error:', error)
    throw error
  }
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


/** Helper: get current session token + api base with 3-second timeout */
async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const apiBase = getApiBase()
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)
  
  try {
    const res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
    return json
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out')
    }
    throw err
  }
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
  const apiBase = getApiBase()

  // Warn clearly when no backend URL is configured (production with no deployed backend)
  const isLocalhost = apiBase.includes('localhost') || apiBase.includes('127.0.0.1')
  const isProduction = !window?.location?.hostname?.includes('localhost') && !window?.location?.hostname?.includes('127.0.0.1')
  if (isLocalhost && isProduction) {
    return {
      ok: false,
      success: false,
      error: 'Backend API is not configured for production. Set VITE_API_URL in your Vercel/hosting environment variables to point to your deployed backend.',
      code: 'BACKEND_NOT_CONFIGURED',
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for slow AI extraction

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
    if (!res.ok) {
      // Surface the actual error from the backend response
      console.error('[scrapeJobPreview] Backend error:', res.status, json)
    }
    return { ok: res.ok, status: res.status, ...json }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, success: false, error: 'Extraction timed out after 30 seconds. The backend may be offline or the target site is slow. Try again or fill manually.', code: 'TIMEOUT' }
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

// ── EXAM MODULE ────────────────────────────────────────────────
export const fetchExamCategories = async () => {
  try {
    const res = await adminFetch('/exam/categories', { method: 'GET' })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[fetchExamCategories] Backend offline or error, falling back to direct Supabase select:', err.message)
  }
  const { data, error } = await supabase.from('exam_categories').select('*').order('display_order', { ascending: true })
  if (error) throw dbError(error)
  return data || []
}

export const createExamCategory = async (payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch('/exam/categories', { method: 'POST', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[createExamCategory] Backend offline or error, falling back to direct Supabase insert:', err.message)
  }
  const { data, error } = await freshClient.from('exam_categories').insert(payload).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateExamCategory = async (id, payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[updateExamCategory] Backend offline or error, falling back to direct Supabase update:', err.message)
  }
  const { data, error } = await freshClient.from('exam_categories').update(payload).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteExamCategory = async (id) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/categories/${id}`, { method: 'DELETE' })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[deleteExamCategory] Backend offline or error, falling back to direct Supabase delete:', err.message)
  }
  const { error } = await freshClient.from('exam_categories').delete().eq('id', id)
  if (error) throw dbError(error)
  return { success: true }
}

export const fetchExams = async (categoryId = null) => {
  try {
    const query = categoryId ? `?category_id=${categoryId}` : ''
    const res = await adminFetch(`/exam/exams${query}`, { method: 'GET' })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[fetchExams] Backend offline or error, falling back to direct Supabase select:', err.message)
  }
  let query = supabase.from('exams').select('*, exam_categories(name, slug)').order('created_at', { ascending: false })
  if (categoryId) query = query.eq('category_id', categoryId)
  const { data, error } = await query
  if (error) throw dbError(error)
  return data || []
}

export const createExam = async (payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch('/exam/exams', { method: 'POST', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[createExam] Backend offline or error, falling back to direct Supabase insert:', err.message)
  }
  const { data, error } = await freshClient.from('exams').insert({ ...payload, created_by: session?.user?.id }).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateExam = async (id, payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/exams/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[updateExam] Backend offline or error, falling back to direct Supabase update:', err.message)
  }
  const { data, error } = await freshClient.from('exams').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteExam = async (id) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/exams/${id}`, { method: 'DELETE' })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[deleteExam] Backend offline or error, falling back to direct Supabase delete:', err.message)
  }
  const { error } = await freshClient.from('exams').delete().eq('id', id)
  if (error) throw dbError(error)
  return { success: true }
}

export const fetchSubjects = async (examId) => {
  try {
    const res = await adminFetch(`/exam/subjects?exam_id=${examId}`, { method: 'GET' })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[fetchSubjects] Backend offline or error, falling back to direct Supabase select:', err.message)
  }
  const { data, error } = await supabase.from('subjects').select('*').eq('exam_id', examId).order('display_order', { ascending: true })
  if (error) throw dbError(error)
  return data || []
}

export const createSubject = async (payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch('/exam/subjects', { method: 'POST', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[createSubject] Backend offline or error, falling back to direct Supabase insert:', err.message)
  }
  const { data, error } = await freshClient.from('subjects').insert(payload).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateSubject = async (id, payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[updateSubject] Backend offline or error, falling back to direct Supabase update:', err.message)
  }
  const { data, error } = await freshClient.from('subjects').update(payload).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteSubject = async (id) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/subjects/${id}`, { method: 'DELETE' })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[deleteSubject] Backend offline or error, falling back to direct Supabase delete:', err.message)
  }
  const { error } = await freshClient.from('subjects').delete().eq('id', id)
  if (error) throw dbError(error)
  return { success: true }
}

export const reorderSubjects = async (items) => {
  try {
    const res = await adminFetch('/exam/subjects/reorder', { method: 'PATCH', body: JSON.stringify({ items }) })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[reorderSubjects] Backend offline or error, falling back to direct Supabase reordering:', err.message)
  }
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  const promises = items.map(item => 
    freshClient.from('subjects').update({ display_order: item.display_order }).eq('id', item.id)
  )
  await Promise.all(promises)
  return { success: true }
}

export const fetchChapters = async (subjectId) => {
  try {
    const res = await adminFetch(`/exam/chapters?subject_id=${subjectId}`, { method: 'GET' })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[fetchChapters] Backend offline or error, falling back to direct Supabase select:', err.message)
  }
  const { data, error } = await supabase.from('chapters').select('*').eq('subject_id', subjectId).order('display_order', { ascending: true })
  if (error) throw dbError(error)
  return data || []
}

export const createChapter = async (payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch('/exam/chapters', { method: 'POST', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[createChapter] Backend offline or error, falling back to direct Supabase insert:', err.message)
  }
  const { data, error } = await freshClient.from('chapters').insert(payload).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateChapter = async (id, payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/chapters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[updateChapter] Backend offline or error, falling back to direct Supabase update:', err.message)
  }
  const { data, error } = await freshClient.from('chapters').update(payload).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteChapter = async (id) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/chapters/${id}`, { method: 'DELETE' })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[deleteChapter] Backend offline or error, falling back to direct Supabase delete:', err.message)
  }
  const { error } = await freshClient.from('chapters').delete().eq('id', id)
  if (error) throw dbError(error)
  return { success: true }
}

export const reorderChapters = async (items) => {
  try {
    const res = await adminFetch('/exam/chapters/reorder', { method: 'PATCH', body: JSON.stringify({ items }) })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[reorderChapters] Backend offline or error, falling back to direct Supabase reordering:', err.message)
  }
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  const promises = items.map(item => 
    freshClient.from('chapters').update({ display_order: item.display_order }).eq('id', item.id)
  )
  await Promise.all(promises)
  return { success: true }
}

export const fetchTopics = async (chapterId) => {
  try {
    const res = await adminFetch(`/exam/topics?chapter_id=${chapterId}`, { method: 'GET' })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[fetchTopics] Backend offline or error, falling back to direct Supabase select:', err.message)
  }
  const { data, error } = await supabase.from('topics').select('*').eq('chapter_id', chapterId).order('display_order', { ascending: true })
  if (error) throw dbError(error)
  return data || []
}

export const createTopic = async (payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch('/exam/topics', { method: 'POST', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[createTopic] Backend offline or error, falling back to direct Supabase insert:', err.message)
  }
  const { data, error } = await freshClient.from('topics').insert(payload).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateTopic = async (id, payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/topics/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[updateTopic] Backend offline or error, falling back to direct Supabase update:', err.message)
  }
  const { data, error } = await freshClient.from('topics').update(payload).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteTopic = async (id) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/topics/${id}`, { method: 'DELETE' })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[deleteTopic] Backend offline or error, falling back to direct Supabase delete:', err.message)
  }
  const { error } = await freshClient.from('topics').delete().eq('id', id)
  if (error) throw dbError(error)
  return { success: true }
}

export const reorderTopics = async (items) => {
  try {
    const res = await adminFetch('/exam/topics/reorder', { method: 'PATCH', body: JSON.stringify({ items }) })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[reorderTopics] Backend offline or error, falling back to direct Supabase reordering:', err.message)
  }
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  const promises = items.map(item => 
    freshClient.from('topics').update({ display_order: item.display_order }).eq('id', item.id)
  )
  await Promise.all(promises)
  return { success: true }
}

export const fetchQuestions = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString()
    const res = await adminFetch(`/exam/questions?${query}`, { method: 'GET' })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[fetchQuestions] Backend offline or error, falling back to direct Supabase query:', err.message)
  }
  let query = supabase.from('questions').select('*, question_exam_map(*)')
  if (params.difficulty) query = query.eq('difficulty', params.difficulty)
  if (params.status) query = query.eq('status', params.status)
  if (params.search) query = query.ilike('question_text', `%${params.search}%`)
  if (params.tag) query = query.contains('tags', [params.tag])
  const { data, error } = await query.order('created_at', { ascending: false }).limit(100)
  if (error) throw dbError(error)
  
  let results = data || []
  if (params.exam_id) {
    results = results.filter(q => q.question_exam_map?.some(map => map.exam_id === params.exam_id))
  }
  return results
}

export const fetchQuestion = async (id) => {
  try {
    const res = await adminFetch(`/exam/questions/${id}`, { method: 'GET' })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[fetchQuestion] Backend offline or error, falling back to direct Supabase select:', err.message)
  }
  const { data, error } = await supabase.from('questions').select('*, question_exam_map(*)').eq('id', id).single()
  if (error) throw dbError(error)
  return data
}

export const createQuestion = async (payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch('/exam/questions', { method: 'POST', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[createQuestion] Backend offline or error, falling back to direct Supabase insert:', err.message)
  }
  const mappings = payload.mappings || []
  const questionPayload = { ...payload }
  delete questionPayload.mappings
  const { data, error } = await freshClient.from('questions').insert({ ...questionPayload, created_by: session?.user?.id }).select().single()
  if (error) throw dbError(error)
  if (mappings.length > 0) {
    const maps = mappings.map(m => ({ ...m, question_id: data.id }))
    await freshClient.from('question_exam_map').insert(maps)
  }
  return data
}

export const updateQuestion = async (id, payload) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/questions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[updateQuestion] Backend offline or error, falling back to direct Supabase update:', err.message)
  }
  const mappings = payload.mappings
  const questionPayload = { ...payload }
  delete questionPayload.mappings
  const { data, error } = await freshClient.from('questions').update({ ...questionPayload, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw dbError(error)
  if (mappings !== undefined) {
    await freshClient.from('question_exam_map').delete().eq('question_id', id)
    if (mappings.length > 0) {
      const maps = mappings.map(m => ({ ...m, question_id: id }))
      await freshClient.from('question_exam_map').insert(maps)
    }
  }
  return data
}

export const updateQuestionStatus = async (id, status) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/questions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    if (res && res.success) return res.data
  } catch (err) {
    console.warn('[updateQuestionStatus] Backend offline or error, falling back to direct Supabase update:', err.message)
  }
  const { data, error } = await freshClient.from('questions').update({ status, reviewed_by: session?.user?.id, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
}

export const deleteQuestion = async (id) => {
  await ensureActiveSession()
  const { data: { session } } = await supabase.auth.getSession()
  const freshClient = createFreshClient(session?.access_token)
  try {
    const res = await adminFetch(`/exam/questions/${id}`, { method: 'DELETE' })
    if (res && res.success) return res
  } catch (err) {
    console.warn('[deleteQuestion] Backend offline or error, falling back to direct Supabase delete:', err.message)
  }
  const { error } = await freshClient.from('questions').delete().eq('id', id)
  if (error) throw dbError(error)
  return { success: true }
}

export const bulkImportQuestions = async (csvData, mappings) => {
  const res = await adminFetch('/exam/questions/bulk-import', { method: 'POST', body: JSON.stringify({ csvData, mappings }) })
  return res.data
}

export const extractQuestionsAI = async (rawText) => {
  const res = await adminFetch('/exam/questions/extract-ai', { method: 'POST', body: JSON.stringify({ rawText }) })
  return res.data
}

export const importQuestionsFile = async (file, examId) => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const apiBase = getApiBase()
  
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${apiBase}/exam/questions/import-file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  })
  
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`)
  return json.data
}


