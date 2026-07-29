import React, { useState, useEffect, useMemo } from 'react'
import { fetchExams, fetchExamCategories, createExam, updateExam, deleteExam } from '../../../services/api'
import { Loader2, Plus, Edit2, X } from 'lucide-react'
import toast from 'react-hot-toast'

import ExamsToolbar from './ExamsToolbar'
import ExamTable from './ExamTable'
import ExamCardMobile from './ExamCardMobile'

export default function ExamsManager() {
  const [exams, setExams] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)

  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus]     = useState('all')
  const [searchQuery, setSearchQuery]       = useState('')

  const [formData, setFormData] = useState({
    category_id: '', name: '', slug: '', description: '', eligibility: '', age_limit: '',
    selection_process: '', status: 'draft', logo_url: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [exData, catData] = await Promise.all([ fetchExams(), fetchExamCategories() ])
      setExams(exData || [])
      setCategories(catData || [])
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

  // Filtered Exams list
  const filteredExams = useMemo(() => {
    return exams.filter((ex) => {
      if (filterCategory !== 'all' && ex.category_id !== filterCategory) return false
      if (filterStatus !== 'all' && ex.status !== filterStatus) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchName = ex.name?.toLowerCase().includes(q)
        const matchSlug = ex.slug?.toLowerCase().includes(q)
        if (!matchName && !matchSlug) return false
      }
      return true
    })
  }, [exams, filterCategory, filterStatus, searchQuery])

  return (
    <div className="space-y-6 min-w-0">
      {/* Header, Search & Filter Toolbar */}
      <ExamsToolbar
        categories={categories}
        filterCategory={filterCategory}
        filterStatus={filterStatus}
        searchQuery={searchQuery}
        onCategoryChange={setFilterCategory}
        onStatusChange={setFilterStatus}
        onSearchChange={setSearchQuery}
        onAddClick={() => handleOpenModal()}
        count={filteredExams.length}
      />

      {/* Desktop & Tablet Table */}
      <div className="hidden md:block">
        <ExamTable
          exams={filteredExams}
          loading={loading}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
          onToggleStatus={toggleStatus}
          onAddClick={() => handleOpenModal()}
        />
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center text-xs text-[var(--text-muted)] font-medium">
            Loading exams...
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-10 text-center text-xs text-[var(--text-muted)] font-medium">
            No exams found.
          </div>
        ) : (
          filteredExams.map((ex) => (
            <ExamCardMobile
              key={ex.id}
              exam={ex}
              onEdit={handleOpenModal}
              onDelete={handleDelete}
              onToggleStatus={toggleStatus}
            />
          ))
        )}
      </div>

      {/* Create / Edit Exam Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto" onClick={handleCloseModal}>
          <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-2xl shadow-2xl border border-[var(--border)] my-8 overflow-hidden space-y-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                {editingExam ? <Edit2 className="text-blue-500" size={18} /> : <Plus className="text-orange-500" size={18} />}
                <span>{editingExam ? 'Edit Exam' : 'New Exam'}</span>
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-primary)]">Name *</label>
                  <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-500"
                         value={formData.name} onChange={e => {
                           const name = e.target.value
                           setFormData({ ...formData, name, slug: !editingExam ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : formData.slug })
                         }} />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-primary)]">Slug *</label>
                  <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-500"
                         value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-primary)]">Category *</label>
                  <select required className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500"
                          value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                    <option value="">Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[var(--text-primary)]">Status</label>
                  <select className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-orange-500"
                          value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[var(--text-primary)]">Description</label>
                <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-500"
                          value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[var(--text-primary)]">Eligibility</label>
                <textarea rows={2} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-500"
                          value={formData.eligibility} onChange={e => setFormData({ ...formData, eligibility: e.target.value })} />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[var(--text-primary)]">Selection Process</label>
                <textarea rows={2} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-orange-500"
                          value={formData.selection_process} onChange={e => setFormData({ ...formData, selection_process: e.target.value })} />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] mt-4">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border)] hover:text-[var(--text-primary)] transition">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition flex items-center justify-center shadow-xs min-w-[90px]">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
