import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../context/ToastContext'
import {
  fetchNews,
  getNewsById,
  addNews,
  updateNews,
  deleteNews,
  uploadNewsImage,
  getNewsImageUrl,
  deleteNewsImage,
} from '../../services/newsAffiliateService'

const NEWS_DEFAULTS = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  cover_image: '',
  category: 'general',
  tags: [],
  status: 'draft',
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

export default function NewsManager() {
  const toast = useToast()
  const queryClient = useQueryClient()

  // Local state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(NEWS_DEFAULTS)
  const [filters, setFilters] = useState({ search: '', status: '', category: '' })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [tagInput, setTagInput] = useState('')

  // Queries
  const { data: newsList = [], isLoading: isLoadingNews } = useQuery({
    queryKey: ['admin_news', filters],
    queryFn: () => fetchNews(filters),
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (data) => editId ? updateNews(editId, data) : addNews(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_news'] })
      toast(editId ? 'Article updated! ✅' : 'Article added! ✅', 'success')
      closeModal()
    },
    onError: (err) => toast(err.message || 'Failed to save article', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_news'] })
      toast('Article deleted ✅', 'success')
    },
    onError: (err) => toast(err.message, 'error'),
  })

  // Handlers
  const openAdd = () => {
    setEditId(null)
    setForm(NEWS_DEFAULTS)
    setShowModal(true)
  }

  const openEdit = async (id) => {
    try {
      const article = await getNewsById(id)
      setEditId(id)
      setForm(article)
      setTagInput(article.tags?.join(', ') || '')
      setShowModal(true)
    } catch (err) {
      toast('Failed to load article', 'error')
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditId(null)
    setForm(NEWS_DEFAULTS)
    setTagInput('')
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
      const fileName = await uploadNewsImage(file, file.name)
      const imageUrl = getNewsImageUrl(fileName)
      setForm({ ...form, cover_image: imageUrl })
      toast('Image uploaded! ✅', 'success')
    } catch (err) {
      toast(err.message || 'Failed to upload image', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleAddTag = () => {
    if (!tagInput.trim()) return
    const newTag = tagInput.trim()
    if (!form.tags.includes(newTag)) {
      setForm({ ...form, tags: [...form.tags, newTag] })
      setTagInput('')
    } else {
      toast('Tag already added', 'error')
    }
  }

  const handleRemoveTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) })
  }

  const handleSave = (e) => {
    e.preventDefault()

    if (!form.title.trim()) {
      toast('Title is required', 'error')
      return
    }

    if (!form.content.trim()) {
      toast('Content is required', 'error')
      return
    }

    saveMutation.mutate({
      title: form.title.trim(),
      slug: form.slug.trim() || form.title.toLowerCase().replace(/\s+/g, '-'),
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      cover_image: form.cover_image,
      category: form.category,
      tags: form.tags,
      status: form.status,
    })
  }

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>📰 News Management</h2>
        <button style={BUTTON_STYLE} onClick={openAdd}>+ Add News Article</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by title or content..."
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
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          style={INPUT_STYLE}
        >
          <option value="">All Categories</option>
          <option value="tech">Tech</option>
          <option value="govt">Government</option>
          <option value="education">Education</option>
          <option value="general">General</option>
        </select>
      </div>

      {/* News Table */}
      {isLoadingNews ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner /> Loading articles...
        </div>
      ) : newsList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No articles found. Create one to get started! 📝
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
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Title</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Category</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newsList.map((article) => (
                <tr
                  key={article.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    '&:hover': { backgroundColor: 'var(--bg-secondary)' },
                  }}
                >
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: '500' }}>{article.title}</div>
                    {article.excerpt && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {article.excerpt.substring(0, 50)}...
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>{article.category || '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor:
                          article.status === 'published' ? 'rgba(34, 197, 94, 0.2)' :
                          article.status === 'draft' ? 'rgba(107, 114, 128, 0.2)' :
                          'rgba(239, 68, 68, 0.2)',
                        color:
                          article.status === 'published' ? '#22c55e' :
                          article.status === 'draft' ? '#6b7280' :
                          '#ef4444',
                      }}
                    >
                      {article.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(article.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => openEdit(article.id)}
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
                      onClick={() => handleDelete(article.id)}
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
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, fontSize: '20px', fontWeight: '600' }}>
              {editId ? '✏️ Edit Article' : '📝 Add New Article'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={INPUT_STYLE}
                  placeholder="Article title"
                />
              </div>

              {/* Slug */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Slug (auto-generated if empty)
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  style={INPUT_STYLE}
                  placeholder="article-slug"
                />
              </div>

              {/* Excerpt */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Excerpt
                </label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  style={{ ...INPUT_STYLE, height: '80px', fontFamily: 'inherit' }}
                  placeholder="Brief summary of the article"
                />
              </div>

              {/* Content */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Content *
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  style={{ ...INPUT_STYLE, height: '150px', fontFamily: 'inherit' }}
                  placeholder="Full article content (supports markdown)"
                />
              </div>

              {/* Cover Image */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Cover Image
                </label>
                {form.cover_image && (
                  <div style={{ marginBottom: '12px' }}>
                    <img
                      src={form.cover_image}
                      alt="Cover"
                      style={{
                        width: '100%',
                        maxHeight: '150px',
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

              {/* Category */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={INPUT_STYLE}
                >
                  <option value="tech">Tech</option>
                  <option value="govt">Government</option>
                  <option value="education">Education</option>
                  <option value="general">General</option>
                </select>
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                  Tags
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    style={INPUT_STYLE}
                    placeholder="Type and press Enter or click Add"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    style={{ ...BUTTON_STYLE, width: 'auto' }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--accent)',
                        color: '#fff',
                        borderRadius: '20px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          padding: '0',
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
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
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Actions */}
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
