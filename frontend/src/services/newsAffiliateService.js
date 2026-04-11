import { supabase } from './supabase'

// ── Helper: build a readable error from Supabase error object ──
const dbError = (error) => {
  if (!error) return null
  const code = error.code ? ` [${error.code}]` : ''
  return new Error((error.message || 'Database error') + code)
}

// ============================================================
// NEWS (v2) - CRUD Operations
// ============================================================

export const fetchNews = async (filters = {}) => {
  let query = supabase
    .from('news_v2')
    .select('*')
    .order('created_at', { ascending: false })

  // Apply status filter
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  // Apply category filter
  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  // Apply search filter
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`)
  }

  // Apply pagination
  if (filters.limit) {
    const offset = filters.offset || 0
    query = query.range(offset, offset + filters.limit - 1)
  }

  const { data, error } = await query
  if (error) throw dbError(error)
  return data ?? []
}

export const getNewsById = async (id) => {
  const { data, error } = await supabase
    .from('news_v2')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw dbError(error)
  return data
}

export const addNews = async (newsData) => {
  const payload = {
    title: newsData.title.trim(),
    slug: newsData.slug?.trim() || newsData.title.trim().toLowerCase().replace(/\s+/g, '-'),
    excerpt: newsData.excerpt?.trim() || null,
    content: newsData.content?.trim() || null,
    cover_image: newsData.cover_image || null,
    category: newsData.category || 'general',
    tags: Array.isArray(newsData.tags) ? newsData.tags : [],
    status: newsData.status || 'draft',
    published_at: newsData.status === 'published' ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from('news_v2')
    .insert(payload)
    .select()
    .single()
  if (error) throw dbError(error)
  return data
}

export const updateNews = async (id, newsData) => {
  const updates = {
    ...(newsData.title && { title: newsData.title.trim() }),
    ...(newsData.slug && { slug: newsData.slug.trim() }),
    ...(newsData.excerpt !== undefined && { excerpt: newsData.excerpt?.trim() || null }),
    ...(newsData.content !== undefined && { content: newsData.content?.trim() || null }),
    ...(newsData.cover_image !== undefined && { cover_image: newsData.cover_image || null }),
    ...(newsData.category && { category: newsData.category }),
    ...(newsData.tags && { tags: Array.isArray(newsData.tags) ? newsData.tags : [] }),
    ...(newsData.status && { 
      status: newsData.status,
      published_at: newsData.status === 'published' ? new Date().toISOString() : null,
    }),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('news_v2')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw dbError(error)
  return data
}

export const deleteNews = async (id) => {
  const { error } = await supabase
    .from('news_v2')
    .delete()
    .eq('id', id)
  if (error) throw dbError(error)
}

// ============================================================
// AFFILIATES (v2) - CRUD Operations
// ============================================================

export const fetchAffiliates = async (filters = {}) => {
  let query = supabase
    .from('affiliates_v2')
    .select('*')
    .order('created_at', { ascending: false })

  // Apply status filter
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  // Apply platform filter
  if (filters.platform) {
    query = query.eq('platform', filters.platform)
  }

  // Apply search filter
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  // Apply pagination
  if (filters.limit) {
    const offset = filters.offset || 0
    query = query.range(offset, offset + filters.limit - 1)
  }

  const { data, error } = await query
  if (error) throw dbError(error)
  return data ?? []
}

export const getAffiliateById = async (id) => {
  const { data, error } = await supabase
    .from('affiliates_v2')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw dbError(error)
  return data
}

export const addAffiliate = async (affData) => {
  const payload = {
    name: affData.name.trim(),
    platform: affData.platform?.trim() || null,
    url: affData.url.trim(),
    description: affData.description?.trim() || null,
    image: affData.image || null,
    status: affData.status || 'active',
    clicks: 0,
  }

  const { data, error } = await supabase
    .from('affiliates_v2')
    .insert(payload)
    .select()
    .single()
  if (error) throw dbError(error)
  return data
}

export const updateAffiliate = async (id, affData) => {
  const updates = {
    ...(affData.name && { name: affData.name.trim() }),
    ...(affData.platform !== undefined && { platform: affData.platform?.trim() || null }),
    ...(affData.url && { url: affData.url.trim() }),
    ...(affData.description !== undefined && { description: affData.description?.trim() || null }),
    ...(affData.image !== undefined && { image: affData.image || null }),
    ...(affData.status && { status: affData.status }),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('affiliates_v2')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw dbError(error)
  return data
}

export const deleteAffiliate = async (id) => {
  const { error } = await supabase
    .from('affiliates_v2')
    .delete()
    .eq('id', id)
  if (error) throw dbError(error)
}

export const incrementAffiliateClicks = async (id) => {
  const { error } = await supabase
    .rpc('increment_affiliate_clicks', { aff_id: id })
  if (error) {
    console.error('[NV] Error incrementing affiliate clicks:', error.message)
    return false
  }
  return true
}

// ============================================================
// STORAGE - Image Upload
// ============================================================

export const uploadNewsImage = async (file, fileName) => {
  if (!file || !fileName) throw new Error('File and fileName are required')

  const timestamp = Date.now()
  const uniqueName = `${timestamp}_${fileName}`
  
  const { data, error } = await supabase.storage
    .from('news-images')
    .upload(uniqueName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw dbError(error)
  return uniqueName
}

export const uploadAffiliateImage = async (file, fileName) => {
  if (!file || !fileName) throw new Error('File and fileName are required')

  const timestamp = Date.now()
  const uniqueName = `${timestamp}_${fileName}`

  const { data, error } = await supabase.storage
    .from('affiliate-images')
    .upload(uniqueName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw dbError(error)
  return uniqueName
}

export const getNewsImageUrl = (fileName) => {
  const { data } = supabase.storage
    .from('news-images')
    .getPublicUrl(fileName)
  return data?.publicUrl || null
}

export const getAffiliateImageUrl = (fileName) => {
  const { data } = supabase.storage
    .from('affiliate-images')
    .getPublicUrl(fileName)
  return data?.publicUrl || null
}

export const deleteNewsImage = async (fileName) => {
  const { error } = await supabase.storage
    .from('news-images')
    .remove([fileName])
  if (error) throw dbError(error)
}

export const deleteAffiliateImage = async (fileName) => {
  const { error } = await supabase.storage
    .from('affiliate-images')
    .remove([fileName])
  if (error) throw dbError(error)
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export const getDashboardStats = async () => {
  try {
    const [
      jobsCount,
      newsCount,
      affiliatesCount,
      usersCount,
    ] = await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }),
      supabase.from('news_v2').select('*', { count: 'exact', head: true }),
      supabase.from('affiliates_v2').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ])

    return {
      totalJobs: jobsCount.count || 0,
      totalNews: newsCount.count || 0,
      totalAffiliates: affiliatesCount.count || 0,
      totalUsers: usersCount.count || 0,
    }
  } catch (error) {
    console.error('[NV] Error fetching dashboard stats:', error.message)
    return {
      totalJobs: 0,
      totalNews: 0,
      totalAffiliates: 0,
      totalUsers: 0,
    }
  }
}
