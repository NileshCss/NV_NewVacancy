/**
 * liveUpdateService.js
 * API service for managing live updates
 * Features: CRUD operations, filtering, real-time subscriptions
 * Last Updated: April 1, 2026
 */

import { supabase } from './supabase.js'

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Fetch all active, non-expired live updates
 * @returns {Promise<Array>} Array of live updates
 */
export const fetchLiveUpdates = async () => {
  try {
    const now = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('live_updates')
      .select('*')
      .eq('is_active', true)
      .or(`expiry_date.is.null,expiry_date.gt.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching live updates:', error)
    throw new Error(`Failed to fetch live updates: ${error.message}`)
  }
}

/**
 * Fetch all live updates (admin - includes inactive/expired)
 * @returns {Promise<Array>} All live updates
 */
export const fetchAllLiveUpdatesAdmin = async () => {
  try {
    const { data, error } = await supabase
      .from('live_updates')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching all live updates:', error)
    throw new Error(`Failed to fetch live updates: ${error.message}`)
  }
}

/**
 * Fetch single live update by ID
 * @param {string} id - Update ID
 * @returns {Promise<Object>} Single live update
 */
export const fetchLiveUpdateById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('live_updates')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching live update:', error)
    throw new Error(`Failed to fetch live update: ${error.message}`)
  }
}

/**
 * Fetch live updates by type
 * @param {string} type - 'job' | 'exam' | 'deadline' | 'news'
 * @returns {Promise<Array>} Updates of specified type
 */
export const fetchLiveUpdatesByType = async (type) => {
  try {
    const now = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('live_updates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .or(`expiry_date.is.null,expiry_date.gt.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching live updates by type:', error)
    throw new Error(`Failed to fetch live updates by type: ${error.message}`)
  }
}

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

/**
 * Add new live update
 * @param {Object} data - { title, link, type, priority, expiry_date }
 * @returns {Promise<Object>} Created update
 */
export const addLiveUpdate = async (data) => {
  try {
    const { title, link, type, priority = 'normal', expiry_date } = data
    
    // Validation
    if (!title || !type) {
      throw new Error('Title and Type are required')
    }
    
    const validTypes = ['job', 'exam', 'deadline', 'news']
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`)
    }
    
    const validPriorities = ['normal', 'urgent']
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`)
    }
    
    const { data: newUpdate, error } = await supabase
      .from('live_updates')
      .insert([
        {
          title: title.trim(),
          link: link ? link.trim() : null,
          type,
          priority,
          expiry_date: expiry_date || null,
          is_active: true,
        }
      ])
      .select()
      .single()
    
    if (error) throw error
    
    console.log('Live update created:', newUpdate.id)
    return newUpdate
  } catch (error) {
    console.error('Error adding live update:', error)
    throw new Error(`Failed to add live update: ${error.message}`)
  }
}

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

/**
 * Update live update
 * @param {string} id - Update ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated update
 */
