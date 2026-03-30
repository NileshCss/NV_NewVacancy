import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  scrapeURL,
  extractJobDataWithAI,
  uploadJobToSupabase,
  processAdminInstruction,
  getExpiringJobs,
} from '../../services/aiService'
import { supabase } from '../../services/supabase'

// Spinner animation style injected once
const SPIN_STYLE = `@keyframes ai-spin { to { transform: rotate(360deg); } }`

export default function AIAssistantPanel() {
  const { user } = useAuth()

  // ── URL Upload State ────────────────────────────────────
  const [examUrl,      setExamUrl]      = useState('')
  const [urlLoading,   setUrlLoading]   = useState(false)
  const [urlStep,      setUrlStep]      = useState('')
  const [extractedJob, setExtractedJob] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [urlError,     setUrlError]     = useState('')

  // ── AI Instruction State ────────────────────────────────
  const [instruction, setInstruction] = useState('')
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiResults,   setAiResults]   = useState([])
  const [aiError,     setAiError]     = useState('')

  // ── Expiring Jobs State ─────────────────────────────────
  const [expiringJobs, setExpiringJobs] = useState({ expired: [], expiringSoon: [] })
  const [jobsLoading,  setJobsLoading]  = useState(true)

  // ── Activity Log State ──────────────────────────────────
  const [activityLog, setActivityLog] = useState([])

  useEffect(() => {
    loadExpiringJobs()
    loadActivityLog()
  }, [])

  const loadExpiringJobs = async () => {
    setJobsLoading(true)
    try {
      const data = await getExpiringJobs()
      setExpiringJobs(data)
    } catch (_) {
      // silently fail — tables may not exist yet
    } finally {
      setJobsLoading(false)
    }
  }

  const loadActivityLog = async () => {
    try {
      const { data } = await supabase
        .from('ai_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setActivityLog(data || [])
    } catch (_) {}
  }

  // ── Handle URL Submission ───────────────────────────────
  const handleURLSubmit = async (e) => {
    e.preventDefault()
    if (!examUrl.trim()) return

    setUrlLoading(true)
    setUrlError('')
    setExtractedJob(null)
    setUploadResult(null)

    try {
      setUrlStep('🌐 Fetching webpage content...')
      const scraped = await scrapeURL(examUrl)

      setUrlStep('🤖 AI is reading and extracting job details...')
      const jobData = await extractJobDataWithAI(scraped.content, examUrl)
      setExtractedJob(jobData)

      setUrlStep('📤 Uploading to database...')
      const result = await uploadJobToSupabase(jobData, user.id)
      setUploadResult(result)
      setUrlStep('✅ Done!')

      await loadExpiringJobs()
      await loadActivityLog()
    } catch (err) {
      setUrlError(err.message)
      setUrlStep('')
    } finally {
      setUrlLoading(false)
    }
  }

  // ── Handle AI Instruction ───────────────────────────────
  const handleInstruction = async (e) => {
    e.preventDefault()
    if (!instruction.trim()) return

    setAiLoading(true)
    setAiError('')
    setAiResults([])

    try {
      const { data: allJobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)

      const results = await processAdminInstruction(instruction, allJobs || [], user.id)
      setAiResults(results)
      await loadExpiringJobs()
      await loadActivityLog()

      if (results.length === 0) {
        setAiError('AI could not find matching jobs. Try being more specific.')
      }
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  // ── Quick instruction templates ─────────────────────────
  const quickInstructions = [
    'Extend SSC CGL form fill date by 15 days',
    'Extend all expiring jobs last date by 7 days',
    'Set UPSC exam date to 2025-06-15',
    'Extend Railway RRB application deadline by 30 days',
    'Update IBPS PO form fill end date by 10 days',
  ]

  const todayStr = new Date().toISOString().split('T')[0]
  const aiActionsToday = activityLog.filter(l => l.created_at?.startsWith(todayStr)).length

  return (
    <div style={{ padding: 0 }}>
      <style>{SPIN_STYLE}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.5rem', fontWeight: 800,
          color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif',
          display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0,
        }}>
          🤖 AI Assistant
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem', marginBottom: 0 }}>
          Paste exam links → AI extracts &amp; uploads. Give instructions → AI updates dates.
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: '🔴', label: 'Expired Jobs',       value: expiringJobs.expired.length,    color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { icon: '⚠️', label: 'Expiring in 7 Days', value: expiringJobs.expiringSoon.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { icon: '🤖', label: 'AI Actions Today',   value: aiActionsToday,                  color: 'var(--brand)', bg: 'rgba(249,115,22,0.1)' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: stat.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color, fontFamily: 'Sora, sans-serif', lineHeight: 1 }}>
                {jobsLoading && stat.label !== 'AI Actions Today' ? '—' : stat.value}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── URL Upload + AI Instruction ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* URL Upload Box */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            🔗 Upload Job via URL
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
            Paste any exam/job notification link. AI will extract all details and upload to database automatically.
          </p>

          <form onSubmit={handleURLSubmit}>
            <input
              id="ai-exam-url"
              type="url"
              value={examUrl}
              onChange={e => setExamUrl(e.target.value)}
              placeholder="https://ssc.nic.in/notice/cgl-2024..."
              disabled={urlLoading}
              style={{
                width: '100%', padding: '0.8rem 1rem', boxSizing: 'border-box',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text-primary)', fontSize: '0.85rem',
                outline: 'none', marginBottom: '0.75rem',
              }}
            />
            <button
              id="ai-extract-btn"
              type="submit"
              disabled={urlLoading || !examUrl}
              style={{
                width: '100%', padding: '0.8rem',
                background: urlLoading ? 'var(--border)' : 'var(--brand)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: '0.88rem',
                cursor: urlLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', transition: 'all 0.2s',
              }}
            >
              {urlLoading
                ? <><Spinner />Processing...</>
                : '🤖 Extract & Upload'}
            </button>
          </form>

          {/* Progress */}
          {urlLoading && urlStep && (
            <div style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: 10, fontSize: '0.82rem', color: 'var(--brand)', fontWeight: 600,
            }}>
              {urlStep}
            </div>
          )}

          {/* Error */}
          {urlError && (
            <div style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, fontSize: '0.82rem', color: '#ef4444',
            }}>
              ❌ {urlError}
            </div>
          )}

          {/* Extracted preview */}
          {extractedJob && (
            <div style={{
              marginTop: '1rem', padding: '1rem',
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 12,
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c55e', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ✅ AI Extracted
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {extractedJob.title}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {extractedJob.organization}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.6rem' }}>
                {[
                  ['Vacancies', extractedJob.vacancies || 'N/A'],
                  ['Last Date', extractedJob.last_date || 'N/A'],
                  ['Category',  extractedJob.category],
                  ['Location',  extractedJob.location || 'N/A'],
                ].map(([k, v]) => (
                  <div key={k} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                AI Confidence: {Math.round((extractedJob.confidence || 0) * 100)}%
              </div>
            </div>
          )}

          {/* Upload result */}
          {uploadResult && (
            <div style={{
              marginTop: '0.75rem', padding: '0.75rem 1rem',
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 10, fontSize: '0.82rem', color: '#3b82f6', fontWeight: 600,
            }}>
              🚀 Job {uploadResult.action} successfully in database!
            </div>
          )}
        </div>

        {/* AI Instruction Box */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            💬 AI Date Manager
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
            Type a natural language instruction. AI will find the matching job and update dates automatically.
          </p>

          {/* Quick templates */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Quick Instructions:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {quickInstructions.map((qi, i) => (
                <button
                  key={i}
                  onClick={() => setInstruction(qi)}
                  style={{
                    fontSize: '0.7rem', padding: '0.25rem 0.6rem',
                    background: 'var(--white-5)', border: '1px solid var(--border)',
                    borderRadius: 999, color: 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                  }}
                >
                  {qi}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleInstruction}>
            <textarea
              id="ai-instruction-input"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder={'Example:\n"Extend SSC CGL form fill date by 15 days"\n"Set UPSC exam date to June 15 2025"\n"Extend all expiring jobs by 7 days"'}
              rows={4}
              disabled={aiLoading}
              style={{
                width: '100%', padding: '0.8rem 1rem', boxSizing: 'border-box',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text-primary)', fontSize: '0.85rem',
                outline: 'none', resize: 'vertical', fontFamily: 'DM Sans, sans-serif',
                marginBottom: '0.75rem',
              }}
            />
            <button
              id="ai-execute-btn"
              type="submit"
              disabled={aiLoading || !instruction.trim()}
              style={{
                width: '100%', padding: '0.8rem',
                background: aiLoading ? 'var(--border)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: '0.88rem',
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {aiLoading ? <><Spinner />AI Processing...</> : '✨ Execute Instruction'}
            </button>
          </form>

          {/* AI Error */}
          {aiError && (
            <div style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, fontSize: '0.82rem', color: '#ef4444',
            }}>
              ❌ {aiError}
            </div>
          )}

          {/* AI Results */}
          {aiResults.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                AI Updated {aiResults.length} job(s):
              </div>
              {aiResults.map((result, i) => (
                <div key={i} style={{
                  padding: '0.75rem',
                  background: result.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${result.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 10, marginBottom: '0.5rem', fontSize: '0.8rem',
                }}>
                  <div style={{ fontWeight: 700, color: result.success ? '#22c55e' : '#ef4444', marginBottom: '0.25rem' }}>
                    {result.success ? '✅' : '❌'} {result.job_title}
                  </div>
                  {result.success && result.reason && (
                    <div style={{ color: 'var(--text-muted)' }}>{result.reason}</div>
                  )}
                  {!result.success && (
                    <div style={{ color: '#ef4444' }}>{result.error}</div>
                  )}
                  {result.success && result.updates && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {Object.entries(result.updates).map(([k, v]) => (
                        <span key={k} style={{
                          fontSize: '0.7rem', background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                          padding: '0.15rem 0.5rem', borderRadius: 999, border: '1px solid rgba(34,197,94,0.2)',
                        }}>
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Date Monitor ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            📅 Date Monitor
          </h3>
          <button
            onClick={loadExpiringJobs}
            style={{
              fontSize: '0.78rem', padding: '0.35rem 0.75rem',
              background: 'var(--white-5)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* Expired */}
        {expiringJobs.expired.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              🔴 Expired ({expiringJobs.expired.length})
            </div>
            {expiringJobs.expired.slice(0, 5).map(job => (
              <JobRow key={job.id} job={job} color="#ef4444" bg="rgba(239,68,68,0.05)" border="rgba(239,68,68,0.15)"
                dateLabel="Expired" dateField="last_date" btnColor="var(--brand)" btnBg="rgba(249,115,22,0.1)" btnBorder="rgba(249,115,22,0.3)"
                onExtend={() => setInstruction(`Extend ${job.title} last date by 15 days`)} />
            ))}
          </div>
        )}

        {/* Expiring soon */}
        {expiringJobs.expiringSoon.length > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              ⚠️ Expiring Soon ({expiringJobs.expiringSoon.length})
            </div>
            {expiringJobs.expiringSoon.map(job => (
              <JobRow key={job.id} job={job} color="#f59e0b" bg="rgba(245,158,11,0.05)" border="rgba(245,158,11,0.15)"
                dateLabel="Last Date" dateField="last_date" btnColor="#f59e0b" btnBg="rgba(245,158,11,0.1)" btnBorder="rgba(245,158,11,0.3)"
                onExtend={() => setInstruction(`Extend ${job.title} last date by 7 days`)} />
            ))}
          </div>
        )}

        {!jobsLoading && expiringJobs.expired.length === 0 && expiringJobs.expiringSoon.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            ✅ All jobs have valid dates
          </div>
        )}
      </div>

      {/* ── Activity Log ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
          📋 AI Activity Log
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Action', 'Status', 'Time'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '0.5rem 0.75rem',
                    fontSize: '0.72rem', color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activityLog.map(log => (
                <tr key={log.id}>
                  <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {log.action_type === 'extract_and_upload' ? '🔗 URL Extract & Upload' : '💬 Date Extension'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700,
                      padding: '0.2rem 0.5rem', borderRadius: 999,
                      background: log.status === 'success' ? 'rgba(34,197,94,0.1)' : log.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                      color: log.status === 'success' ? '#22c55e' : log.status === 'failed' ? '#ef4444' : '#f59e0b',
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              {activityLog.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No AI activity yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'ai-spin 0.8s linear infinite',
    }} />
  )
}

function JobRow({ job, color, bg, border, dateLabel, dateField, btnColor, btnBg, btnBorder, onExtend }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.6rem 0.75rem', background: bg, border: `1px solid ${border}`,
      borderRadius: 10, marginBottom: '0.4rem',
    }}>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {job.title}
        </div>
        <div style={{ fontSize: '0.75rem', color }}>
          {dateLabel}: {job[dateField]}
        </div>
      </div>
      <button
        onClick={onExtend}
        style={{
          fontSize: '0.72rem', padding: '0.3rem 0.6rem',
          background: btnBg, border: `1px solid ${btnBorder}`,
          borderRadius: 8, color: btnColor, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Extend →
      </button>
    </div>
  )
}
