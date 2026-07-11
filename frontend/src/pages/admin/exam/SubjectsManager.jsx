import React, { useState, useEffect } from 'react'
import { fetchExams, fetchSubjects, createSubject, updateSubject, deleteSubject, reorderSubjects } from '../../../services/api'
import { Edit2, Trash2, Plus, Loader2, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItem({ id, subject, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] border-b border-[var(--border)]">
      <div {...attributes} {...listeners} className="cursor-grab text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <GripVertical size={20} />
      </div>
      <div className="flex-1 font-medium text-[var(--text-primary)] flex items-center gap-2">
        {subject.icon && <span>{subject.icon}</span>}
        {subject.name}
      </div>
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded-full text-xs ${subject.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
          {subject.enabled ? 'Active' : 'Disabled'}
        </span>
        <button onClick={() => onEdit(subject)} className="text-blue-500 hover:text-blue-600 p-1"><Edit2 size={16} /></button>
        <button onClick={() => onDelete(subject.id)} className="text-red-500 hover:text-red-600 p-1"><Trash2 size={16} /></button>
      </div>
    </div>
  )
}

export default function SubjectsManager() {
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)
  
  const [formData, setFormData] = useState({ name: '', icon: '', enabled: true })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    fetchExams().then(data => {
      setExams(data)
      if (data.length > 0) setSelectedExamId(data[0].id)
      setLoading(false)
    }).catch(() => {
      toast.error('Failed to load exams')
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedExamId) return
    setLoading(true)
    fetchSubjects(selectedExamId).then(data => setSubjects(data)).catch(() => toast.error('Failed to load subjects')).finally(() => setLoading(false))
  }, [selectedExamId])

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = subjects.findIndex(s => s.id === active.id)
    const newIndex = subjects.findIndex(s => s.id === over.id)
    const newItems = arrayMove(subjects, oldIndex, newIndex)
    
    // Update local state immediately for smooth UI
    setSubjects(newItems)
    
    // Build payload for backend
    const payload = newItems.map((item, index) => ({ id: item.id, display_order: index }))
    try {
      await reorderSubjects(payload)
      toast.success('Order saved')
    } catch (err) {
      toast.error('Failed to save order')
      // Revert on error
      fetchSubjects(selectedExamId).then(setSubjects)
    }
  }

  const handleOpenModal = (sub = null) => {
    setEditingSubject(sub)
    if (sub) {
      setFormData({ name: sub.name, icon: sub.icon || '', enabled: sub.enabled })
    } else {
      setFormData({ name: '', icon: '', enabled: true })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) return toast.error('Name is required')
    setIsSubmitting(true)
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, formData)
        toast.success('Subject updated')
      } else {
        await createSubject({ ...formData, exam_id: selectedExamId, display_order: subjects.length })
        toast.success('Subject created')
      }
      const data = await fetchSubjects(selectedExamId)
      setSubjects(data)
      setIsModalOpen(false)
    } catch (err) {
      toast.error(err.message || 'Error saving subject')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure? All topics inside will be deleted.')) return
    try {
      await deleteSubject(id)
      toast.success('Subject deleted')
      setSubjects(await fetchSubjects(selectedExamId))
    } catch (err) {
      toast.error('Failed to delete subject')
    }
  }

  if (loading && exams.length === 0) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Subjects</h2>
          <p className="text-sm text-[var(--text-muted)]">Manage subjects for a specific exam.</p>
        </div>
        <div className="flex gap-3 items-center">
          <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]"
                  value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
          <button onClick={() => handleOpenModal()} disabled={!selectedExamId} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Plus size={18} /> Add Subject
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading && exams.length > 0 ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-500" /></div>
        ) : subjects.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">No subjects found for this exam.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={subjects.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {subjects.map(sub => (
                <SortableItem key={sub.id} id={sub.id} subject={sub} onEdit={handleOpenModal} onDelete={handleDelete} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-md shadow-2xl border border-[var(--border)]" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{editingSubject ? 'Edit Subject' : 'New Subject'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Name</label>
                <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                       value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Icon (Emoji)</label>
                  <input type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                         value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Status</label>
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({ ...formData, enabled: e.target.checked })} className="w-4 h-4 rounded" />
                    <span className="text-[var(--text-primary)]">Enabled</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:bg-[var(--border)]">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 flex justify-center min-w-[80px]">
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
