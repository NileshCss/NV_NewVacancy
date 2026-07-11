import React, { useState, useEffect } from 'react'
import { fetchExamCategories, createExamCategory, updateExamCategory, deleteExamCategory } from '../../../services/api'
import { Edit2, Trash2, Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ExamCategoriesManager() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  
  const [formData, setFormData] = useState({ name: '', slug: '', icon: '', display_order: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await fetchExamCategories()
      setCategories(data)
    } catch (err) {
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleOpenModal = (cat = null) => {
    setEditingCat(cat)
    if (cat) {
      setFormData({ name: cat.name, slug: cat.slug, icon: cat.icon || '', display_order: cat.display_order || 0 })
    } else {
      setFormData({ name: '', slug: '', icon: '', display_order: categories.length })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCat(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.slug) return toast.error('Name and slug required')
    setIsSubmitting(true)
    try {
      if (editingCat) {
        await updateExamCategory(editingCat.id, formData)
        toast.success('Category updated')
      } else {
        await createExamCategory(formData)
        toast.success('Category created')
      }
      loadData()
      handleCloseModal()
    } catch (err) {
      toast.error(err.message || 'Error saving category')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this category? All nested exams will be deleted.')) return
    try {
      await deleteExamCategory(id)
      toast.success('Category deleted')
      loadData()
    } catch (err) {
      toast.error('Failed to delete category')
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Exam Categories</h2>
          <p className="text-sm text-[var(--text-muted)]">Manage top-level exam categories (e.g. UPSC, SSC, Banking)</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={18} /> New Category
        </button>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
              <th className="p-4 font-semibold">Order</th>
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Slug</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No categories found.</td></tr>
            ) : (
              categories.map(cat => (
                <tr key={cat.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors">
                  <td className="p-4 text-sm font-medium">{cat.display_order}</td>
                  <td className="p-4 font-medium text-[var(--text-primary)] flex items-center gap-2">
                    {cat.icon && <span className="text-xl">{cat.icon}</span>}
                    {cat.name}
                  </td>
                  <td className="p-4 text-sm text-[var(--text-secondary)]">{cat.slug}</td>
                  <td className="p-4 flex gap-3">
                    <button onClick={() => handleOpenModal(cat)} className="text-blue-500 hover:text-blue-600" title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(cat.id)} className="text-red-500 hover:text-red-600" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal}>
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-md shadow-2xl border border-[var(--border)]" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{editingCat ? 'Edit Category' : 'New Category'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Name</label>
                <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]" 
                       value={formData.name} onChange={e => {
                         const name = e.target.value
                         setFormData({ ...formData, name, slug: !editingCat ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : formData.slug })
                       }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Slug</label>
                <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]" 
                       value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Icon (Emoji)</label>
                  <input type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]" 
                         value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Display Order</label>
                  <input type="number" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]" 
                         value={formData.display_order} onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value)||0 })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:bg-[var(--border)] transition">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition flex items-center justify-center min-w-[100px]">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
