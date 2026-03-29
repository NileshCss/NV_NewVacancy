import { supabase } from './supabase'

// ── Helper: build a readable error from Supabase error object ──
const dbError = (error) => {
  if (!error) return null
  // Include error code so we can diagnose RLS (42501) vs schema issues
  const code = error.code ? ` [${error.code}]` : ''
  return new Error((error.message || 'Database error') + code)
}

// ── JOBS ───────────────────────────────────────────────────────
export const fetchJobs = async (category = null) => {
  let query = supabase
    .from('jobs')
    .select('*')
    .order('posted_at', { ascending: false })   // ← correct column name
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw dbError(error)
  return data ?? []
}

export const addJob = async (job) => {
  // Only send columns that exist in the schema
  const payload = {
    title:        job.title,
    organization: job.organization,
    category:     job.category,
    location:     job.location || 'All India',
    apply_url:    job.apply_url,
    salary_range: job.salary_range || null,
    vacancies:    job.vacancies    ? parseInt(job.vacancies) : null,
    last_date:    job.last_date    || null,
    is_featured:  false,
    is_active:    true,
    tags:         Array.isArray(job.tags) ? job.tags : [],
  }
  const { data, error } = await supabase.from('jobs').insert(payload).select().single()
  if (error) throw dbError(error)
  return data
}

export const updateJob = async (id, job) => {
  const { data, error } = await supabase.from('jobs').update(job).eq('id', id).select().single()
  if (error) throw dbError(error)
  return data
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
