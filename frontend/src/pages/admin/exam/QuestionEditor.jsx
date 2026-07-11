import React, { useState, useEffect } from 'react'
import { fetchExams, fetchSubjects, fetchChapters, fetchTopics } from '../../../services/api'
import { Plus, Trash, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function QuestionEditor({ question, onSave, onCancel }) {
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [chapters, setChapters] = useState([])
  const [topics, setTopics] = useState([])

  // Mappings state
  const [mapping, setMapping] = useState({
    exam_id: '',
    subject_id: '',
    chapter_id: '',
    topic_id: ''
  })

  const [formData, setFormData] = useState({
    question_text: '',
    question_type: 'mcq',
    options: ['', '', '', ''],
    correct_answer: { answer: '', indices: [] },
    solution_text: '',
    explanation: '',
    difficulty: 'medium',
    marks: 1,
    negative_marks: 0,
    tags: [],
    code_block: '',
    hint: '',
    reference: '',
    source: 'manual',
    status: 'draft'
  })

  const [newTag, setNewTag] = useState('')
  const [loadingMetadata, setLoadingMetadata] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load exam metadata
  useEffect(() => {
    fetchExams()
      .then(data => {
        setExams(data)
        setLoadingMetadata(false)
      })
      .catch(() => {
        toast.error('Failed to load exams list')
        setLoadingMetadata(false)
      })

    if (question) {
      setFormData({
        question_text: question.question_text || '',
        question_type: question.question_type || 'mcq',
        options: question.options || ['', '', '', ''],
        correct_answer: question.correct_answer || { answer: '', indices: [] },
        solution_text: question.solution_text || '',
        explanation: question.explanation || '',
        difficulty: question.difficulty || 'medium',
        marks: question.marks || 1,
        negative_marks: question.negative_marks || 0,
        tags: question.tags || [],
        code_block: question.code_block || '',
        hint: question.hint || '',
        reference: question.reference || '',
        source: question.source || 'manual',
        status: question.status || 'draft'
      })
      
      if (question.question_exam_map && question.question_exam_map.length > 0) {
        const firstMap = question.question_exam_map[0]
        setMapping({
          exam_id: firstMap.exam_id || '',
          subject_id: firstMap.subject_id || '',
          chapter_id: firstMap.chapter_id || '',
          topic_id: firstMap.topic_id || ''
        })
      }
    }
  }, [question])

  // Load subjects when exam changes
  useEffect(() => {
    if (!mapping.exam_id) {
      setSubjects([])
      return
    }
    fetchSubjects(mapping.exam_id).then(setSubjects).catch(() => toast.error('Failed to load subjects'))
  }, [mapping.exam_id])

  // Load chapters when subject changes
  useEffect(() => {
    if (!mapping.subject_id) {
      setChapters([])
      return
    }
    fetchChapters(mapping.subject_id).then(setChapters).catch(() => toast.error('Failed to load chapters'))
  }, [mapping.subject_id])

  // Load topics when chapter changes
  useEffect(() => {
    if (!mapping.chapter_id) {
      setTopics([])
      return
    }
    fetchTopics(mapping.chapter_id).then(setTopics).catch(() => toast.error('Failed to load topics'))
  }, [mapping.chapter_id])

  const handleOptionChange = (index, value) => {
    const updated = [...formData.options]
    updated[index] = value
    setFormData({ ...formData, options: updated })
  }

  const addOption = () => {
    setFormData({ ...formData, options: [...formData.options, ''] })
  }

  const removeOption = (index) => {
    const updated = formData.options.filter((_, i) => i !== index)
    setFormData({ ...formData, options: updated })
  }

  const toggleCorrectIndex = (index) => {
    const { indices } = formData.correct_answer
    let newIndices = []
    if (formData.question_type === 'mcq' || formData.question_type === 'true_false' || formData.question_type === 'assertion_reason') {
      newIndices = [index]
    } else {
      newIndices = indices.includes(index) ? indices.filter(i => i !== index) : [...indices, index]
    }
    setFormData({
      ...formData,
      correct_answer: {
        ...formData.correct_answer,
        indices: newIndices,
        answer: formData.options[index] || ''
      }
    })
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.question_text) return toast.error('Question text is required')
    
    setSaving(true)
    const payload = {
      ...formData,
      mappings: mapping.exam_id ? [mapping] : []
    }
    try {
      await onSave(payload)
    } catch (err) {
      toast.error(err.message || 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-[var(--border)] pb-4">
        <h3 className="text-xl font-bold text-[var(--text-primary)]">
          {question ? 'Edit Question' : 'Add New Question'}
        </h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>

      {loadingMetadata ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mappings / Hierarchy Selector */}
          <div className="bg-[var(--bg-surface)] p-4 rounded-lg border border-[var(--border)] space-y-4">
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">Syllabus Association</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Exam</label>
                <select className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text-primary)]"
                        value={mapping.exam_id} onChange={e => setMapping({ ...mapping, exam_id: e.target.value, subject_id: '', chapter_id: '', topic_id: '' })}>
                  <option value="">None / Independent</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Subject</label>
                <select className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text-primary)]"
                        disabled={!mapping.exam_id}
                        value={mapping.subject_id} onChange={e => setMapping({ ...mapping, subject_id: e.target.value, chapter_id: '', topic_id: '' })}>
                  <option value="">Select Subject...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Chapter</label>
                <select className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text-primary)]"
                        disabled={!mapping.subject_id}
                        value={mapping.chapter_id} onChange={e => setMapping({ ...mapping, chapter_id: e.target.value, topic_id: '' })}>
                  <option value="">Select Chapter...</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Topic</label>
                <select className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text-primary)]"
                        disabled={!mapping.chapter_id}
                        value={mapping.topic_id} onChange={e => setMapping({ ...mapping, topic_id: e.target.value })}>
                  <option value="">Select Topic...</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Question Text *</label>
            <textarea required rows={4} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] font-medium"
                      value={formData.question_text} onChange={e => setFormData({ ...formData, question_text: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Question Type</label>
              <select className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
                      value={formData.question_type} onChange={e => setFormData({ ...formData, question_type: e.target.value })}>
                <option value="mcq">Single Correct MCQ</option>
                <option value="multiple_correct">Multiple Correct MCQ</option>
                <option value="true_false">True / False</option>
                <option value="assertion_reason">Assertion Reason</option>
                <option value="fill_blank">Fill in the Blank</option>
                <option value="sql_output">SQL Code Output</option>
                <option value="coding_mcq">Coding MCQ</option>
                <option value="interview_question">Interview Question</option>
                <option value="previous_year_question">Previous Year Question</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Difficulty</label>
              <select className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
                      value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Marks</label>
                <input type="number" step="0.5" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
                       value={formData.marks} onChange={e => setFormData({ ...formData, marks: parseFloat(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Negative Marks</label>
                <input type="number" step="0.25" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
                       value={formData.negative_marks} onChange={e => setFormData({ ...formData, negative_marks: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          {/* Options / Choices Editor */}
          {['mcq', 'multiple_correct', 'true_false', 'assertion_reason'].includes(formData.question_type) && (
            <div className="bg-[var(--bg-surface)] p-4 rounded-lg border border-[var(--border)] space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">Options / Choices</h4>
                {!['true_false', 'assertion_reason'].includes(formData.question_type) && (
                  <button type="button" onClick={addOption} className="text-sm flex items-center gap-1 text-blue-500 hover:text-blue-600">
                    <Plus size={16} /> Add Option
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {formData.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      type={formData.question_type === 'multiple_correct' ? 'checkbox' : 'radio'}
                      name="correct-choice"
                      checked={formData.correct_answer?.indices?.includes(i)}
                      onChange={() => toggleCorrectIndex(i)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <input
                      type="text"
                      className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text-primary)]"
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={e => handleOptionChange(i, e.target.value)}
                    />
                    {!['true_false', 'assertion_reason'].includes(formData.question_type) && formData.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="text-red-500 hover:text-red-600">
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">Check the circle or box next to the correct answer(s).</p>
            </div>
          )}

          {/* Optional Code block (e.g. for coding questions) */}
          {['sql_output', 'coding_mcq'].includes(formData.question_type) && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Code Block / SQL Query</label>
              <textarea rows={6} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] font-mono text-sm"
                        placeholder="SELECT * FROM table..."
                        value={formData.code_block} onChange={e => setFormData({ ...formData, code_block: e.target.value })} />
            </div>
          )}

          {/* Explanations & Solutions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Explanation</label>
              <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
                        placeholder="Brief summary of why this is correct..."
                        value={formData.explanation} onChange={e => setFormData({ ...formData, explanation: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Detailed Solution</label>
              <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
                        placeholder="Step-by-step resolution steps..."
                        value={formData.solution_text} onChange={e => setFormData({ ...formData, solution_text: e.target.value })} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tags / Keywords</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map(t => (
                <span key={t} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-full font-medium">
                  {t}
                  <button type="button" onClick={() => handleRemoveTag(t)} className="text-blue-500 hover:text-blue-700">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Add custom tag (e.g. Algebra)" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-2 text-sm text-[var(--text-primary)] flex-1"
                     value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }} />
              <button type="button" onClick={handleAddTag} className="btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">Add</button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)]">
            <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:bg-[var(--border)] transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-2 justify-center min-w-[120px]">
              {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save Question'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
