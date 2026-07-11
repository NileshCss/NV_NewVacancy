import React, { useState, useEffect } from 'react'
import { fetchExams, fetchSubjects, fetchTopics, createTopic, updateTopic, deleteTopic, reorderTopics } from '../../../services/api'
import { Edit2, Trash2, Plus, Loader2, GripVertical, ChevronRight, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItem({ id, topic, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] border-b border-[var(--border)]">
      <div {...attributes} {...listeners} className="cursor-grab text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <GripVertical size={20} />
      </div>
      <div className="flex-1">
        <div className="font-medium text-[var(--text-primary)]">{topic.name}</div>
        {(topic.description || topic.pdf_url) && (
          <div className="flex gap-3 mt-1 text-xs text-[var(--text-muted)]">
            {topic.description && <span className="truncate max-w-[200px]">{topic.description}</span>}
            {topic.pdf_url && <span className="flex items-center gap-1 text-blue-500"><FileText size={12}/> PDF attached</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onEdit(topic)} className="text-blue-500 hover:text-blue-600 p-1"><Edit2 size={16} /></button>
        <button onClick={() => onDelete(topic.id)} className="text-red-500 hover:text-red-600 p-1"><Trash2 size={16} /></button>
      </div>
    </div>
  )
}

export default function TopicsManager() {
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [topics, setTopics] = useState([])
  
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [loading, setLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState(null)
  const [formData, setFormData] = useState({ 
    name: '', description: '', notes_rich_text: '', formula: '', 
    interview_tips: '', revision_notes: '', important_points: '', pdf_url: '' 
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  useEffect(() => {
    fetchExams().then(data => {
      setExams(data); if(data.length) setSelectedExamId(data[0].id); else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedExamId) return;
    fetchSubjects(selectedExamId).then(data => {
      setSubjects(data); if(data.length) setSelectedSubjectId(data[0].id); else { setSelectedSubjectId(''); setLoading(false) }
    })
  }, [selectedExamId])

  useEffect(() => {
    if (!selectedSubjectId) { setTopics([]); setLoading(false); return }
    setLoading(true)
    fetchTopics(selectedSubjectId).then(data => setTopics(data)).catch(()=>toast.error('Error')).finally(()=>setLoading(false))
  }, [selectedSubjectId])

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = topics.findIndex(t => t.id === active.id)
    const newIndex = topics.findIndex(t => t.id === over.id)
    const newItems = arrayMove(topics, oldIndex, newIndex)
    setTopics(newItems)
    
    try {
      await reorderTopics(newItems.map((item, index) => ({ id: item.id, display_order: index })))
      toast.success('Order saved')
    } catch (err) {
      toast.error('Failed to save order')
      fetchTopics(selectedSubjectId).then(setTopics)
    }
  }

  const handleOpenModal = (topic = null) => {
    setEditingTopic(topic)
    setFormData({
      name: topic?.name || '', description: topic?.description || '', 
      notes_rich_text: topic?.notes_rich_text || '', formula: topic?.formula || '', 
      interview_tips: topic?.interview_tips || '', revision_notes: topic?.revision_notes || '', 
      important_points: topic?.important_points || '', pdf_url: topic?.pdf_url || ''
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) return toast.error('Name is required')
    setIsSubmitting(true)
    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, formData)
        toast.success('Topic updated')
      } else {
        await createTopic({ ...formData, subject_id: selectedSubjectId, display_order: topics.length })
        toast.success('Topic created')
      }
      setTopics(await fetchTopics(selectedSubjectId))
      setIsModalOpen(false)
    } catch (err) {
      toast.error(err.message || 'Error saving topic')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this topic?')) return
    try {
      await deleteTopic(id)
      toast.success('Topic deleted')
      setTopics(await fetchTopics(selectedSubjectId))
    } catch (err) {
      toast.error('Failed to delete topic')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Topics</h2>
          <p className="text-sm text-[var(--text-muted)]">Manage syllabus topics and study material.</p>
        </div>
        <button onClick={() => handleOpenModal()} disabled={!selectedSubjectId} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Plus size={18} /> Add Topic
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border)] text-sm">
        <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 flex-1 min-w-[150px]" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}>
          <option value="" disabled>Select Exam</option>
          {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
        <ChevronRight size={16} className="text-[var(--text-muted)] hidden sm:block" />
        <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 flex-1 min-w-[150px]" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} disabled={!subjects.length}>
          <option value="" disabled>{subjects.length ? "Select Subject" : "No Subjects"}</option>
          {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-500" /></div>
        ) : !selectedSubjectId ? (
          <div className="p-8 text-center text-[var(--text-muted)]">Please select a subject.</div>
        ) : topics.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">No topics found. Add one above.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={topics.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {topics.map(topic => (
                <SortableItem key={topic.id} id={topic.id} topic={topic} onEdit={handleOpenModal} onDelete={handleDelete} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-2xl shadow-2xl border border-[var(--border)] my-8" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{editingTopic ? 'Edit Topic' : 'New Topic'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Topic Name *</label>
                <input required type="text" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                       value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Short Description</label>
                <textarea rows={2} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                          value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Detailed Notes / Content</label>
                <textarea rows={4} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)] font-mono text-sm" 
                          placeholder="Supports markdown or raw text..."
                          value={formData.notes_rich_text} onChange={e => setFormData({ ...formData, notes_rich_text: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Important Formulas</label>
                  <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                            value={formData.formula} onChange={e => setFormData({ ...formData, formula: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Interview Tips</label>
                  <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                            value={formData.interview_tips} onChange={e => setFormData({ ...formData, interview_tips: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">PDF URL (Optional)</label>
                <input type="url" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-[var(--text-primary)]" 
                       placeholder="https://..." value={formData.pdf_url} onChange={e => setFormData({ ...formData, pdf_url: e.target.value })} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:bg-[var(--border)]">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 min-w-[80px] flex justify-center">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Save Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
