import React, { useState, useEffect } from 'react'
import { useRouter } from '../../context/RouterContext'
import { fetchMockTestResult, fetchMockTestLeaderboard } from '../../services/api'
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, Award, BarChart2, BookOpen, Share2, Printer, ChevronDown, ChevronRight, HelpCircle, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MockTestResult() {
  const { page, navigate } = useRouter()
  // URL format: "mock-tests/result/:attemptId"
  const attemptId = page.split('/')[2]

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null) // { attempt, questions }
  const [leaderboard, setLeaderboard] = useState(null) // { leaderboard, studentRank }

  // Solutions filter
  const [solutionFilter, setSolutionFilter] = useState('all') // all | correct | incorrect | unattempted | marked
  const [expandedQ, setExpandedQ] = useState({}) // maps index -> boolean

  useEffect(() => {
    async function loadResultData() {
      try {
        setLoading(true)
        const res = await fetchMockTestResult(attemptId)
        if (res) {
          setData(res)
          
          // Load leaderboard for this test
          const lb = await fetchMockTestLeaderboard(res.attempt.mock_test_id)
          setLeaderboard(lb)
        } else {
          throw new Error('Result not found')
        }
      } catch (err) {
        setError(err.message || 'Failed to load results')
      } finally {
        setLoading(false)
      }
    }

    loadResultData()
  }, [attemptId])

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center">
      <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Error</h2>
      <p className="text-[var(--text-muted)] mb-6">{error}</p>
      <button onClick={() => navigate('mock-tests')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors">
        Back to Mock Tests
      </button>
    </div>
  )

  const { attempt, questions } = data
  const test = attempt.mock_tests

  // Format time taken
  const formatSeconds = (totalSecs) => {
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    return `${m}m ${s}s`
  }

  // Filtered questions
  const filteredQuestions = questions.filter(q => {
    const isAns = q.student_answer?.selected_answer !== null && q.student_answer?.selected_answer !== undefined
    const isCorr = q.student_answer?.is_correct === true
    const isMarked = q.student_answer?.marked_for_review === true

    if (solutionFilter === 'correct') return isAns && isCorr
    if (solutionFilter === 'incorrect') return isAns && !isCorr
    if (solutionFilter === 'unattempted') return !isAns
    if (solutionFilter === 'marked') return isMarked
    return true
  })

  // Group questions by subject to calculate performance per subject
  const subjectPerformance = {}
  questions.forEach(q => {
    // Attempt to extract subject name from tags or fallback to test subject
    const subjectName = test.subjects?.name || 'General'
    if (!subjectPerformance[subjectName]) {
      subjectPerformance[subjectName] = { correct: 0, total: 0 }
    }
    subjectPerformance[subjectName].total++
    if (q.student_answer?.is_correct) {
      subjectPerformance[subjectName].correct++
    }
  })

  // Identify slowest questions (time spent > 0)
  const slowestQuestions = [...questions]
    .filter(q => q.student_answer?.time_spent_seconds > 0)
    .sort((a, b) => (b.student_answer?.time_spent_seconds || 0) - (a.student_answer?.time_spent_seconds || 0))
    .slice(0, 5)

  // WhatsApp share result
  const handleShareWhatsApp = () => {
    const msg = `🎉 I just completed the mock test "${test.name}" on NewVacancy!\n📝 Score: ${attempt.score}/${test.total_marks}\n🎯 Accuracy: ${(attempt.accuracy_ratio * 100).toFixed(0)}%\n🏆 Rank: #${attempt.rank || 1} out of ${attempt.total_test_takers || 1} candidates.\n\nPractice and compare your rank on NewVacancy now!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // Print PDF Scorecard
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 print:p-0 print:max-w-full">
      {/* HEADER SECTION */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-6 md:p-8 border border-[var(--border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:border-none print:shadow-none print:bg-white print:text-black">
        <div>
          <span className="px-3 py-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider print:hidden">
            ✓ Mock Test Completed
          </span>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mt-3 print:text-black print:text-2xl">{test.name}</h1>
          <p className="text-[var(--text-secondary)] mt-1 print:text-slate-500">
            Attempted on {new Date(attempt.completed_at || attempt.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex gap-3 print:hidden">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] font-bold rounded-xl transition-colors text-sm"
          >
            <Printer size={16} /> Download PDF
          </button>
          
          <button 
            onClick={handleShareWhatsApp}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all text-sm shadow-md shadow-green-500/20"
          >
            <Share2 size={16} /> Share on WhatsApp
          </button>
        </div>
      </div>

      {/* METRICS DASHBOARD CARD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Score */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] text-center print:bg-slate-50">
          <Award className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] print:text-slate-500">Your Score</div>
          <div className="text-3xl font-extrabold text-[var(--text-primary)] mt-1 print:text-black">
            {attempt.score} <span className="text-sm font-normal text-[var(--text-muted)]">/ {test.total_marks}</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">Passing: {test.passing_marks || '—'}</div>
        </div>

        {/* Accuracy */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] text-center print:bg-slate-50">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] print:text-slate-500">Accuracy</div>
          <div className="text-3xl font-extrabold text-[var(--text-primary)] mt-1 print:text-black">
            {(attempt.accuracy_ratio * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Correct: {attempt.total_correct} | Incorrect: {attempt.total_incorrect}
          </div>
        </div>

        {/* Rank */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] text-center print:bg-slate-50">
          <BarChart2 className="w-8 h-8 text-purple-500 mx-auto mb-2" />
          <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] print:text-slate-500">Rank / Percentile</div>
          <div className="text-3xl font-extrabold text-[var(--text-primary)] mt-1 print:text-black">
            #{attempt.rank || 1} <span className="text-sm font-normal text-[var(--text-muted)]">/ {attempt.total_test_takers || 1}</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Percentile: {attempt.percentile || 100}%
          </div>
        </div>

        {/* Time Taken */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] text-center print:bg-slate-50">
          <Clock className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] print:text-slate-500">Time Taken</div>
          <div className="text-3xl font-extrabold text-[var(--text-primary)] mt-1 print:text-black">
            {formatSeconds(attempt.time_taken_seconds || 0)}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Limit: {test.duration_minutes}m | Tab switches: {attempt.tab_switch_count || 0}
          </div>
        </div>
      </div>

      {/* DETAILED STATS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance by Subject */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] print:bg-white">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2 print:text-black">
              <BarChart2 className="text-blue-500" /> Subject-wise Breakdown
            </h2>
            
            <div className="space-y-4">
              {Object.entries(subjectPerformance).map(([subject, stats]) => {
                const ratio = stats.total > 0 ? stats.correct / stats.total : 0
                return (
                  <div key={subject}>
                    <div className="flex justify-between text-sm font-semibold text-[var(--text-secondary)] mb-1">
                      <span>{subject}</span>
                      <span>{stats.correct}/{stats.total} Correct ({(ratio * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-[var(--bg-surface)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                      <div 
                        className="bg-blue-500 h-full rounded-full" 
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Time analysis (Slowest Questions) */}
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] print:hidden">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Clock className="text-yellow-500" /> Slowest Questions (Time Analysis)
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">Review the questions where you spent the most time. Optimize your speed here.</p>
            
            <div className="space-y-3">
              {slowestQuestions.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] text-center py-4">No timing logs recorded.</div>
              ) : (
                slowestQuestions.map((q, idx) => {
                  const isCorr = q.student_answer?.is_correct
                  return (
                    <div key={q.id} className="flex justify-between items-center p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl hover:border-blue-500/50 transition">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-blue-500">Question {q.display_order + 1}</div>
                        <div className="text-sm font-medium text-[var(--text-primary)] line-clamp-1 mt-0.5">{q.question_text}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                          {formatSeconds(q.student_answer.time_spent_seconds)}
                        </span>
                        {isCorr ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-red-400" />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Leaderboard Panel */}
        <div className="lg:col-span-1 space-y-6 print:hidden">
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
              <Award className="text-yellow-500" /> Top Rankers Leaderboard
            </h2>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {leaderboard?.leaderboard?.map((att, index) => {
                const isMe = att.student_id === attempt.student_id
                return (
                  <div 
                    key={att.student_id} 
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      isMe 
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 text-[var(--text-primary)] font-bold'
                        : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' : index === 1 ? 'bg-slate-300 text-slate-800' : index === 2 ? 'bg-amber-600 text-white' : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)]'
                      }`}>
                        {att.rank}
                      </span>
                      <span className="text-sm truncate">{att.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[var(--text-primary)]">{att.score} pts</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">{formatSeconds(att.time_taken_seconds)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* My Rank Footer */}
            {leaderboard?.studentRank && (
              <div className="mt-4 pt-4 border-t border-[var(--border)] text-center text-sm text-[var(--text-primary)]">
                You ranked <span className="font-extrabold text-blue-500">#{leaderboard.studentRank.rank}</span> out of <span className="font-bold">{leaderboard.studentRank.total_test_takers}</span> candidates!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SOLUTIONS & REVIEW PANEL */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-6 md:p-8 border border-[var(--border)] print:border-none print:shadow-none print:bg-white print:text-black">
        <h2 className="text-2xl font-extrabold text-[var(--text-primary)] mb-6 flex items-center gap-2 print:text-black">
          <BookOpen className="text-blue-500" /> Solutions & Explanations Review
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4 mb-6 print:hidden">
          {[
            { id: 'all', label: 'All Questions' },
            { id: 'correct', label: 'Correct' },
            { id: 'incorrect', label: 'Incorrect' },
            { id: 'unattempted', label: 'Unattempted' },
            { id: 'marked', label: 'Marked for Review' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSolutionFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                solutionFilter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--border)]/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-6">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">No questions matched your filter.</div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isOpen = expandedQ[idx] !== false // Default open
              const ans = q.student_answer
              const isCorrect = ans?.is_correct
              const isUnattempted = !ans || ans.selected_answer === null || ans.selected_answer === undefined
              
              let statusBorder = 'border-yellow-500/50'
              if (isCorrect) statusBorder = 'border-green-600/50'
              else if (!isUnattempted && !isCorrect) statusBorder = 'border-red-500/50'

              return (
                <div key={q.id} className={`border rounded-2xl bg-[var(--bg-surface)]/20 overflow-hidden ${statusBorder} print:border-slate-200`}>
                  {/* Header summary row click to toggle */}
                  <button 
                    onClick={() => setExpandedQ(prev => ({ ...prev, [idx]: !isOpen }))}
                    className="w-full flex justify-between items-center p-4 hover:bg-[var(--border)]/30 text-left transition print:pointer-events-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-blue-500">Question {q.display_order + 1}</span>
                        <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] font-bold">
                          {q.question_type}
                        </span>
                        {isCorrect ? (
                          <span className="px-2 py-0.5 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30 rounded-lg text-[10px] font-bold">
                            Correct
                          </span>
                        ) : isUnattempted ? (
                          <span className="px-2 py-0.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-900/30 rounded-lg text-[10px] font-bold">
                            Unattempted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-lg text-[10px] font-bold">
                            Incorrect
                          </span>
                        )}
                        {ans?.marked_for_review && (
                          <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 rounded-lg text-[10px] font-bold">
                            Marked
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-[var(--text-primary)] mt-1.5 line-clamp-1 print:line-clamp-none print:text-black">
                        {q.question_text}
                      </div>
                    </div>

                    <div className="print:hidden ml-4">
                      {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </button>

                  {/* Body solutions detail */}
                  {isOpen && (
                    <div className="p-4 pt-0 border-t border-[var(--border)] bg-[var(--bg-card)]/50 print:border-slate-200 print:text-black">
                      <div className="mt-4 text-base text-[var(--text-primary)] whitespace-pre-wrap font-medium leading-relaxed mb-6 print:text-black">
                        {q.question_text}
                      </div>

                      {q.code_block && (
                        <pre className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 rounded-xl font-mono text-xs text-[var(--text-primary)] overflow-x-auto mb-6 print:bg-slate-50 print:text-slate-800">
                          <code>{q.code_block}</code>
                        </pre>
                      )}

                      {q.image_url && (
                        <div className="border border-[var(--border)] rounded-xl overflow-hidden max-w-md bg-white mb-6">
                          <img src={q.image_url} alt="Question figure" className="w-full h-auto object-contain" />
                        </div>
                      )}

                      {/* Options breakdown */}
                      <div className="space-y-3 mb-6">
                        {Array.isArray(q.options) && q.options.map((opt, optIdx) => {
                          const isCorrectOpt = q.correct_answer?.indices?.includes(optIdx)
                          const isStudentSelected = ans?.selected_answer === optIdx
                          const letter = String.fromCharCode(65 + optIdx)
                          
                          let optStyle = 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                          let labelStyle = 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)]'
                          
                          if (isCorrectOpt) {
                            optStyle = 'border-green-600 bg-green-50/20 text-green-700 dark:text-green-400'
                            labelStyle = 'bg-green-600 text-white border-green-600'
                          } else if (isStudentSelected) {
                            optStyle = 'border-red-500 bg-red-50/20 text-red-700 dark:text-red-400'
                            labelStyle = 'bg-red-500 text-white border-red-500'
                          }

                          return (
                            <div 
                              key={optIdx}
                              className={`p-3 rounded-xl border-2 flex items-start gap-4 text-sm font-medium ${optStyle}`}
                            >
                              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${labelStyle}`}>
                                {letter}
                              </span>
                              <div className="flex-1">
                                <span>{opt}</span>
                                {isCorrectOpt && <span className="ml-2 text-xs font-bold text-green-600 dark:text-green-400">(Correct Answer)</span>}
                                {isStudentSelected && !isCorrectOpt && <span className="ml-2 text-xs font-bold text-red-500">(Your Selection)</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Explanation */}
                      {(q.explanation || q.solution_text) && (
                        <div className="bg-[var(--bg-surface)] p-4 border border-[var(--border)] rounded-2xl print:bg-slate-50 print:border-slate-200">
                          <h4 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-1.5 print:text-black">
                            💡 Explanation & Solution:
                          </h4>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap print:text-slate-800">
                            {q.explanation || q.solution_text}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
      
      {/* Back button */}
      <div className="text-center pt-4 print:hidden">
        <button 
          onClick={() => navigate('mock-tests')}
          className="px-6 py-3 bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl font-bold transition"
        >
          ← Back to Mock Tests Directory
        </button>
      </div>

      {/* Global CSS for Print Media */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, header, footer, .print\\:hidden {
            display: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:bg-white {
            background: white !important;
          }
          .print\\:bg-slate-50 {
            background: #f8fafc !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:text-slate-800 {
            color: #1e293b !important;
          }
          .print\\:text-slate-500 {
            color: #64748b !important;
          }
        }
      `}</style>
    </div>
  )
}