export const updateLiveUpdate = async (id, updates) => {
  try {
    if (!id) {
      throw new Error('Update ID is required')
    }
    
    const { data: updatedUpdate, error } = await supabase
      .from('live_updates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    console.log('Live update updated:', id)
    return updatedUpdate
  } catch (error) {
    console.error('Error updating live update:', error)
    throw new Error(`Failed to update live update: ${error.message}`)
  }
}

/**
 * Toggle live update active status
 * @param {string} id - Update ID
 * @param {boolean} isActive - New active status
 * @returns {Promise<Object>} Updated update
 */
export const toggleLiveUpdateStatus = async (id, isActive) => {
  try {
    return await updateLiveUpdate(id, { is_active: isActive })
  } catch (error) {
    console.error('Error toggling live update status:', error)
    throw new Error(`Failed to toggle live update: ${error.message}`)
  }
}

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

/**
 * Delete live update
 * @param {string} id - Update ID
 * @returns {Promise<void>}
 */
export const deleteLiveUpdate = async (id) => {
  try {
    if (!id) {
      throw new Error('Update ID is required')
    }
    
    const { error } = await supabase
      .from('live_updates')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    console.log('Live update deleted:', id)
  } catch (error) {
    console.error('Error deleting live update:', error)
    throw new Error(`Failed to delete live update: ${error.message}`)
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTION
// ============================================================================

/**
 * Subscribe to real-time updates on live_updates table
 * @param {Function} onUpdate - Callback when data changes
 * @returns {Function} Unsubscribe function
 */
export const subscribeLiveUpdates = (onUpdate) => {
  try {
    const channel = supabase
      .channel('live-updates-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'live_updates'
        },
        (payload) => {
          console.log('Real-time update received:', payload)
          onUpdate(payload)
        }
      )
      .subscribe()
    
    // Return unsubscribe function
    return () => {
      channel.unsubscribe()
    }
  } catch (error) {
    console.error('Error subscribing to live updates:', error)
    return () => {} // Return empty unsubscribe function
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Bulk update live updates status
 * @param {Array<string>} ids - Array of update IDs
 * @param {Object} updates - Updates to apply to all
 * @returns {Promise<Array>} Updated updates
 */
export const bulkUpdateLiveUpdates = async (ids, updates) => {
  try {
    if (!ids || ids.length === 0) {
      throw new Error('At least one ID is required')
    }
    
    const { data: updatedUpdates, error } = await supabase
      .from('live_updates')
      .update(updates)
      .in('id', ids)
      .select()
    
    if (error) throw error
    
    console.log(`Bulk updated ${updatedUpdates.length} live updates`)
    return updatedUpdates || []
  } catch (error) {
    console.error('Error bulk updating live updates:', error)
    throw new Error(`Failed to bulk update live updates: ${error.message}`)
  }
}

/**
 * Delete expired updates
 * @returns {Promise<number>} Number of deleted updates
 */
export const deleteExpiredUpdates = async () => {
  try {
    const now = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('live_updates')
      .delete()
      .neq('expiry_date', null)
      .lt('expiry_date', now)
      .select()
    
    if (error) throw error
    
    const deletedCount = data ? data.length : 0
    console.log(`Deleted ${deletedCount} expired live updates`)
    return deletedCount
  } catch (error) {
    console.error('Error deleting expired updates:', error)
    throw new Error(`Failed to delete expired updates: ${error.message}`)
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if update is expired
 * @param {Object} update - Live update object
 * @returns {boolean} True if expired
 */
export const isUpdateExpired = (update) => {
  if (!update.expiry_date) return false
  return new Date(update.expiry_date) < new Date()
}

/**
 * Format update for display
 * @param {Object} update - Live update object
 * @returns {Object} Formatted update with icon and styling
 */
export const formatUpdateForDisplay = (update) => {
  const icons = {
    job: '🧾',
    exam: '🎓',
    deadline: '⏰',
    news: '📰'
  }
  
  return {
    ...update,
    icon: icons[update.type] || '📢',
    isUrgent: update.priority === 'urgent',
    isExpired: isUpdateExpired(update)
  }
}

/**
 * Get styling based on priority
 * @param {string} priority - 'normal' | 'urgent'
 * @returns {Object} Styling object
 */
export const getPriorityStyles = (priority) => {
  if (priority === 'urgent') {
    return {
      backgroundColor: '#ef4444',
      color: '#fff',
      fontWeight: 'bold'
    }
  }
  return {
    backgroundColor: '#3b82f6',
    color: '#fff',
    fontWeight: '500'
  }
}

/**
 * Get type label
 * @param {string} type - Update type
 * @returns {string} Formatted type label
 */
export const getTypeLabel = (type) => {
  const labels = {
    job: 'Job',
    exam: 'Exam',
    deadline: 'Deadline',
    news: 'News'
  }
  return labels[type] || type
}

export default {
  fetchLiveUpdates,
  fetchAllLiveUpdatesAdmin,
  fetchLiveUpdateById,
  fetchLiveUpdatesByType,
  addLiveUpdate,
  updateLiveUpdate,
  toggleLiveUpdateStatus,
  deleteLiveUpdate,
  subscribeLiveUpdates,
  bulkUpdateLiveUpdates,
  deleteExpiredUpdates,
  isUpdateExpired,
  formatUpdateForDisplay,
  getPriorityStyles,
  getTypeLabel
}
