import { useState } from 'react'
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
import LiveUpdatesToolbar from './live-updates/LiveUpdatesToolbar'
import LiveUpdatesTable from './live-updates/LiveUpdatesTable'
import { X, Plus, Edit2 } from 'lucide-react'

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

  // QUERIES & MUTATIONS
  const { data: updates = [], isLoading } = useQuery({
    queryKey: ['live_updates_admin'],
    queryFn: fetchAllLiveUpdatesAdmin,
    refetchInterval: 30000
  })

  const addMutation = useMutation({
    mutationFn: addLiveUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_updates_admin'] })
      toast('✅ Live update added successfully', 'success')
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
      toast('✅ Live update modified successfully', 'success')
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
      toast('✅ Live update deleted successfully', 'success')
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

  // HANDLERS
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

  // FILTERING
  const filteredUpdates = updates.filter((update) => {
    let typeMatch = filterType === 'all' || update.type === filterType
    let statusMatch = filterStatus === 'all' || update.is_active === (filterStatus === 'active')
    return typeMatch && statusMatch
  })

  // UTILITIES
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

  return (
    <div className="space-y-6">
      {/* Toolbar with Title, CTAs, Filter dropdowns & Stat count */}
      <LiveUpdatesToolbar
        filterType={filterType}
        filterStatus={filterStatus}
        onFilterTypeChange={setFilterType}
        onFilterStatusChange={setFilterStatus}
        onAddClick={() => handleOpenModal()}
        count={filteredUpdates.length}
      />

      {/* Workspace Table / Cards / Empty State */}
      <LiveUpdatesTable
        updates={filteredUpdates}
        isLoading={isLoading}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
        onToggleStatus={handleToggle}
        onAddClick={() => handleOpenModal()}
        getTypeIcon={getTypeIcon}
        getTypeLabel={getTypeLabel}
        getPriorityStyles={getPriorityStyles}
        getExpiryStatus={getExpiryStatus}
      />

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                {editingId ? <Edit2 className="text-blue-500" size={18} /> : <Plus className="text-orange-500" size={18} />}
                <span>{editingId ? 'Edit Live Update' : 'Add New Live Update'}</span>
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Title */}
              <div className="space-y-1">
                <label className="font-bold text-[var(--text-primary)]">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="E.g., Senior Developer wanted at TechCorp"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Link */}
              <div className="space-y-1">
                <label className="font-bold text-[var(--text-primary)]">Link (Optional)</label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://example.com/job"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Type & Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-primary)]">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500"
                  >
                    <option value="job">🧾 Job</option>
                    <option value="exam">🎓 Exam</option>
                    <option value="deadline">⏰ Deadline</option>
                    <option value="news">📰 News</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-primary)]">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="font-bold text-[var(--text-primary)]">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-500"
                />
                <div className="text-[10px] text-[var(--text-muted)]">Leave empty for no expiry</div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
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
