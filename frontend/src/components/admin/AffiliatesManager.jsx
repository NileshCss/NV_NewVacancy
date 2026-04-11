import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../context/ToastContext'
import {
  fetchAffiliates,
  getAffiliateById,
  addAffiliate,
  updateAffiliate,
  deleteAffiliate,
  uploadAffiliateImage,
  getAffiliateImageUrl,
  deleteAffiliateImage,
} from '../../services/newsAffiliateService'

const AFF_DEFAULTS = {
  name: '',
  platform: '',
  url: '',
  description: '',
  image: '',
  status: 'active',
}

const INPUT_STYLE = {
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  fontFamily: 'inherit',
}

const BUTTON_STYLE = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
}

const Spinner = () => (
  <span style={{
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin .7s linear infinite',
    display: 'inline-block',
  }} />
)

export default function AffiliatesManager() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // Local state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(AFF_DEFAULTS)
  const [filters, setFilters] = useState({ search: '', status: '', platform: '' })
  const [uploadingImage, setUploadingImage] = useState(false)

  // Queries
  const { data: affiliates = [], isLoading: isLoadingAffiliates } = useQuery({
    queryKey: ['admin_affiliates', filters],
    queryFn: () => fetchAffiliates(filters),
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (data) => editId ? updateAffiliate(editId, data) : addAffiliate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_affiliates'] })
      toast(editId ? 'Affiliate updated! ✅' : 'Affiliate added! ✅', 'success')
      closeModal()
    },
    onError: (err) => toast(err.message || 'Failed to save affiliate', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAffiliate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_affiliates'] })
      toast('Affiliate deleted ✅', 'success')
    },
    onError: (err) => toast(err.message, 'error'),
  })

  // Handlers
  const openAdd = () => {
    setEditId(null)
    setForm(AFF_DEFAULTS)
    setShowModal(true)
  }

  const openEdit = async (id) => {
    try {
      const affiliate = await getAffiliateById(id)
      setEditId(id)
      setForm(affiliate)
      setShowModal(true)
    } catch (err) {
      toast('Failed to load affiliate', 'error')
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditId(null)
    setForm(AFF_DEFAULTS)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be less than 5MB', 'error')
      return
    }

    setUploadingImage(true)
    try {
      const fileName = await uploadAffiliateImage(file, file.name)
      const imageUrl = getAffiliateImageUrl(fileName)
      setForm({ ...form, image: imageUrl })
      toast('Image uploaded! ✅', 'success')
    } catch (err) {
      toast(err.message || 'Failed to upload image', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = (e) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast('Affiliate name is required', 'error')
      return
    }

    if (!form.url.trim()) {
      toast('URL is required', 'error')
      return
    }

    // Validate URL
    try {
      const u = new URL(form.url.trim())
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
    } catch {
      toast('URL must start with http:// or https://', 'error')
      return
    }

    saveMutation.mutate({
      name: form.name.trim(),
      platform: form.platform.trim() || null,
      url: form.url.trim(),
      description: form.description.trim(),
      image: form.image,
      status: form.status,
    })
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this affiliate?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>🤝 Affiliates Management</h2>
        <button style={BUTTON_STYLE} onClick={openAdd}>+ Add Affiliate</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by name..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={INPUT_STYLE}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={INPUT_STYLE}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={filters.platform}
          onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
          style={INPUT_STYLE}
        >
          <option value="">All Platforms</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Udemy">Udemy</option>
          <option value="Coursera">Coursera</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Affiliates Table */}
      {isLoadingAffiliates ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner /> Loading affiliates...
        </div>
      ) : affiliates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No affiliates found. Create one to get started! 🎯
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Platform</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Clicks</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map((aff) => (
                <tr
                  key={aff.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    '&:hover': { backgroundColor: 'var(--bg-secondary)' },
                  }}
                >
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: '500' }}>
                      {aff.image && (
                        <img
                          src={aff.image}
                          alt={aff.name}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '4px',
                            marginRight: '8px',
                            verticalAlign: 'middle',
                          }}
                        />
                      )}
                      {aff.name}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>{aff.platform || '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor:
                          aff.status === 'active' ? 'rgba(34, 197, 94, 0.2)' :
                          aff.status === 'pending' ? 'rgba(251, 146, 60, 0.2)' :
                          'rgba(107, 114, 128, 0.2)',
                        color:
                          aff.status === 'active' ? '#22c55e' :
                          aff.status === 'pending' ? '#fb923c' :
                          '#6b7280',
                      }}
                    >
                      {aff.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>
                    {aff.clicks || 0} 📊
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => openEdit(aff.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        marginRight: '12px',
                        fontSize: '14px',
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(aff.id)}
                      disabled={deleteMutation.isPending}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      {deleteMutation.isPending ? <Spinner /> : '🗑️'}
                    </button>
                  </td>
                </tr>
              ))}
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
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '8px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, fontSize: '20px', fontWeight: '600' }}>
              {editId ? '✏️ Edit Affiliate' : '🤝 Add New Affiliate'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Affiliate Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={INPUT_STYLE}
                  placeholder="e.g., Udemy"
                />
              </div>

              {/* Platform */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Platform
                </label>
                <input
                  type="text"
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  style={INPUT_STYLE}
                  placeholder="e.g., LinkedIn, Udemy, Coursera"
                />
              </div>

              {/* URL */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  URL *
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  style={INPUT_STYLE}
                  placeholder="https://example.com/ref"
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ ...INPUT_STYLE, height: '80px', fontFamily: 'inherit' }}
                  placeholder="Brief description about this affiliate link"
                />
              </div>

              {/* Image */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Logo/Image
                </label>
                {form.image && (
                  <div style={{ marginBottom: '12px' }}>
                    <img
                      src={form.image}
                      alt="Logo"
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  style={INPUT_STYLE}
                />
                {uploadingImage && <span style={{ marginLeft: '8px' }}>⏳ Uploading...</span>}
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={INPUT_STYLE}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending Review</option>
                </select>
              </div>

              {/*Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    ...BUTTON_STYLE,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  style={{
                    ...BUTTON_STYLE,
                    opacity: saveMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {saveMutation.isPending ? <Spinner /> : (editId ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
