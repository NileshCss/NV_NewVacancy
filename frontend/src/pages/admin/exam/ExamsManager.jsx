import React, { useState, useEffect } from 'react'
import { fetchExams, fetchExamCategories, createExam, updateExam, deleteExam } from '../../../services/api'
import { Edit2, Trash2, Plus, Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ExamsManager() {
  const [exams, setExams] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)
  
  const [formData, setFormData] = useState({ 
    category_id: '', name: '', slug: '', description: '', eligibility: '', age_limit: '', 
    selection_process: '', status: 'draft', logo_url: '' 
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [exData, catData] = await Promise.all([ fetchExams(), fetchExamCategories() ])
      setExams(exData)
      setCategories(catData)
    } catch (err) {
      toast.error('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleOpenModal = (exam = null) => {
    setEditingExam(exam)
    if (exam) {
      setFormData({ 
        category_id: exam.category_id, name: exam.name, slug: exam.slug, 
        description: exam.description || '', eligibility: exam.eligibility || '', 
        age_limit: exam.age_limit || '', selection_process: exam.selection_process || '',
        status: exam.status, logo_url: exam.logo_url || ''
      })
    } else {
      setFormData({ 
        category_id: categories[0]?.id || '', name: '', slug: '', description: '', 
        eligibility: '', age_limit: '', selection_process: '', status: 'draft', logo_url: '' 
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingExam(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.slug || !formData.category_id) return toast.error('Required fields missing')
    setIsSubmitting(true)
    try {
      if (editingExam) {
        await updateExam(editingExam.id, formData)
        toast.success('Exam updated')
      } else {
        await createExam(formData)
        toast.success('Exam created')
      }
      loadData()
      handleCloseModal()
    } catch (err) {
      toast.error(err.message || 'Error saving exam')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this exam? All subjects and topics will be deleted.')) return
    try {
      await deleteExam(id)
      toast.success('Exam deleted')
      loadData()
    } catch (err) {
      toast.error('Failed to delete exam')
    }
  }

  const toggleStatus = async (exam) => {
    const newStatus = exam.status === 'published' ? 'draft' : 'published'
    try {
      await updateExam(exam.id, { status: newStatus })
      toast.success(`Exam ${newStatus}`)
      loadData()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Exams</h2>
          <p className="text-sm text-[var(--text-muted)]">Manage exams and their details.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={18} /> New Exam
        </button>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No exams found.</td></tr>
            ) : (
              exams.map(ex => (
                <tr key={ex.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors">
                  <td className="p-4 font-medium text-[var(--text-primary)]">
                    <div>{ex.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{ex.slug}</div>
                  </td>
                  <td className="p-4 text-sm text-[var(--text-secondary)]">{ex.exam_categories?.name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ex.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {ex.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 flex gap-3 items-center">
                    <button onClick={() => toggleStatus(ex)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" title="Toggle Publish">
                      {ex.status === 'published' ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={() => handleOpenModal(ex)} className="text-blue-500 hover:text-blue-600" title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(ex.id)} className="text-red-500 hover:text-red-600" title="Delete">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={handleCloseModal}>
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-2xl shadow-2xl border border-[var(--border)] my-8" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{editingExam ? 'Edit Exam' : 'New Exam'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Name</label>
                  <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                         value={formData.name} onChange={e => {
                           const name = e.target.value
                           setFormData({ ...formData, name, slug: !editingExam ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : formData.slug })
                         }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Slug</label>
                  <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                         value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Category</label>
                  <select required className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]"
                          value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                    <option value="">Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Status</label>
                  <select className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]"
                          value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
                <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                          value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Eligibility</label>
                <textarea rows={2} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                          value={formData.eligibility} onChange={e => setFormData({ ...formData, eligibility: e.target.value })} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Selection Process</label>
                <textarea rows={2} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                          value={formData.selection_process} onChange={e => setFormData({ ...formData, selection_process: e.target.value })} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)] mt-6">
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
