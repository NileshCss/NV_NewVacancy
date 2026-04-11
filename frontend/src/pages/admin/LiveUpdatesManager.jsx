/**
 * LiveUpdatesManager.jsx
 * Admin component for managing live updates
 * Features: CRUD operations, filtering, status toggle, expiry management
 * Last Updated: April 1, 2026
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../context/ToastContext'
import {
  fetchAllLiveUpdatesAdmin,
  addLiveUpdate,
  updateLiveUpdate,
  toggleLiveUpdateStatus,
  deleteLiveUpdate,
  getTypeLabel,
  getPriorityStyles
} from '../../services/liveUpdateService'

const LiveUpdatesManager = () => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [formData, setFormData] = useState({
    title: '',
    link: '',
    type: 'job',
    priority: 'normal',
    expiry_date: ''
  })

  // ============================================================================
  // QUERIES & MUTATIONS
  // ============================================================================

  const { data: updates = [], isLoading } = useQuery({
    queryKey: ['live_updates_admin'],
    queryFn: fetchAllLiveUpdatesAdmin,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const addMutation = useMutation({
    mutationFn: addLiveUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_updates_admin'] })
      toast('✅ Update added successfully', 'success')
      resetForm()
      setShowModal(false)
    },
    onError: (error) => {
      toast(`❌ ${error.message}`, 'error')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateLiveUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_updates_admin'] })
      toast('✅ Update modified successfully', 'success')
      resetForm()
      setShowModal(false)
    },
    onError: (error) => {
      toast(`❌ ${error.message}`, 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLiveUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_updates_admin'] })
      toast('✅ Update deleted successfully', 'success')
    },
    onError: (error) => {
      toast(`❌ ${error.message}`, 'error')
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) => toggleLiveUpdateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_updates_admin'] })
      toast('✅ Status updated', 'success')
    },
    onError: (error) => {
      toast(`❌ ${error.message}`, 'error')
    }
  })

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetForm = () => {
    setFormData({
      title: '',
      link: '',
      type: 'job',
      priority: 'normal',
      expiry_date: ''
    })
    setEditingId(null)
  }

  const handleOpenModal = (update = null) => {
    if (update) {
      setFormData({
        title: update.title,
        link: update.link || '',
        type: update.type,
        priority: update.priority,
        expiry_date: update.expiry_date ? update.expiry_date.split('T')[0] : ''
      })
      setEditingId(update.id)
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast('❌ Title is required', 'error')
      return
    }

    const submitData = {
      ...formData,
      title: formData.title.trim(),
      link: formData.link.trim() || null,
      expiry_date: formData.expiry_date || null
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: submitData })
    } else {
      addMutation.mutate(submitData)
    }
  }

  const handleToggle = (id, currentStatus) => {
    toggleMutation.mutate({ id, status: !currentStatus })
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this update?')) {
      deleteMutation.mutate(id)
    }
  }

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredUpdates = updates.filter((update) => {
    let typeMatch = filterType === 'all' || update.type === filterType
    let statusMatch = filterStatus === 'all' || update.is_active === (filterStatus === 'active')
    return typeMatch && statusMatch
  })

  // ============================================================================
  // UTILITIES
  // ============================================================================

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return { text: 'Never', color: '#10b981' }
    const expiry = new Date(expiryDate)
    const now = new Date()
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))

    if (daysLeft < 0) return { text: 'Expired', color: '#ef4444' }
    if (daysLeft === 0) return { text: 'Expires today', color: '#f59e0b' }
    if (daysLeft === 1) return { text: '1 day left', color: '#f59e0b' }
    if (daysLeft <= 7) return { text: `${daysLeft} days left`, color: '#f59e0b' }
    return { text: `${daysLeft} days left`, color: '#10b981' }
  }

  const getTypeIcon = (type) => {
    const icons = { job: '🧾', exam: '🎓', deadline: '⏰', news: '📰' }
    return icons[type] || '📢'
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>📢 Live Updates</h2>
        <button
          onClick={() => handleOpenModal()}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
        >
          + Add Update
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '0.5rem 0.8rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.4rem',
            fontSize: '0.9rem'
          }}
        >
          <option value="all">All Types</option>
          <option value="job">Job</option>
          <option value="exam">Exam</option>
          <option value="deadline">Deadline</option>
          <option value="news">News</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '0.5rem 0.8rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.4rem',
            fontSize: '0.9rem'
          }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div style={{ fontSize: '0.9rem', color: '#6b7280', paddingTop: '0.5rem' }}>
          {filteredUpdates.length} update{filteredUpdates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          Loading updates...
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Title</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Priority</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Expiry</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUpdates.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                    No updates found
                  </td>
                </tr>
              ) : (
                filteredUpdates.map((update) => (
                  <tr key={update.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {/* Title */}
                    <td style={{ padding: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>{update.title}</div>
                        {update.link && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: '#3b82f6',
                              wordBreak: 'break-all',
                              marginTop: '0.25rem'
                            }}
                          >
                            {update.link}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>
                        {getTypeIcon(update.type)}
                      </span>
                      {getTypeLabel(update.type)}
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          ...getPriorityStyles(update.priority),
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.8rem'
                        }}
                      >
                        {update.priority === 'urgent' ? '🔴 Urgent' : 'Normal'}
                      </span>
                    </td>

                    {/* Expiry */}
                    <td style={{ padding: '1rem' }}>
                      {(() => {
                        const status = getExpiryStatus(update.expiry_date)
                        return (
                          <div
                            style={{
                              color: status.color,
                              fontSize: '0.85rem',
                              fontWeight: '500'
                            }}
                          >
                            {status.text}
                          </div>
                        )
                      })()}
                    </td>

                    {/* Status Toggle */}
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleToggle(update.id, update.is_active)}
                        style={{
                          background: update.is_active
                            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                            : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                          color: '#fff',
                          border: 'none',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '0.4rem',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {update.is_active ? '✓ Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button
                        onClick={() => handleOpenModal(update)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          marginRight: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(update.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
              {editingId ? '✏️ Edit Update' : '➕ Add New Update'}
            </h3>

            <form onSubmit={handleSubmit}>
              {/* Title */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="E.g., Senior Developer wanted at TechCorp"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.4rem',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Link */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Link (Optional)
                </label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://example.com/job"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.4rem',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Type */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.4rem',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="job">🧾 Job</option>
                  <option value="exam">🎓 Exam</option>
                  <option value="deadline">⏰ Deadline</option>
                  <option value="news">📰 News</option>
                </select>
              </div>

              {/* Priority */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.4rem',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">🔴 Urgent</option>
                </select>
              </div>

              {/* Expiry Date */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.4rem',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Leave empty for no expiry
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '0.6rem 1.2rem',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#fff',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending || updateMutation.isPending}
                  style={{
                    padding: '0.6rem 1.2rem',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    opacity: addMutation.isPending || updateMutation.isPending ? 0.7 : 1
                  }}
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveUpdatesManager
