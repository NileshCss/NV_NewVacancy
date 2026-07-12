import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from '../../context/RouterContext'
import { startMockTestAttempt, saveMockTestAnswer, logMockTestTabSwitch, submitMockTest } from '../../services/api'
import { Loader2, AlertTriangle, Clock, CheckCircle, ChevronLeft, ChevronRight, Menu, HelpCircle, Eye, Trash2, Send } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MockTestPlayer() {
  const { page, navigate } = useRouter()
  // URL format: "mock-tests/take/:id"
  const testId = page.split('/')[2]

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // State
  const [started, setStarted] = useState(false)
  const [acceptedInstructions, setAcceptedInstructions] = useState(false)
  const [test, setTest] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)

  // Answers state
  // Map of question_id -> { selected_answer, marked_for_review, time_spent_seconds }
  const [answers, setAnswers] = useState({})
  const [visited, setVisited] = useState(new Set())

  // Timers and Cheating prevention
  const [timeLeft, setTimeLeft] = useState(0) // seconds
  const [tabSwitches, setTabSwitches] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(window.innerWidth >= 1024)

  const timerRef = useRef(null)
  const answersRef = useRef(answers)
  const timeSpentRef = useRef({}) // tracks seconds spent on current question

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  // Load test configuration / in_progress attempt on mount
  useEffect(() => {
    async function loadTest() {
      try {
        setLoading(true)
        const res = await startMockTestAttempt(testId)
        if (res.success) {
          const { test: testData, attempt: attemptData, questions: qList, answers: savedAns } = res.data
          setTest(testData)
          setAttempt(attemptData)
          setQuestions(qList)

          // Load already saved answers
          const answersMap = {}
          savedAns.forEach(ans => {
            answersMap[ans.question_id] = {
              selected_answer: ans.selected_answer,
              marked_for_review: ans.marked_for_review,
              time_spent_seconds: ans.time_spent_seconds || 0
            }
          })
          setAnswers(answersMap)

          // Mark previously answered questions as visited
          const visitedSet = new Set([0])
          savedAns.forEach(ans => {
            if (ans.selected_answer !== null && ans.selected_answer !== undefined) {
              visitedSet.add(qList.findIndex(q => q.id === ans.question_id))
            }
          })
          setVisited(visitedSet)

          // Calculate remaining time from server started_at
          const durationSec = testData.duration_minutes * 60
          const elapsedSec = Math.floor((new Date() - new Date(attemptData.started_at)) / 1000)
          const remainingSec = durationSec - elapsedSec

          if (remainingSec <= 0) {
            // Expired immediately
            toast.error('Time limit has already exceeded!')
            await triggerFinalSubmit(attemptData.id)
          } else {
            setTimeLeft(remainingSec)
            setTabSwitches(attemptData.tab_switch_count || 0)
            
            // If already in_progress and resuming, bypass instructions screen
            if (attemptData.status === 'in_progress' && elapsedSec > 5) {
              setStarted(true)
            }
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to start mock test')
      } finally {
        setLoading(false)
      }
    }

    loadTest()
  }, [testId])

  // Timer countdown hook
  useEffect(() => {
    if (!started || timeLeft <= 0) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          triggerAutoSubmit()
          return 0
        }

        // Increment time spent on current active question
        const currentQId = questions[currentIdx]?.id
        if (currentQId) {
          timeSpentRef.current[currentQId] = (timeSpentRef.current[currentQId] || 0) + 1
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [started, currentIdx, questions, timeLeft])

  // Tab switch detection handler
  useEffect(() => {
    if (!started || isSubmitting) return

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        await logCheatingViolation()
      }
    }

    const handleBlur = async () => {
      await logCheatingViolation()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [started, attempt, isSubmitting])

  const logCheatingViolation = async () => {
    if (!attempt || isSubmitting) return
    try {
      const res = await logMockTestTabSwitch(attempt.id)
      if (res.success) {
        const count = res.tab_switch_count
        setTabSwitches(count)
        
        if (count >= 5) {
          toast.error('Maximum tab switch limit exceeded. Auto-submitting test now!')
          await triggerFinalSubmit(attempt.id)
        } else {
          toast.error(`Warning: Tab switch detected! (Violation ${count}/5). Do not switch tabs.`)
        }
      }
    } catch (err) {
      console.error('Error logging tab switch:', err)
    }
  }

  // Auto-save debounced answers
  const saveAnswerToServer = async (qId, selectedVal, marked, timeSpent) => {
    if (!attempt) return
    try {
      await saveMockTestAnswer(attempt.id, {
        question_id: qId,
        selected_answer: selectedVal,
        marked_for_review: marked,
        time_spent_seconds: timeSpent
      })
    } catch (err) {
      console.warn('Network issue saving answer. Will retry on next interaction.', err.message)
    }
  }

  const handleSelectOption = (optIdx) => {
    const q = questions[currentIdx]
    const updated = {
      ...answers[q.id],
      selected_answer: optIdx
    }
    setAnswers(prev => ({ ...prev, [q.id]: updated }))
    
    // Save to server
    const currentSpent = (timeSpentRef.current[q.id] || 0) + (updated.time_spent_seconds || 0)
    saveAnswerToServer(q.id, optIdx, updated.marked_for_review || false, currentSpent)
  }

  const handleClearResponse = () => {
    const q = questions[currentIdx]
    const updated = {
      ...answers[q.id],
      selected_answer: null
    }
    setAnswers(prev => ({ ...prev, [q.id]: updated }))
    
    const currentSpent = (timeSpentRef.current[q.id] || 0) + (updated.time_spent_seconds || 0)
    saveAnswerToServer(q.id, null, updated.marked_for_review || false, currentSpent)
  }

  const handleMarkReview = () => {
    const q = questions[currentIdx]
    const isCurrentlyMarked = answers[q.id]?.marked_for_review || false
    const updated = {
      ...answers[q.id],
      marked_for_review: !isCurrentlyMarked
    }
    setAnswers(prev => ({ ...prev, [q.id]: updated }))
    
    const currentSpent = (timeSpentRef.current[q.id] || 0) + (updated.time_spent_seconds || 0)
    saveAnswerToServer(q.id, updated.selected_answer, !isCurrentlyMarked, currentSpent)
    
    // Advance to next question
    handleNext()
  }

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1
      setCurrentIdx(nextIdx)
      setVisited(prev => new Set([...prev, nextIdx]))
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1)
    }
  }

  const triggerAutoSubmit = async () => {
    toast.success('Time limit reached! Auto-submitting your test...')
    await triggerFinalSubmit(attempt.id)
  }

  const triggerFinalSubmit = async (attemptId) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    clearInterval(timerRef.current)
    
    try {
      const res = await submitMockTest(attemptId)
      if (res.success) {
        toast.success('Mock test submitted successfully!')
        navigate(`mock-tests/result/${attemptId}`)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit test')
      setIsSubmitting(false)
    }
  }

  // Format timer text
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center">
      <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4">
        <AlertTriangle size={32} />
      </div>
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Error</h2>
      <p className="text-[var(--text-muted)] mb-6">{error}</p>
      <button onClick={() => navigate('mock-tests')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors">
        Go Back to Mock Tests
      </button>
    </div>
  )

  // 1. INSTRUCTIONS SCREEN
  if (!started) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8 shadow-sm">
          <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-4">{test?.name}</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--bg-surface)] rounded-xl mb-6 text-center">
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Duration</div>
              <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{test?.duration_minutes} Minutes</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Total Questions</div>
              <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{test?.total_questions} Qs</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Total Marks</div>
              <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{test?.total_marks} Marks</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Negative Marks</div>
              <div className="text-lg font-bold text-red-400 mt-0.5">-{((test?.negative_marking_ratio || 0) * 100).toFixed(0)}%</div>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none mb-8 text-[var(--text-secondary)] leading-relaxed">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">General Instructions:</h3>
            {test?.instructions ? (
              <div className="whitespace-pre-wrap">{test.instructions}</div>
            ) : (
              <ul className="list-disc pl-5 space-y-2">
                <li>Make sure you have a stable internet connection before starting.</li>
                <li>Do not click back button or reload the browser. If you do, your progress will be saved but the timer will keep running.</li>
                <li>Switching browser tabs or applications will log a cheating violation. <strong>5 violations will lead to auto-submission!</strong></li>
                <li>The test will auto-submit as soon as the timer reaches zero.</li>
              </ul>
            )}
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl mb-6">
            <input 
              type="checkbox" 
              id="accept-instructions"
              checked={acceptedInstructions}
              onChange={e => setAcceptedInstructions(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="accept-instructions" className="text-sm text-[var(--text-secondary)] cursor-pointer select-none">
              I have read and understood all the instructions above and agree to complete the mock test honestly.
            </label>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => navigate('mock-tests')} 
              className="flex-1 py-3 bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={!acceptedInstructions}
              onClick={() => setStarted(true)}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              Start Exam
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2. LIVE TEST INTERFACE
  const currentQ = questions[currentIdx]
  const selectedAns = answers[currentQ?.id]?.selected_answer
  const isMarked = answers[currentQ?.id]?.marked_for_review || false

  // Stats for palette
  const totalQs = questions.length
  let answeredCount = 0
  let markedCount = 0
  let unattemptedCount = 0
  let notVisitedCount = totalQs - visited.size

  questions.forEach((q, idx) => {
    const ans = answers[q.id]
    if (ans?.selected_answer !== null && ans?.selected_answer !== undefined) {
      if (ans.marked_for_review) markedCount++
      else answeredCount++
    } else {
      if (ans?.marked_for_review) markedCount++
      else if (visited.has(idx)) unattemptedCount++
    }
  })

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col justify-between">
      {/* Header Panel */}
      <header className="sticky top-0 z-50 bg-[var(--bg-card)] border-b border-[var(--border)] px-4 py-3 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] line-clamp-1">{test?.name}</h1>
          {tabSwitches > 0 && (
            <span className="text-[10px] text-red-400 font-bold flex items-center gap-1 mt-0.5">
              ⚠️ Anti-Cheat Warning: {tabSwitches}/5 Violations
            </span>
          )}
        </div>
        
        {/* Timer Panel */}
        <div className="flex items-center gap-4 bg-[var(--bg-surface)] px-4 py-1.5 rounded-full border border-[var(--border)]">
          <Clock className={`w-4 h-4 ${timeLeft < 120 ? 'text-red-400 animate-pulse' : 'text-blue-500'}`} />
          <span className={`font-mono text-sm font-bold ${timeLeft < 120 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Question Pane */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {currentQ && (
            <div className="space-y-6">
              {/* Question metadata */}
              <div className="flex justify-between items-center bg-[var(--bg-surface)] p-3 border border-[var(--border)] rounded-xl">
                <span className="text-sm font-bold text-blue-500">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono uppercase bg-[var(--bg-card)] px-2 py-0.5 border border-[var(--border)] rounded-lg">
                  {currentQ.question_type} | +{currentQ.marks} / -{currentQ.negative_marks}
                </span>
              </div>

              {/* Text */}
              <div className="text-lg text-[var(--text-primary)] font-medium whitespace-pre-wrap leading-relaxed">
                {currentQ.question_text}
              </div>

              {/* Code blocks / diagram details if exists */}
              {currentQ.code_block && (
                <pre className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 rounded-xl font-mono text-sm text-[var(--text-primary)] overflow-x-auto">
                  <code>{currentQ.code_block}</code>
                </pre>
              )}

              {currentQ.image_url && (
                <div className="border border-[var(--border)] rounded-xl overflow-hidden max-w-md bg-white">
                  <img src={currentQ.image_url} alt="Question figure" className="w-full h-auto object-contain" />
                </div>
              )}

              {/* Options selection */}
              <div className="space-y-3">
                {Array.isArray(currentQ.options) ? (
                  currentQ.options.map((opt, optIdx) => {
                    const isSelected = selectedAns === optIdx
                    const letter = String.fromCharCode(65 + optIdx)
                    
                    return (
                      <button 
                        key={optIdx}
                        onClick={() => handleSelectOption(optIdx)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 flex items-start gap-4 ${
                          isSelected 
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 text-[var(--text-primary)]'
                            : 'bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                          isSelected 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]'
                        }`}>
                          {letter}
                        </span>
                        <span className="text-sm font-medium">{opt}</span>
                      </button>
                    )
                  })
                ) : (
                  <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-center text-sm text-[var(--text-muted)]">
                    This question has no multiple choice options. Please type your response (Not applicable for MCQs).
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Backdrop Overlay for Palette Drawer */}
        {paletteOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setPaletteOpen(false)}
          />
        )}

        {/* Right Side: Palette Pane (collapsible) */}
        {paletteOpen && (
          <div className="fixed lg:relative bottom-0 lg:bottom-auto inset-x-0 lg:inset-x-auto z-50 lg:z-0 w-full lg:w-80 bg-[var(--bg-card)] border-t lg:border-t-0 lg:border-l border-[var(--border)] p-4 overflow-y-auto max-h-[75vh] lg:max-h-[calc(100vh-140px)] flex flex-col justify-between shrink-0 rounded-t-3xl lg:rounded-t-none shadow-2xl lg:shadow-none animate-in slide-in-from-bottom duration-250">
            <div>
              {/* Palette Stats summary */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs mb-4">
                <div className="p-2 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30 rounded-xl font-bold">
                  {answeredCount} Answered
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 rounded-xl font-bold">
                  {markedCount} Marked
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-900/30 rounded-xl font-bold">
                  {unattemptedCount} Unanswered
                </div>
                <div className="p-2 bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] rounded-xl font-bold">
                  {notVisitedCount} Not Visited
                </div>
              </div>

              {/* Numbered Grid */}
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Question Palette</h3>
              <div className="grid grid-cols-5 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isActive = currentIdx === idx
                  const ans = answers[q.id]
                  const isAnswered = ans?.selected_answer !== null && ans?.selected_answer !== undefined
                  const isMarkedReview = ans?.marked_for_review

                  let btnClass = 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]'
                  if (isAnswered) {
                    if (isMarkedReview) btnClass = 'bg-purple-600 text-white border-purple-600'
                    else btnClass = 'bg-green-600 text-white border-green-600'
                  } else {
                    if (isMarkedReview) btnClass = 'bg-purple-600 text-white border-purple-600'
                    else if (visited.has(idx)) btnClass = 'bg-yellow-500 text-white border-yellow-500'
                  }

                  return (
                    <button 
                      key={q.id}
                      onClick={() => {
                        setCurrentIdx(idx)
                        setVisited(prev => new Set([...prev, idx]))
                        if (window.innerWidth < 1024) setPaletteOpen(false)
                      }}
                      className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-bold text-sm transition-all ${btnClass} ${
                        isActive ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit Block */}
            <div className="pt-4 border-t border-[var(--border)] mt-4">
              <button 
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
              >
                <Send size={16} /> Submit Test
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Nav Bar */}
      <footer className="sticky bottom-0 bg-[var(--bg-card)] border-t border-[var(--border)] p-4 flex justify-between items-center gap-2 flex-wrap">
        <div className="flex gap-2">
          <button 
            disabled={currentIdx === 0}
            onClick={handlePrev}
            className="p-3 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-[var(--text-primary)] rounded-xl border border-[var(--border)] transition-colors disabled:opacity-40"
          >
            <ChevronLeft size={20} />
          </button>
          
          <button 
            onClick={handleClearResponse}
            className="px-4 py-3 bg-[var(--bg-surface)] hover:bg-[var(--border)] text-red-500 hover:text-red-600 rounded-xl border border-[var(--border)] transition-colors font-bold text-sm flex items-center gap-1.5"
          >
            <Trash2 size={16} /> Clear Response
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleMarkReview}
            className="px-4 py-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-900/30 transition-colors font-bold text-sm flex items-center gap-1.5"
          >
            <Eye size={16} /> {isMarked ? 'Unmark Review' : 'Mark for Review & Next'}
          </button>

          <button 
            onClick={handleNext}
            disabled={currentIdx === questions.length - 1}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-bold text-sm flex items-center gap-1.5 shadow-lg shadow-blue-500/25 disabled:opacity-40"
          >
            Save & Next <ChevronRight size={16} />
          </button>
        </div>

        {/* Mobile Toggle Palette button */}
        <button 
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="lg:hidden p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)]"
        >
          <Menu size={20} />
        </button>
      </footer>

      {/* SUBMIT CONFIRMATION MODAL */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={28} />
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Submit Mock Test?</h3>
            </div>
            
            <p className="text-[var(--text-secondary)] mb-4 leading-relaxed">
              Are you sure you want to finish the test? Once submitted, you cannot change your answers.
            </p>

            <div className="bg-[var(--bg-surface)] p-4 border border-[var(--border)] rounded-xl space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Total Questions:</span>
                <span className="font-bold text-[var(--text-primary)]">{totalQs}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Answered:</span>
                <span className="font-bold text-green-500">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Marked for Review:</span>
                <span className="font-bold text-purple-400">{markedCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Not Answered / Visited:</span>
                <span className="font-bold text-yellow-500">{unattemptedCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Not Visited:</span>
                <span className="font-bold text-[var(--text-muted)]">{notVisitedCount}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowSubmitConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] font-bold rounded-xl transition-colors"
              >
                Back to Test
              </button>
              <button 
                onClick={() => triggerFinalSubmit(attempt.id)}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Yes, Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
