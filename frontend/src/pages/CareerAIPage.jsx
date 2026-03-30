import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { fetchJobsForAI } from '../services/api'
import { extractResumeText, analyzeResumeWithAI } from '../services/careerAI'
import AIResultsDashboard from '../components/career/AIResultsDashboard'

const ACCEPTED = '.pdf,.doc,.docx,.txt'

// Progress stages with percentage for the progress bar
const STAGES = [
  { key: 'read',    label: '📄 Reading resume & fetching jobs...',         pct: 20 },
  { key: 'parse',   label: '🧠 AI parsing resume structure...',             pct: 45 },
  { key: 'match',   label: '🤖 Matching against live job listings...',      pct: 70 },
  { key: 'process', label: '📊 Processing & scoring results...',            pct: 90 },
  { key: 'done',    label: '✅ Almost done...',                             pct: 99 },
]

export default function CareerAIPage() {
  const { user } = useAuth()
  const { navigate } = useRouter()

  const [file,        setFile]        = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [progress,    setProgress]    = useState('')
  const [pct,         setPct]         = useState(0)
  const [elapsed,     setElapsed]     = useState(0)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [targetTitle, setTargetTitle] = useState('')
  const [prefLoc,     setPrefLoc]     = useState('')
  const [prefCat,     setPrefCat]     = useState('')
  const inputRef  = useRef(null)
  const timerRef  = useRef(null)
  const startRef  = useRef(null)

  // Elapsed time counter during analysis
  useEffect(() => {
    if (loading) {
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
      setElapsed(0)
      setPct(0)
    }
    return () => clearInterval(timerRef.current)
  }, [loading])

  const updateProgress = (stage) => {
    const s = STAGES.find(x => x.key === stage) || STAGES[0]
    setProgress(s.label)
    setPct(s.pct)
  }

  /* ── File handling ─────────────────────────────────────── */
  const onFile = (f) => {
    if (!f) return
    const ok = ['pdf','doc','docx','txt'].some(ext => f.name.toLowerCase().endsWith(ext))
    if (!ok) { setError('Please upload a PDF, DOCX, or TXT file.'); return }
    if (f.size > 5 * 1024 * 1024) { setError('File must be under 5 MB.'); return }
    setFile(f); setError(''); setResult(null)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    onFile(e.dataTransfer.files[0])
  }

  /* ── Main analysis ─────────────────────────────────────── */
  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true); setError(''); setResult(null)

    try {
      updateProgress('read')

      // ✅ Run PDF extraction + job fetch IN PARALLEL — saves 3-5 seconds
      const [text, jobs] = await Promise.all([
        extractResumeText(file),
        fetchJobsForAI(prefCat || null),
      ])

      if (!text || text.length < 50)
        throw new Error('Could not extract text from file. Try a different format.')

      updateProgress('parse')

      const targetJob = targetTitle.trim()
        ? jobs.find(j => j.title.toLowerCase().includes(targetTitle.toLowerCase())) || null
        : null

      const prefs = (prefLoc || prefCat)
        ? { preferred_location: prefLoc || null, preferred_category: prefCat || null }
        : null

      updateProgress('match')

      const data = await analyzeResumeWithAI({
        resumeText: text,
        jobs,
        targetJob,
        userPreferences: prefs,
        onProgress: (msg) => {
          if (msg.includes('Processing')) updateProgress('process')
          else if (msg.includes('AI')) updateProgress('match')
        },
      })

      updateProgress('done')
      setResult(data)
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.')
    } finally {
      setLoading(false); setProgress('')
    }
  }

  /* ── Render ───────────────────────────────────────────── */
  if (result) return <AIResultsDashboard result={result} onReset={() => setResult(null)} />

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {/* bg glow */}
      <div style={{ position: 'absolute', top: '-200px', right: '-200px', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-100px', left: '-100px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="container" style={{ padding: '3rem 1.25rem', position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 700, padding: '0.4rem 1rem', borderRadius: 999, marginBottom: '1.25rem', letterSpacing: '0.04em' }}>
            🤖 NV-AI Career Intelligence System v2.0
          </div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.15 }}>
            AI-Powered{' '}
            <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Resume Analyzer
            </span>
            {' '}&amp; Job Matcher
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>
            Upload your resume → AI parses it, matches it against live job listings, calculates your ATS score, and gives personalized career advice.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
            {['🎯 Smart Job Matching','📊 ATS Score Engine','💡 Improvement Tips','🇮🇳 India Market Insights'].map(f => (
              <span key={f} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.35rem 0.8rem', background: 'var(--white-5)', border: '1px solid var(--border)', borderRadius: 999, color: 'var(--text-secondary)' }}>{f}</span>
            ))}
          </div>
        </div>

        {/* ── Main Card ── */}
        <div style={{ maxWidth: 760, margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 24, padding: '2.5rem', backdropFilter: 'blur(12px)' }}>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#6366f1' : file ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
              borderRadius: 18, padding: '2.5rem 1.5rem',
              textAlign: 'center', cursor: file ? 'default' : 'pointer',
              background: dragOver ? 'rgba(99,102,241,0.06)' : file ? 'rgba(99,102,241,0.04)' : 'var(--white-5)',
              transition: 'all 0.2s', marginBottom: '1.75rem',
            }}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} style={{ display: 'none' }} onChange={e => onFile(e.target.files[0])} />

            {file ? (
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{file.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  {(file.size / 1024).toFixed(1)} KB · {file.name.split('.').pop().toUpperCase()}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setError('') }}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', cursor: 'pointer' }}>
                  ✕ Remove
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📎</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>Drop your resume here</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>or click to browse — PDF, DOCX, TXT up to 5MB</div>
                <button style={{ fontSize: '0.84rem', fontWeight: 700, padding: '0.6rem 1.4rem', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                  Choose File
                </button>
              </div>
            )}
          </div>

          {/* Optional inputs row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                🎯 Target Job (optional)
              </label>
              <input value={targetTitle} onChange={e => setTargetTitle(e.target.value)}
                placeholder="e.g. Software Engineer, SSC CGL..."
                style={{ width: '100%', padding: '0.7rem 1rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                📍 Preferred Location (optional)
              </label>
              <input value={prefLoc} onChange={e => setPrefLoc(e.target.value)}
                placeholder="e.g. Bengaluru, Delhi, Remote..."
                style={{ width: '100%', padding: '0.7rem 1rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Category preference */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
            {[['', 'All Jobs'], ['govt', '🏛️ Government'], ['private', '🏢 Private']].map(([val, label]) => (
              <button key={val} onClick={() => setPrefCat(val)}
                style={{ padding: '0.5rem 1rem', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, border: '1px solid', cursor: 'pointer',
                  background: prefCat === val ? 'rgba(99,102,241,0.12)' : 'var(--white-5)',
                  borderColor: prefCat === val ? 'rgba(99,102,241,0.4)' : 'var(--border)',
                  color: prefCat === val ? '#a5b4fc' : 'var(--text-secondary)',
                  transition: 'all 0.2s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, fontSize: '0.85rem', color: '#ef4444' }}>
              ❌ {error}
            </div>
          )}

          {/* Progress */}
          {loading && (
            <div style={{ marginBottom: '1.25rem', padding: '1.25rem', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 18, height: 18, border: '2.5px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#a5b4fc' }}>{progress}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {elapsed}s elapsed
                </span>
              </div>
              {/* Real progress bar */}
              <div style={{ height: 6, background: 'rgba(99,102,241,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                  borderRadius: 3,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span>Start</span>
                <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{pct}%</span>
                <span>Done</span>
              </div>
            </div>
          )}


          {/* Analyze button */}
          <button
            id="analyze-resume-btn"
            onClick={handleAnalyze}
            disabled={!file || loading}
            style={{
              width: '100%', padding: '1rem', fontWeight: 800, fontSize: '1rem',
              background: !file || loading ? 'var(--border)' : 'linear-gradient(135deg,#6366f1,#a855f7)',
              color: !file || loading ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 14, cursor: !file || loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
              transition: 'all 0.25s', fontFamily: 'Sora, sans-serif',
              boxShadow: !file || loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
            }}
          >
            {loading ? '⏳ Analyzing...' : '🤖 Analyze Resume & Match Jobs'}
          </button>

          {!user && (
            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              <span onClick={() => navigate('login')} style={{ color: '#a5b4fc', cursor: 'pointer', fontWeight: 600 }}>Sign in</span> to save your analysis history
            </p>
          )}
        </div>

        {/* ── How it works ── */}
        <div style={{ maxWidth: 760, margin: '2.5rem auto 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem' }}>
          {[
            { icon: '📄', step: '1', title: 'Upload Resume', desc: 'PDF, DOCX, or TXT supported' },
            { icon: '🧠', step: '2', title: 'AI Parses', desc: 'Extracts skills, experience & keywords' },
            { icon: '🎯', step: '3', title: 'Job Matching', desc: 'Scored against live job listings' },
            { icon: '📊', step: '4', title: 'ATS Analysis', desc: 'Get your real ATS score + tips' },
          ].map(s => (
            <div key={s.step} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{s.icon}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Step {s.step}</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: '0.25rem' }}>{s.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
