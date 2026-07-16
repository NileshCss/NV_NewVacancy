import React, { useState, useEffect } from 'react'
import {
  fetchMockTests, fetchMockTest, createMockTest, updateMockTest, deleteMockTest,
  publishMockTest, addMockTestQuestion, removeMockTestQuestion, reorderMockTestQuestions,
  syncMockTestQuestions, generateRandomMockTestQuestions, aiSuggestMockTestQuestions,
  fetchExams, fetchSubjects, fetchChapters, fetchQuestions,
} from '../../../services/api'
import { Plus, Loader2, Edit2, Trash2, Send, Search, Sparkles, RefreshCw, GripVertical, X, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  draft:     { bg: 'bg-gray-100 dark:bg-gray-800',   text: 'text-gray-600 dark:text-gray-300' },
  published: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  expired:   { bg: 'bg-red-100 dark:bg-red-900/30',  text: 'text-red-700 dark:text-red-300' },
}
const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Draggable Question Row ────────────────────────────────────────────────────
function DraggableQuestion({ q, index, onRemove, onMoveUp, onMoveDown, total }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg group">
      <div className="flex flex-col gap-0.5 text-gray-400">
        <button onClick={onMoveUp} disabled={index === 0} className="p-0.5 hover:text-gray-200 disabled:opacity-20 transition"><ChevronUp size={14} /></button>
        <button onClick={onMoveDown} disabled={index === total - 1} className="p-0.5 hover:text-gray-200 disabled:opacity-20 transition"><ChevronDown size={14} /></button>
      </div>
      <span className="text-[11px] font-bold text-[var(--text-muted)] w-6 text-center shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">{q.questions?.question_text || q.question_text || 'Question'}</div>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">{q.questions?.question_type || ''}</span>
          <span className={`text-[10px] font-bold uppercase ${q.questions?.difficulty === 'hard' ? 'text-red-400' : q.questions?.difficulty === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>
            {q.questions?.difficulty || ''}
          </span>
          {q.questions?.status === 'approved' && <span className="text-[10px] text-green-400 font-bold">✓ approved</span>}
          {q.questions?.status !== 'approved' && q.questions?.status && <span className="text-[10px] text-red-400 font-bold">⚠ {q.questions.status}</span>}
        </div>
      </div>
      <button onClick={onRemove} className="shrink-0 p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition">
        <X size={14} />
      </button>
    </div>
  )
}

// ── Random Rule Row ───────────────────────────────────────────────────────────
function RandomRuleRow({ rule, subjects, onChange, onRemove }) {
  return (
    <div className="flex flex-wrap gap-2 items-end p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Subject</label>
        <select value={rule.subject_id || ''} onChange={e => onChange({ ...rule, subject_id: e.target.value || null })}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] min-w-[140px]">
          <option value="">Any Subject</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Difficulty</label>
        <select value={rule.difficulty || ''} onChange={e => onChange({ ...rule, difficulty: e.target.value || null })}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1.5 text-xs text-[var(--text-primary)]">
          <option value="">Any</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Count</label>
        <input type="number" min="1" max="100" value={rule.count || 10} onChange={e => onChange({ ...rule, count: parseInt(e.target.value) || 1 })}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] w-20" />
      </div>
      <button onClick={onRemove} className="p-1.5 text-red-400 hover:text-red-300 transition mb-0.5"><X size={14} /></button>
    </div>
  )
}

// ── Mock Test Builder (Create / Edit) ─────────────────────────────────────────
function MockTestBuilder({ testId, onClose, onSaved }) {
  const [loading, setLoading] = useState(!!testId)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [selectionTab, setSelectionTab] = useState('manual')  // manual | random | ai

  // Core fields
  const [form, setForm] = useState({
    name: '', exam_id: '', subject_id: '', chapter_id: '',
    difficulty: 'mixed', duration_minutes: 60, total_questions: 20,
    total_marks: 20, passing_marks: '', negative_marking_ratio: 0,
    instructions: '', question_selection_mode: 'manual',
    publish_date: '', expiry_date: '',
  })

  // Question selections
  const [selectedQuestions, setSelectedQuestions] = useState([])   // [{ question_id, display_order, marks, questions:{...} }]
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiContext, setAiContext] = useState('')
  const [randomRules, setRandomRules] = useState([{ subject_id: null, difficulty: null, count: 10 }])
  const [randomGenerating, setRandomGenerating] = useState(false)

  // Search (manual mode)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Taxonomy data
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [chapters, setChapters] = useState([])

  const [publishErrors, setPublishErrors] = useState([])

  useEffect(() => {
    fetchExams().then(setExams).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.exam_id) {
      fetchSubjects(form.exam_id).then(setSubjects).catch(() => {})
      setForm(f => ({ ...f, subject_id: '', chapter_id: '' }))
      setSubjects([])
    }
  }, [form.exam_id])

  useEffect(() => {
    if (form.subject_id) {
      fetchChapters(form.subject_id).then(setChapters).catch(() => {})
      setForm(f => ({ ...f, chapter_id: '' }))
    }
  }, [form.subject_id])

  // Load existing test if editing
  useEffect(() => {
    if (!testId) return
    setLoading(true)
    fetchMockTest(testId)
      .then(data => {
        if (!data) return
        setForm({
          name: data.name || '',
          exam_id: data.exam_id || '',
          subject_id: data.subject_id || '',
          chapter_id: data.chapter_id || '',
          difficulty: data.difficulty || 'mixed',
          duration_minutes: data.duration_minutes || 60,
          total_questions: data.total_questions || 20,
          total_marks: data.total_marks || 20,
          passing_marks: data.passing_marks || '',
          negative_marking_ratio: data.negative_marking_ratio || 0,
          instructions: data.instructions || '',
          question_selection_mode: data.question_selection_mode || 'manual',
          publish_date: data.publish_date ? data.publish_date.substring(0, 10) : '',
          expiry_date: data.expiry_date ? data.expiry_date.substring(0, 10) : '',
        })
        if (data.questions?.length > 0) {
          setSelectedQuestions(
            data.questions.map(q => ({
              ...q,
              question_id: q.question_id || q.questions?.id
            }))
          )
        }
        if (data.random_rules?.length > 0) {
          setRandomRules(data.random_rules)
        }
        setSelectionTab(data.question_selection_mode || 'manual')
      })
      .catch(() => toast.error('Failed to load test'))
      .finally(() => setLoading(false))
  }, [testId])

  // Manual question search
  const [manualSubjectId, setManualSubjectId] = useState('')

  const handleSearch = async (subjId = manualSubjectId) => {
    if (!searchTerm.trim() && !form.exam_id && !subjId) return
    setSearchLoading(true)
    try {
      const results = await fetchQuestions({
        search: searchTerm,
        exam_id: form.exam_id,
        subject_id: subjId || undefined,
        status: 'approved',
        limit: 100, // fetch up to 100 questions for easier selection
      })
      setSearchResults(results || [])
    } catch {
      toast.error('Question search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      handleSearch(manualSubjectId)
    }, 400)
    return () => clearTimeout(t)
  }, [searchTerm, form.exam_id, manualSubjectId])

  const addAllVisibleQuestions = () => {
    const toAdd = searchResults.filter(q => !selectedQuestions.some(sq => sq.question_id === q.id))
    if (toAdd.length === 0) {
      toast.error('All visible questions are already added')
      return
    }
    
    const totalNewCount = selectedQuestions.length + toAdd.length
    const targetCount = parseInt(form.total_questions) || 0
    if (targetCount > 0 && totalNewCount > targetCount) {
      const confirmAdd = window.confirm(
        `Adding all ${toAdd.length} questions will exceed the test target of ${targetCount} questions (current: ${selectedQuestions.length}, new total: ${totalNewCount}).\n\nDo you want to proceed?`
      )
      if (!confirmAdd) return
    }

    setSelectedQuestions(prev => [
      ...prev,
      ...toAdd.map((q, index) => ({
        question_id: q.id,
        display_order: prev.length + index,
        marks: q.marks || 1,
        questions: q
      }))
    ])
    toast.success(`Successfully added ${toAdd.length} questions!`)
  }


  const addQuestion = (q) => {
    if (selectedQuestions.some(sq => sq.question_id === q.id)) {
      toast.error('Already added')
      return
    }
    setSelectedQuestions(prev => [
      ...prev,
      { question_id: q.id, display_order: prev.length, marks: q.marks || 1, questions: q }
    ])
  }

  const removeQuestion = (questionId) =>
    setSelectedQuestions(prev => prev.filter(q => q.question_id !== questionId).map((q, i) => ({ ...q, display_order: i })))

  const moveQuestion = (index, direction) => {
    const newList = [...selectedQuestions]
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    ;[newList[index], newList[swapIdx]] = [newList[swapIdx], newList[index]]
    setSelectedQuestions(newList.map((q, i) => ({ ...q, display_order: i })))
  }

  // Random generation
  const handleGenerate = async () => {
    if (!testId) { toast.error('Save the test first before generating random questions'); return }
    setRandomGenerating(true)
    try {
      const res = await generateRandomMockTestQuestions(testId, randomRules)
      if (res?.data?.length > 0) {
        const merged = [...selectedQuestions]
        for (const item of res.data) {
          if (!merged.some(q => q.question_id === item.question_id)) {
            merged.push({ ...item, questions: item.question })
          }
        }
        setSelectedQuestions(merged.map((q, i) => ({ ...q, display_order: i })))
        toast.success(`Added ${res.data.length} questions from random rules!`)
      } else {
        toast.error('No approved questions matched your rules')
      }
    } catch (err) {
      toast.error(err.message || 'Random generation failed')
    } finally {
      setRandomGenerating(false)
    }
  }

  // AI suggestion
  const handleAiSuggest = async () => {
    if (!testId) { toast.error('Save the test first before using AI suggest'); return }
    setAiLoading(true)
    setAiSuggestions([])
    try {
      const res = await aiSuggestMockTestQuestions(testId, aiContext)
      if (res?.data?.length > 0) {
        setAiSuggestions(res.data)
        toast.success(`AI proposed ${res.data.length} questions — review and confirm`)
      } else {
        toast.error('AI returned no suggestions')
      }
    } catch (err) {
      toast.error(err.message || 'AI suggestion failed. Is Ollama running?')
    } finally {
      setAiLoading(false)
    }
  }

  const acceptAiSuggestions = () => {
    const merged = [...selectedQuestions]
    for (const item of aiSuggestions) {
      if (!merged.some(q => q.question_id === item.question_id)) {
        merged.push({ ...item, questions: item.question })
      }
    }
    setSelectedQuestions(merged.map((q, i) => ({ ...q, display_order: i })))
    setAiSuggestions([])
    toast.success('AI suggestions added to selection')
  }

  // Save (create/update)
  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Test name is required'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        question_selection_mode: selectionTab,
        random_rules: randomRules,
        total_questions: parseInt(form.total_questions) || 0,
        total_marks: parseInt(form.total_marks) || 0,
        passing_marks: form.passing_marks ? parseInt(form.passing_marks) : null,
        duration_minutes: parseInt(form.duration_minutes) || 60,
        negative_marking_ratio: parseFloat(form.negative_marking_ratio) || 0,
        exam_id: form.exam_id || null,
        subject_id: form.subject_id || null,
        chapter_id: form.chapter_id || null,
        publish_date: form.publish_date || null,
        expiry_date: form.expiry_date || null,
      }

      let savedId = testId
      if (testId) {
        await updateMockTest(testId, payload)
        toast.success('Test updated!')
      } else {
        const res = await createMockTest(payload)
        savedId = res?.data?.id
        toast.success('Test created! Now add questions.')
      }

      // Sync questions to backend in a single batch
      if (savedId) {
        await syncMockTestQuestions(
          savedId,
          selectedQuestions.map(q => ({
            question_id: q.question_id,
            display_order: q.display_order,
            marks: q.marks || 1
          }))
        )
      }

      onSaved()
    } catch (err) {
      toast.error(err.message || 'Failed to save test')
    } finally {
      setSaving(false)
    }
  }

  // Publish
  const handlePublish = async () => {
    if (!testId) { toast.error('Save the test first'); return }
    setPublishing(true)
    setPublishErrors([])
    try {
      const res = await publishMockTest(testId)
      if (res?.success) {
        toast.success(`"${form.name}" published successfully! 🎉`)
        onSaved()
      }
    } catch (err) {
      const errs = err?.validation_errors || [err.message || 'Publish failed']
      setPublishErrors(errs)
      toast.error('Publish validation failed — see errors below')
    } finally {
      setPublishing(false)
    }
  }

  // Live counter
  const countMatch = selectedQuestions.length === parseInt(form.total_questions)
  const countColor = countMatch ? 'text-green-400' : 'text-yellow-400'

  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="animate-spin text-gray-500" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{testId ? '✏️ Edit Mock Test' : '➕ Create Mock Test'}</h3>
          <p className="text-sm text-[var(--text-muted)]">Fill in details, select questions, then save or publish.</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition p-2">✕ Close</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Form Fields */}
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-[var(--text-primary)]">📋 Basic Info</h4>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Test Name *</label>
              <input className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. SSC CGL 2024 Mock Test 1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Exam</label>
                <select className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.exam_id} onChange={e => setForm(f => ({ ...f, exam_id: e.target.value }))}>
                  <option value="">All Exams</option>
                  {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Subject (optional)</label>
                <select className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
                  <option value="">Full-Length</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Difficulty</label>
                <select className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="mixed">Mixed</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Duration (min)</label>
                <input type="number" min="1" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Total Questions</label>
                <input type="number" min="1" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.total_questions} onChange={e => setForm(f => ({ ...f, total_questions: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Total Marks</label>
                <input type="number" min="1" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Passing Marks</label>
                <input type="number" min="0" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.passing_marks} onChange={e => setForm(f => ({ ...f, passing_marks: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Negative Marking Ratio</label>
              <input type="number" min="0" max="1" step="0.25" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                value={form.negative_marking_ratio} onChange={e => setForm(f => ({ ...f, negative_marking_ratio: e.target.value }))} placeholder="0 = none, 0.25 = 1/4, 0.33 = 1/3..." />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Instructions</label>
              <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Exam instructions shown to students..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Publish Date</label>
                <input type="date" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.publish_date} onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Expiry Date</label>
                <input type="date" className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                  value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        {/* Right — Question Selection */}
        <div className="space-y-4">
          {/* Live Counter */}
          <div className={`flex items-center justify-between p-3 rounded-xl border ${countMatch ? 'bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-900/30' : 'bg-yellow-50 dark:bg-yellow-950/10 border-yellow-200 dark:border-yellow-900/30'}`}>
            <span className={`text-sm font-bold ${countColor}`}>
              {countMatch ? <CheckCircle2 className="inline mr-1" size={14} /> : <AlertTriangle className="inline mr-1" size={14} />}
              {selectedQuestions.length} / {form.total_questions} questions selected
            </span>
            {!countMatch && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                {selectedQuestions.length < parseInt(form.total_questions) ? `Need ${parseInt(form.total_questions) - selectedQuestions.length} more` : `${selectedQuestions.length - parseInt(form.total_questions)} too many`}
              </span>
            )}
          </div>

          {/* Selection Mode Tabs */}
          <div className="flex border-b border-[var(--border)]">
            {[{ id: 'manual', label: '✋ Manual' }, { id: 'random', label: '🎲 Random' }, { id: 'ai', label: '✨ AI-Assisted' }].map(tab => (
              <button key={tab.id} onClick={() => setSelectionTab(tab.id)}
                className={`pb-2 px-4 text-sm font-semibold border-b-2 transition ${selectionTab === tab.id ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--text-muted)]'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Manual Tab */}
          {selectionTab === 'manual' && (
            <div className="space-y-3">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                <div className="relative">
                  <input type="text" placeholder="Search approved questions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="premium-search-input" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                </div>
                <select
                  value={manualSubjectId}
                  onChange={e => setManualSubjectId(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 cursor-pointer"
                >
                  <option value="">All Subjects / Full Length</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Bulk selection action bar */}
              {!searchLoading && searchResults.length > 0 && (
                <div className="flex justify-between items-center bg-[var(--bg-surface)]/60 border border-[var(--border)] rounded-xl p-2 px-3">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">
                    Found {searchResults.length} questions
                  </span>
                  <button
                    onClick={addAllVisibleQuestions}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    Add All Visible Questions
                  </button>
                </div>
              )}


              {searchLoading && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-400" size={16} /></div>}
              {!searchLoading && searchResults.length > 0 && (
                <div className="max-h-52 overflow-y-auto space-y-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-2">
                  {searchResults.map(q => {
                    const alreadyAdded = selectedQuestions.some(sq => sq.question_id === q.id)
                    return (
                      <div key={q.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-surface)] transition cursor-pointer"
                        onClick={() => !alreadyAdded && addQuestion(q)}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[var(--text-primary)] line-clamp-1">{q.question_text}</div>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">{q.question_type}</span>
                            <span className={`text-[10px] font-bold ${q.difficulty === 'hard' ? 'text-red-400' : q.difficulty === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>{q.difficulty}</span>
                          </div>
                        </div>
                        <button className={`shrink-0 p-1 rounded-full text-xs font-bold ${alreadyAdded ? 'text-green-400 cursor-default' : 'text-blue-400 hover:text-blue-300'}`}>
                          {alreadyAdded ? '✓' : '+ Add'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {!searchLoading && searchResults.length === 0 && searchTerm.length > 2 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">No approved questions found. Try a different search term.</p>
              )}
            </div>
          )}

          {/* Random Tab */}
          {selectionTab === 'random' && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">Define rules for automatic question selection. Only approved questions matching the criteria will be selected.</p>
              {randomRules.map((rule, i) => (
                <RandomRuleRow key={i} rule={rule} subjects={subjects}
                  onChange={updated => setRandomRules(prev => prev.map((r, idx) => idx === i ? updated : r))}
                  onRemove={() => setRandomRules(prev => prev.filter((_, idx) => idx !== i))} />
              ))}
              <button onClick={() => setRandomRules(prev => [...prev, { subject_id: null, difficulty: null, count: 10 }])}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition">
                <Plus size={14} /> Add Rule
              </button>
              <button onClick={handleGenerate} disabled={randomGenerating}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                {randomGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {randomGenerating ? 'Generating...' : 'Generate Questions from Rules'}
              </button>
            </div>
          )}

          {/* AI Tab */}
          {selectionTab === 'ai' && (
            <div className="space-y-3">
              <div className="bg-purple-50 dark:bg-purple-950/10 border border-purple-200 dark:border-purple-900/30 rounded-xl p-3 text-xs text-purple-700 dark:text-purple-300">
                <strong>🤖 AI Proposes, Admin Disposes.</strong> AI will suggest questions from the approved bank. You must review and confirm before they're added. Requires Ollama to be running.
              </div>
              <textarea rows={3} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
                value={aiContext} onChange={e => setAiContext(e.target.value)}
                placeholder="Optional context: e.g. 'Focus on quantitative aptitude, avoid GK questions, include 5 hard problems...'" />
              <button onClick={handleAiSuggest} disabled={aiLoading}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiLoading ? 'AI is thinking...' : 'Get AI Suggestions'}
              </button>

              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-purple-400">🤖 {aiSuggestions.length} AI Suggestions — Review before accepting</span>
                    <div className="flex gap-2">
                      <button onClick={acceptAiSuggestions} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold">Accept All</button>
                      <button onClick={() => setAiSuggestions([])} className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs">Discard</button>
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5">
                    {aiSuggestions.map((item, i) => (
                      <div key={i} className="p-2 bg-purple-50 dark:bg-purple-950/10 border border-purple-200 dark:border-purple-900/30 rounded-lg">
                        <div className="text-xs text-[var(--text-primary)] line-clamp-2">{item.question?.question_text}</div>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] text-purple-500 font-mono">{item.question?.question_type}</span>
                          <span className="text-[10px] font-bold text-purple-400">{item.question?.difficulty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected Questions List */}
          {selectedQuestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Selected Questions ({selectedQuestions.length})</h4>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {selectedQuestions.map((q, i) => (
                  <DraggableQuestion key={q.question_id} q={q} index={i} total={selectedQuestions.length}
                    onRemove={() => removeQuestion(q.question_id)}
                    onMoveUp={() => moveQuestion(i, 'up')}
                    onMoveDown={() => moveQuestion(i, 'down')} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish Errors */}
      {publishErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
            <AlertTriangle size={16} /> Publish Validation Failed
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {publishErrors.map((e, i) => <li key={i} className="text-xs text-red-700 dark:text-red-300">{e}</li>)}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? 'Saving...' : testId ? '💾 Save Changes' : '💾 Save Draft'}
        </button>
        {testId && (
          <button onClick={handlePublish} disabled={publishing}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {publishing ? 'Publishing...' : '🚀 Publish Test'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main List View ─────────────────────────────────────────────────────────────
export default function MockTestsManager() {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ exam_id: '', status: '', search: '' })
  const [exams, setExams] = useState([])
  const [builderTestId, setBuilderTestId] = useState(undefined)   // undefined = list, null = create, string = edit
  const [deleting, setDeleting] = useState(null)

  const loadTests = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.exam_id) params.exam_id = filters.exam_id
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      const data = await fetchMockTests(params)
      setTests(data)
    } catch { toast.error('Failed to load mock tests') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchExams().then(setExams).catch(() => {}) }, [])
  useEffect(() => { if (builderTestId === undefined) loadTests() }, [filters, builderTestId])

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await deleteMockTest(id)
      toast.success('Test deleted')
      loadTests()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const handlePublish = async (id, name) => {
    if (!confirm(`Publish "${name}" now? This validates and locks the test for students.`)) return
    try {
      await publishMockTest(id)
      toast.success(`"${name}" published!`)
      loadTests()
    } catch (err) {
      const errs = err?.validation_errors || [err.message]
      toast.error(`Publish failed: ${errs[0]}`)
    }
  }

  // Builder open
  if (builderTestId !== undefined) {
    return (
      <div className="space-y-6">
        <MockTestBuilder
          testId={builderTestId}
          onClose={() => setBuilderTestId(undefined)}
          onSaved={() => { setBuilderTestId(undefined); loadTests() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">📋 Mock Tests</h2>
          <p className="text-sm text-[var(--text-muted)]">Create, manage and publish mock tests from the approved question bank.</p>
        </div>
        <button onClick={() => setBuilderTestId(null)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm">
          <Plus size={16} /> Create Mock Test
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 rounded-xl flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <input type="text" placeholder="Search test name..." value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="premium-search-input" />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
        </div>
        <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
          value={filters.exam_id} onChange={e => setFilters(f => ({ ...f, exam_id: e.target.value }))}>
          <option value="">All Exams</option>
          {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
        <select className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-sm text-[var(--text-primary)]"
          value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-500" size={24} /></div>
        ) : tests.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-[var(--text-muted)] text-sm">No mock tests yet. Create your first one!</div>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)] border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">Exam</th>
                <th className="p-4 font-semibold hidden sm:table-cell">Subject</th>
                <th className="p-4 font-semibold hidden md:table-cell">Qs</th>
                <th className="p-4 font-semibold hidden md:table-cell">Duration</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold hidden lg:table-cell">Publish Date</th>
                <th className="p-4 font-semibold hidden lg:table-cell">Attempts</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map(test => {
                const s = STATUS_COLORS[test.status] || STATUS_COLORS.draft
                return (
                  <tr key={test.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-[var(--text-primary)] max-w-[160px] truncate">{test.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono uppercase">{test.question_selection_mode}</div>
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)]">{test.exams?.name || '—'}</td>
                    <td className="p-4 text-sm text-[var(--text-secondary)] hidden sm:table-cell">{test.subjects?.name || 'Full-Length'}</td>
                    <td className="p-4 text-sm text-[var(--text-secondary)] hidden md:table-cell">{test.total_questions}</td>
                    <td className="p-4 text-sm text-[var(--text-secondary)] hidden md:table-cell">{test.duration_minutes} min</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${s.bg} ${s.text}`}>
                        {test.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)] hidden lg:table-cell">{fmtDate(test.publish_date)}</td>
                    <td className="p-4 text-sm text-[var(--text-secondary)] hidden lg:table-cell">{test.attempts_count ?? 0}</td>
                    <td className="p-4">
                      <div className="flex gap-2 items-center">
                        <button onClick={() => setBuilderTestId(test.id)} className="text-blue-500 hover:text-blue-400 p-1" title="Edit">
                          <Edit2 size={15} />
                        </button>
                        {test.status === 'draft' && (
                          <button onClick={() => handlePublish(test.id, test.name)} className="text-green-500 hover:text-green-400 p-1" title="Publish">
                            <Send size={15} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(test.id, test.name)} disabled={deleting === test.id} className="text-red-500 hover:text-red-400 p-1" title="Delete">
                          {deleting === test.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
