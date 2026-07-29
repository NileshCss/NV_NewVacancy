import React, { useState, useEffect } from 'react'
import { fetchExams, fetchSubjects, fetchChapters, fetchTopics } from '../../../services/api'
import { MoveRight, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function QuestionBankMoveModal({ count = 1, onConfirm, onClose }) {
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [chapters, setChapters] = useState([])
  const [topics, setTopics] = useState([])

  const [mapping, setMapping] = useState({
    exam_id: '',
    subject_id: '',
    chapter_id: '',
    topic_id: ''
  })

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchExams()
      .then(data => {
        setExams(data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!mapping.exam_id) {
      setSubjects([])
      setChapters([])
      setTopics([])
      return
    }
    fetchSubjects(mapping.exam_id).then(setSubjects).catch(() => toast.error('Failed to load subjects'))
  }, [mapping.exam_id])

  useEffect(() => {
    if (!mapping.subject_id) {
      setChapters([])
      setTopics([])
      return
    }
    fetchChapters(mapping.subject_id).then(setChapters).catch(() => toast.error('Failed to load chapters'))
  }, [mapping.subject_id])

  useEffect(() => {
    if (!mapping.chapter_id) {
      setTopics([])
      return
    }
    fetchTopics(mapping.chapter_id).then(setTopics).catch(() => toast.error('Failed to load topics'))
  }, [mapping.chapter_id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!mapping.topic_id) return toast.error('Please select a target Topic')

    setSubmitting(true)
    try {
      await onConfirm(mapping)
    } catch (err) {
      toast.error(err.message || 'Failed to move questions')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-surface)]">
          <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <MoveRight className="text-[var(--brand)]" size={18} />
            <span>Move {count} Question{count !== 1 ? 's' : ''} to Topic</span>
          </h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[var(--brand)]" /></div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Target Exam *</label>
                <select
                  required
                  value={mapping.exam_id}
                  onChange={e => setMapping({ exam_id: e.target.value, subject_id: '', chapter_id: '', topic_id: '' })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)]"
                >
                  <option value="">-- Select Exam --</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Target Subject *</label>
                <select
                  required
                  disabled={!mapping.exam_id}
                  value={mapping.subject_id}
                  onChange={e => setMapping({ ...mapping, subject_id: e.target.value, chapter_id: '', topic_id: '' })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] disabled:opacity-50"
                >
                  <option value="">-- Select Subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Target Chapter *</label>
                <select
                  required
                  disabled={!mapping.subject_id}
                  value={mapping.chapter_id}
                  onChange={e => setMapping({ ...mapping, chapter_id: e.target.value, topic_id: '' })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] disabled:opacity-50"
                >
                  <option value="">-- Select Chapter --</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Target Topic *</label>
                <select
                  required
                  disabled={!mapping.chapter_id}
                  value={mapping.topic_id}
                  onChange={e => setMapping({ ...mapping, topic_id: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] disabled:opacity-50"
                >
                  <option value="">-- Select Topic --</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !mapping.topic_id}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center min-w-[100px]"
            >
              {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {submitting ? 'Moving...' : 'Move Questions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
