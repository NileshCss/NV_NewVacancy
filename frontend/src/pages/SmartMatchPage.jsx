import { useState, useRef, useCallback } from 'react'
import { useSmartMatch } from '../hooks/useSmartMatch'

// ── Constants (hoisted — never re-created on render) ──
const C = { brand:'#f97316', green:'#22c55e', red:'#ef4444', yellow:'#f59e0b', purple:'#8b5cf6', blue:'#3b82f6' }
const ALLOWED_EXTS  = new Set(['pdf','docx','doc','txt'])
const ALLOWED_MIMES = new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain'])
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_JD_CHARS   = 8000
const ANALYSIS_MODES = [{v:'full',l:'🧠 Full Analysis'},{v:'ats_only',l:'📊 ATS Only'},{v:'skill_gap',l:'🛠 Skill Gap'},{v:'rewrite',l:'✍️ Rewrite'}]
const TABS = [{id:'summary',icon:'🎯',label:'Summary'},{id:'ats',icon:'📊',label:'ATS Score'},{id:'jobs',icon:'💼',label:'Matches'},{id:'gaps',icon:'🛠',label:'Skill Gap'},{id:'tips',icon:'💡',label:'Improve'},{id:'rewrite',icon:'✍️',label:'Rewrite'}]

/** Safe clipboard copy — returns a promise; never throws. */
async function safeClip(text) {
  try { await navigator.clipboard.writeText(text); return true }
  catch { return false }
}

// ── Reusable: Score Ring ──────────────────────────────
function ScoreRing({ score = 0, size = 120, color = C.brand, label }) {
  const r    = size / 2 - 10
  const circ = 2 * Math.PI * r
  const dash = Math.min(100, Math.max(0, score)) / 100 * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border,rgba(255,255,255,0.1))" strokeWidth="8" />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: 'stroke-dasharray 1.2s ease', filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 900, fontSize: size > 100 ? '1.75rem' : '1.1rem', color: 'var(--text-primary,#e2e8f0)', lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted,#64748b)' }}>/100</span>
        </div>
      </div>
      {label && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary,#94a3b8)', textAlign: 'center' }}>{label}</span>}
    </div>
  )
}

// ── Reusable: Progress Bar (value clamped 0–100) ────────────
function Bar({ value = 0, color = C.brand, label, weight }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div style={{ marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--text-secondary,#94a3b8)', fontWeight: 600 }}>
          {label}
          {weight && <span style={{ color: 'var(--text-muted,#64748b)', marginLeft: '0.3rem', fontSize: '0.7rem' }}>({weight})</span>}
        </span>
        <span style={{ color, fontWeight: 800 }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--border,rgba(255,255,255,0.08))', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: `linear-gradient(90deg,${color},${color}cc)`, transition: 'width 1s ease', boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  )
}

// ── Reusable: Skill Chip ──────────────────────────────
function Chip({ label, type = 'neutral' }) {
  const styles = {
    match:   { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   text: C.green  },
    missing: { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: C.red    },
    neutral: { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', text: '#94a3b8' },
    brand:   { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  text: C.brand  },
  }
  const s = styles[type] || styles.neutral
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: '999px', background: s.bg, border: `1px solid ${s.border}`, color: s.text, whiteSpace: 'nowrap', margin: '0.2rem' }}>
      {type === 'match' && '✓ '}
      {type === 'missing' && '✗ '}
      {label}
    </span>
  )
}

// ── Reusable: Recommendation Card ──────────────────────
const REC_COLORS = {
  critical: { border:'rgba(239,68,68,0.3)',   bg:'rgba(239,68,68,0.05)',   badge:'🔴 Critical', badgeColor:C.red    },
  high:     { border:'rgba(245,158,11,0.3)',  bg:'rgba(245,158,11,0.05)',  badge:'🟡 High',     badgeColor:C.yellow },
  medium:   { border:'rgba(148,163,184,0.2)', bg:'rgba(148,163,184,0.03)', badge:'🔵 Medium',  badgeColor:'#94a3b8' },
}
function RecCard({ rec }) {
  if (!rec) return null
  const c     = REC_COLORS[rec.severity] || REC_COLORS.medium
  const boost = Number(rec.score_boost) || 0
  return (
    <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:'14px', padding:'1.1rem 1.25rem', marginBottom:'0.75rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem', flexWrap:'wrap', gap:'0.4rem' }}>
        <span style={{ fontSize:'0.78rem', fontWeight:700, color:c.badgeColor }}>{c.badge}</span>
        {boost > 0 && <span style={{ fontSize:'0.7rem', fontWeight:700, color:C.green, background:'rgba(34,197,94,0.1)', padding:'0.15rem 0.5rem', borderRadius:'999px', border:'1px solid rgba(34,197,94,0.2)' }}>+{boost} pts</span>}
      </div>
      <div style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--text-primary,#e2e8f0)', marginBottom:'0.35rem' }}>{rec.title}</div>
      {rec.before && <div style={{ fontSize:'0.78rem', color:C.red, background:'rgba(239,68,68,0.06)', borderRadius:'8px', padding:'0.4rem 0.6rem', marginBottom:'0.35rem', fontFamily:'monospace' }}><strong>Before:</strong> {rec.before}</div>}
      {rec.after  && <div style={{ fontSize:'0.78rem', color:C.green, background:'rgba(34,197,94,0.06)', borderRadius:'8px', padding:'0.4rem 0.6rem', marginBottom:'0.35rem', fontFamily:'monospace' }}><strong>After:</strong> {rec.after}</div>}
      <div style={{ fontSize:'0.82rem', color:'var(--text-secondary,#94a3b8)' }}>{rec.description}</div>
    </div>
  )
}

// ── MAIN PAGE ───────────────────────────────────────────────────
export default function SmartMatchPage() {
  const { step, progress, stepLabel, result, error, activeTab, setActiveTab, analyze, reset } = useSmartMatch()
  const fileRef = useRef(null)
  const [file,     setFile]     = useState(null)
  const [fileErr,  setFileErr]  = useState('')
  const [jobDesc,  setJobDesc]  = useState('')
  const [mode,     setMode]     = useState('full')
  const [dragging, setDragging] = useState(false)
  const [clipMsg,  setClipMsg]  = useState('')

  const copyText = useCallback(async (text) => {
    const ok = await safeClip(text)
    setClipMsg(ok ? 'Copied!' : 'Copy failed — select manually.')
    setTimeout(() => setClipMsg(''), 2200)
  }, [])

  /** Validate by extension + MIME; show inline error instead of alert(). */
  const handleFile = useCallback((f) => {
    setFileErr('')
    if (!f) return
    const ext  = f.name.split('.').pop().toLowerCase()
    const mime = f.type || ''
    if (!ALLOWED_EXTS.has(ext) || (mime && !ALLOWED_MIMES.has(mime))) {
      setFileErr('Only PDF, DOCX, DOC, or TXT files are accepted.')
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileErr('File exceeds 5 MB. Please compress or trim it.')
      return
    }
    setFile(f)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }, [handleFile])

  // ─ IDLE ─────────────────────────────────────────────
  if (step === 'idle') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base,#0f172a)' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--bg-base,#0f172a),var(--bg-surface,#162032))', borderBottom: '1px solid var(--border,rgba(255,255,255,0.08))', padding: '3rem 0 2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '999px', padding: '0.35rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: C.brand, marginBottom: '1rem' }}>
          🧠 SmartMatch™ Engine v2.0
        </div>
        <h1 style={{ fontFamily: 'Sora,sans-serif', fontSize: '2.25rem', fontWeight: 900, color: 'var(--text-primary,#e2e8f0)', marginBottom: '0.75rem' }}>
          AI Resume Analyzer
        </h1>
        <p style={{ color: 'var(--text-muted,#64748b)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto' }}>
          Get your ATS score, job match %, skill gaps, and rewritten bullets — for any resume, instantly free.
        </p>
      </div>

      <div style={{ maxWidth: 640, margin: '2.5rem auto', padding: '0 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.75rem' }}>
          {[{ icon: '🎯', label: 'ATS Score', sub: 'Grade A+ to D' }, { icon: '💼', label: 'Job Match', sub: '% confidence score' }, { icon: '📈', label: 'Skill Gaps', sub: '+ learning roadmap' }].map(item => (
            <div key={item.label} style={{ background: 'var(--bg-card,rgba(22,32,50,0.6))', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: '14px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{item.icon}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)' }}>{item.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted,#64748b)' }}>{item.sub}</div>
            </div>
          ))}
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${file ? C.green : dragging ? C.brand : 'var(--border,rgba(255,255,255,0.08))'}`, borderRadius: '20px', padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: file ? 'rgba(34,197,94,0.04)' : dragging ? 'rgba(249,115,22,0.04)' : 'var(--bg-card,rgba(22,32,50,0.4))', transition: 'all 0.2s', marginBottom: '1.25rem' }}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
          {file ? (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
              <div style={{ fontWeight: 700, color: C.green, marginBottom: '0.25rem' }}>{file.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted,#64748b)' }}>{(file.size / 1024).toFixed(1)}KB — Click to change</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📄</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', marginBottom: '0.4rem' }}>Drop resume here or click to upload</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted,#64748b)', marginBottom: '0.75rem' }}>Supports PDF, DOCX, DOC, TXT — Max 5MB</div>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {['PDF', 'DOCX', 'DOC', 'TXT'].map(f => (
                  <span key={f} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border,rgba(255,255,255,0.08))', color: 'var(--text-muted,#64748b)' }}>{f}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {fileErr && <div role="alert" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'10px', padding:'0.6rem 0.9rem', marginBottom:'0.75rem', fontSize:'0.82rem', color:C.red }}>&#9888; {fileErr}</div>}

        <details style={{ marginBottom: '1.25rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary,#94a3b8)', padding: '0.5rem 0', userSelect: 'none' }}>
            ＋ Paste a Job Description for match scoring (optional)
          </summary>
          <textarea
            value={jobDesc}
            onChange={e => { if (e.target.value.length <= MAX_JD_CHARS) setJobDesc(e.target.value) }}
            placeholder="Paste the job description here to get a match % score..."
            rows={5}
            maxLength={MAX_JD_CHARS}
            aria-label="Job description (optional)"
            style={{ width:'100%', marginTop:'0.5rem', padding:'0.85rem 1rem', background:'var(--bg-input,rgba(22,32,50,0.8))', border:'1px solid var(--border,rgba(255,255,255,0.08))', borderRadius:'12px', color:'var(--text-primary,#e2e8f0)', fontSize:'0.85rem', resize:'vertical', fontFamily:'DM Sans,sans-serif', outline:'none', boxSizing:'border-box' }}
          />
          <div style={{ textAlign:'right', fontSize:'0.7rem', color:'var(--text-muted,#64748b)', marginTop:'0.25rem' }}>{jobDesc.length} / {MAX_JD_CHARS}</div>
        </details>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {[{ v: 'full', l: '🧠 Full Analysis' }, { v: 'ats_only', l: '📊 ATS Only' }, { v: 'skill_gap', l: '🛠 Skill Gap' }, { v: 'rewrite', l: '✍️ Rewrite' }].map(m => (
            <button
              key={m.v}
              onClick={() => setMode(m.v)}
              style={{ padding: '0.45rem 0.9rem', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${mode === m.v ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.08)'}`, background: mode === m.v ? 'rgba(249,115,22,0.12)' : 'transparent', color: mode === m.v ? C.brand : 'var(--text-muted,#64748b)', fontSize: '0.8rem', fontWeight: mode === m.v ? 700 : 400, transition: 'all 0.15s' }}
            >
              {m.l}
            </button>
          ))}
        </div>

        <button
          onClick={() => file && analyze(file, jobDesc.trim(), mode)}
          disabled={!file}
          aria-disabled={!file}
          aria-label="Analyze my resume"
          style={{ width:'100%', padding:'1rem', background:!file?'rgba(255,255,255,0.08)':`linear-gradient(135deg,${C.brand},#ea6c0a)`, color:'#fff', border:'none', borderRadius:'14px', fontSize:'1rem', fontWeight:800, cursor:!file?'not-allowed':'pointer', fontFamily:'Sora,sans-serif', transition:'all 0.2s', boxShadow:file?`0 4px 20px ${C.brand}40`:'none' }}
        >
          🚀 Analyze My Resume
        </button>
        <p style={{ textAlign: 'center', fontSize: '0.73rem', color: 'var(--text-muted,#64748b)', marginTop: '1rem' }}>
          🔒 Your resume is analyzed securely. Never stored without login.
        </p>
      </div>
    </div>
  )

  // ─ ANALYZING ────────────────────────────────────────
  if (step === 'analyzing') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base,#0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
      <div style={{ position: 'relative' }}>
        <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={60} cy={60} r={50} fill="none" stroke="rgba(249,115,22,0.1)" strokeWidth="8" />
          <circle cx={60} cy={60} r={50} fill="none" stroke={C.brand} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${progress/100*314} ${314-progress/100*314}`} style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 8px ${C.brand})` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora,sans-serif', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary,#e2e8f0)' }}>
          {progress}%
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Sora,sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary,#e2e8f0)', marginBottom: '0.5rem' }}>
          Analyzing Resume...
        </h2>
        <p style={{ color: C.brand, fontSize: '0.88rem', fontWeight: 600 }}>{stepLabel}</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', maxWidth: 400 }}>
        {['📄 Extracting text', '🔍 Parsing structure', '🎯 Scoring ATS', '💼 Matching jobs', '💡 Generating tips', '✍️ Rewriting bullets'].map((s, i) => (
          <span key={i} style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: '999px', background: progress >= (i + 1) * 15 ? `${C.brand}20` : 'transparent', border: `1px solid ${progress >= (i + 1) * 15 ? C.brand + '40' : 'rgba(255,255,255,0.08)'}`, color: progress >= (i + 1) * 15 ? C.brand : 'var(--text-muted,#64748b)', fontWeight: 600, transition: 'all 0.3s' }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )

  // ─ ERROR ────────────────────────────────────────────
  if (step === 'error') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base,#0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.25rem', padding: '1rem' }}>
      <div style={{ fontSize: '4rem' }}>⚠️</div>
      <h2 style={{ fontFamily: 'Sora,sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary,#e2e8f0)' }}>Analysis Failed</h2>
      <p style={{ color: 'var(--text-secondary,#94a3b8)', fontSize: '0.9rem', maxWidth: 400, textAlign: 'center' }}>{error}</p>
      <button onClick={reset} style={{ padding: '0.75rem 2rem', background: C.brand, color: '#fff', border: 'none', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
        Try Again
      </button>
    </div>
  )

  // ─ RESULTS ──────────────────────────────────────────
  if (step === 'results' && result) {
    const { parsed, ats, job_match, weaknesses, strengths, top_actions, salary, skill_roadmap, rewritten_bullets, meta } = result
    const atsScore = Math.min(100, Math.max(0, Number(ats?.score)       || 0))
    const jmScore  = Math.min(100, Math.max(0, Number(job_match?.score) || 0))
    const summary  = {
      name:      String(parsed?.name || 'Candidate').slice(0, 80),
      atsScore,
      atsGrade:  String(ats?.grade || 'D'),
      readiness: Math.round(atsScore * 0.6 + jmScore * 0.4),
    }
    // Deduplicated flat skill list
    const allSkills = [...new Set([
      ...(Array.isArray(parsed?.skills?.languages)    ? parsed.skills.languages    : []),
      ...(Array.isArray(parsed?.skills?.frontend)     ? parsed.skills.frontend     : []),
      ...(Array.isArray(parsed?.skills?.backend)      ? parsed.skills.backend      : []),
      ...(Array.isArray(parsed?.skills?.databases)    ? parsed.skills.databases    : []),
      ...(Array.isArray(parsed?.skills?.cloud_devops) ? parsed.skills.cloud_devops : []),
    ])]

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base,#0f172a)', paddingBottom: '4rem' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,var(--bg-base,#0f172a),var(--bg-surface,#162032))', borderBottom: '1px solid var(--border,rgba(255,255,255,0.08))', padding: '2rem 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: C.brand, fontWeight: 700, marginBottom: '0.4rem' }}>🧠 SmartMatch™ Analysis Complete</div>
                <h1 style={{ fontFamily: 'Sora,sans-serif', fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary,#e2e8f0)' }}>
                  {summary.name}'s Results
                </h1>
                <p style={{ color: 'var(--text-muted,#64748b)', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                  {allSkills.length} skills detected • {parsed?.total_experience_years || 0} yrs experience • {parsed?.projects?.length || 0} projects • {meta?.experience_level || 'unknown'} level
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <ScoreRing score={summary.atsScore}        label="ATS Score" color={C.brand}  />
                <ScoreRing score={job_match?.score || 0}   label="Job Match" color={C.green}  />
                <ScoreRing score={summary.readiness}       label="Readiness" color={C.purple} />
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar + content */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${activeTab === tab.id ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.08)'}`, background: activeTab === tab.id ? 'rgba(249,115,22,0.12)' : 'transparent', fontSize: '0.82rem', fontWeight: activeTab === tab.id ? 700 : 400, color: activeTab === tab.id ? C.brand : 'var(--text-secondary,#94a3b8)', transition: 'all 0.15s' }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
            <button onClick={reset} style={{ marginLeft: 'auto', padding: '0.55rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', fontSize: '0.78rem', color: 'var(--text-muted,#64748b)', cursor: 'pointer' }}>
              ↺ Analyze Another
            </button>
          </div>

          {/* ── SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { icon: '🎯', label: 'ATS Score',   value: `${summary.atsScore}%`,                                    sub: `Grade ${summary.atsGrade}`,                  color: C.brand  },
                  { icon: '💼', label: 'Job Match',    value: `${job_match?.score || 0}%`,                               sub: job_match?.verdict || 'No JD provided',       color: C.green  },
                  { icon: '🛠', label: 'Skills Found', value: allSkills.length,                                          sub: 'detected in resume',                         color: C.purple },
                  { icon: '⚡', label: 'Skill Gaps',   value: ats?.breakdown?.skills?.missing_critical?.length || 0,    sub: 'critical missing',                           color: C.yellow },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-card,rgba(22,32,50,0.6))', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '12px', background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Sora,sans-serif', fontSize: '1.5rem', fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.value}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', marginTop: '0.15rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted,#64748b)' }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {salary && (
                <div style={{ background: 'var(--bg-card,rgba(22,32,50,0.6))', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: '18px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', marginBottom: '1.25rem' }}>💰 Salary Projection (India 2026)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.75rem' }}>
                    {[{ label: 'Current', value: salary.current_band, color: 'var(--text-muted,#64748b)' }, { label: 'After Rewrite', value: salary.after_rewrite, color: C.yellow }, { label: '3 Months', value: salary.after_3months, color: C.brand }, { label: '6 Months', value: salary.after_6months, color: C.green }].map(item => (
                      <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted,#64748b)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{item.label}</div>
                        <div style={{ fontFamily: 'Sora,sans-serif', fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {top_actions?.length > 0 && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', padding: '1.25rem' }}>
                  <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: '0.9rem', fontWeight: 700, color: C.green, marginBottom: '0.75rem' }}>⚡ Quick Wins — Do These Now</h3>
                  {top_actions.slice(0, 5).map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: i < top_actions.length - 1 ? '1px solid rgba(34,197,94,0.1)' : 'none', fontSize: '0.83rem' }}>
                      <span style={{ color: 'var(--text-secondary,#94a3b8)' }}>
                        <span style={{ color: C.green, fontWeight: 700, marginRight: '0.4rem' }}>{i + 1}.</span>
                        {a.action}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                        {a.score_boost > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.green, background: 'rgba(34,197,94,0.1)', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>+{a.score_boost} pts</span>}
                        {a.time_estimate && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted,#64748b)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>{a.time_estimate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ATS TAB */}
          {activeTab === 'ats' && ats && (
            <div style={{ background: 'var(--bg-card,rgba(22,32,50,0.6))', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: '18px', padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <ScoreRing score={summary.atsScore} size={140} label="ATS Score" color={C.brand} />
                <div>
                  <div style={{ fontFamily: 'Sora,sans-serif', fontSize: '3rem', fontWeight: 900, color: C.brand, lineHeight: 1 }}>{summary.atsGrade}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', marginTop: '0.35rem' }}>
                    {ats?.verdict || (summary.atsScore >= 85 ? 'Excellent Resume ✨' : summary.atsScore >= 70 ? 'Very Good 👍' : summary.atsScore >= 55 ? 'Good — Improvable' : summary.atsScore >= 40 ? 'Needs Work' : 'Major Improvement Needed')}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted,#64748b)', marginTop: '0.3rem' }}>{ats?.percentile || 'Calculated vs Indian market'}</div>
                </div>
              </div>
              {ats?.breakdown && (
                <>
                  <Bar value={ats.breakdown.skills?.raw_score     || 0} color={C.brand}  label="🛠 Skill Match"   weight="40%" />
                  <Bar value={ats.breakdown.experience?.raw_score || 0} color={C.green}  label="💼 Experience"    weight="25%" />
                  <Bar value={ats.breakdown.education?.raw_score  || 0} color={C.purple} label="🎓 Education"     weight="15%" />
                  <Bar value={ats.breakdown.completeness?.raw_score || 0} color={C.yellow} label="📋 Completeness" weight="10%" />
                  <Bar value={ats.breakdown.keywords?.raw_score   || 0} color={C.blue}   label="🔑 Keywords"     weight="10%" />
                </>
              )}
              {ats?.breakdown?.keywords?.missing_high_value?.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted,#64748b)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>High-Value Missing Keywords</div>
                  <div>{ats.breakdown.keywords.missing_high_value.map(k => <Chip key={k} label={k} type="missing" />)}</div>
                </div>
              )}
            </div>
          )}

          {/* ── JOBS TAB */}
          {activeTab === 'jobs' && (
            <div>
              {!job_match?.enabled ? (
                <div style={{ background: 'var(--bg-card,rgba(22,32,50,0.6))', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: '18px', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</div>
                  <h3 style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', marginBottom: '0.5rem' }}>No Job Description Provided</h3>
                  <p style={{ color: 'var(--text-muted,#64748b)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>Go back and paste a job description to see your match score.</p>
                  <button onClick={reset} style={{ padding: '0.65rem 1.5rem', background: C.brand, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>↺ Analyze Again with JD</button>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-card,rgba(22,32,50,0.6))', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: '18px', padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <ScoreRing score={job_match.score || 0} size={130} color={C.green} label="Match Score" />
                    <div>
                      <div style={{ fontFamily: 'Sora,sans-serif', fontSize: '1.5rem', fontWeight: 900, color: C.green }}>{job_match.verdict}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary,#94a3b8)', marginTop: '0.3rem' }}>
                        {job_match.apply_recommended ? '✅ Recommended to apply' : '⚠️ Consider improving first'}
                      </div>
                    </div>
                  </div>
                  <Bar value={job_match.breakdown?.skills     || 0} color={C.brand}  label="Skills Match"    weight="50%" />
                  <Bar value={job_match.breakdown?.experience || 0} color={C.green}  label="Experience Match" weight="20%" />
                  <Bar value={job_match.breakdown?.education  || 0} color={C.purple} label="Education Match"  weight="20%" />
                  <Bar value={job_match.breakdown?.keywords   || 0} color={C.blue}   label="Keyword Match"    weight="10%" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.green, marginBottom: '0.5rem', textTransform: 'uppercase' }}>✅ You Have</div>
                      {job_match.required_matched?.map(s => <Chip key={s} label={s} type="match" />)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.red, marginBottom: '0.5rem', textTransform: 'uppercase' }}>✗ You Need</div>
                      {job_match.required_missing?.map(s => <Chip key={s} label={s} type="missing" />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── GAPS TAB */}
          {activeTab === 'gaps' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '18px', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: C.green, marginBottom: '1rem' }}>✅ Your Strengths ({allSkills.length})</h3>
                <div>{allSkills.slice(0, 20).map(s => <Chip key={s} label={s} type="match" />)}</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '18px', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: C.red, marginBottom: '1rem' }}>⚠️ Critical Missing ({ats?.breakdown?.skills?.missing_critical?.length || 0})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(ats?.breakdown?.skills?.missing_critical || []).map(skill => (
                    <div key={skill} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.06)', borderRadius: '10px', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary,#e2e8f0)' }}>{skill}</span>
                      <Chip label="Critical" type="missing" />
                    </div>
                  ))}
                </div>
              </div>
              {skill_roadmap?.length > 0 && (
                <div style={{ gridColumn: '1/-1', background: 'var(--bg-card,rgba(22,32,50,0.6))', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: '18px', padding: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', marginBottom: '1.25rem' }}>📈 Learning Roadmap</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem' }}>
                    {skill_roadmap.map((phase, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '1.1rem', borderLeft: `3px solid ${i === 0 ? C.red : i === 1 ? C.yellow : C.green}` }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: i === 0 ? C.red : i === 1 ? C.yellow : C.green, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{phase.phase} — {phase.duration}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted,#64748b)', marginBottom: '0.5rem' }}>{phase.skills?.join(', ')}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary,#94a3b8)' }}>🎯 {phase.milestone}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.green, marginTop: '0.3rem' }}>💰 {phase.salary_unlocked}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TIPS TAB */}
          {activeTab === 'tips' && (
            <div>
              {strengths?.length > 0 && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: '0.9rem', fontWeight: 700, color: C.green, marginBottom: '0.6rem' }}>✅ Strengths</h3>
                  {strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.35rem 0', fontSize: '0.83rem', color: 'var(--text-secondary,#94a3b8)', borderBottom: i < strengths.length - 1 ? '1px solid rgba(34,197,94,0.08)' : 'none' }}>
                      <span style={{ color: C.green }}>✓</span> {s}
                    </div>
                  ))}
                </div>
              )}
              {weaknesses?.map((w, i) => <RecCard key={i} rec={w} />)}
            </div>
          )}

          {/* ── REWRITE TAB */}
          {activeTab === 'rewrite' && (
            <div>
              {clipMsg && <div role="status" aria-live="polite" style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:C.green, color:'#fff', padding:'0.5rem 1.1rem', borderRadius:'10px', fontSize:'0.82rem', fontWeight:700, zIndex:9999, boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>✓ {clipMsg}</div>}
              {rewritten_bullets?.summary && (
                <div style={{ background:'var(--bg-card,rgba(22,32,50,0.6))', border:'1px solid var(--border,rgba(255,255,255,0.08))', borderRadius:'16px', padding:'1.5rem', marginBottom:'1rem' }}>
                  <h3 style={{ fontFamily:'Sora,sans-serif', fontSize:'0.9rem', fontWeight:700, color:'var(--text-primary,#e2e8f0)', marginBottom:'0.75rem' }}>📝 Rewritten Professional Summary</h3>
                  <p style={{ fontSize:'0.88rem', color:'var(--text-secondary,#94a3b8)', lineHeight:1.7, fontStyle:'italic' }}>"{rewritten_bullets.summary}"</p>
                  <button onClick={() => copyText(rewritten_bullets.summary)} aria-label="Copy summary to clipboard" style={{ marginTop:'0.75rem', padding:'0.4rem 0.9rem', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', borderRadius:'8px', color:C.brand, fontSize:'0.78rem', fontWeight:700, cursor:'pointer' }}>
                    📋 Copy Summary
                  </button>
                </div>
              )}
              {rewritten_bullets?.experience_improvements?.map((exp, i) => (
                <div key={i} style={{ background:'var(--bg-card,rgba(22,32,50,0.6))', border:'1px solid var(--border,rgba(255,255,255,0.08))', borderRadius:'16px', padding:'1.5rem', marginBottom:'1rem' }}>
                  <h3 style={{ fontFamily:'Sora,sans-serif', fontSize:'0.9rem', fontWeight:700, color:'var(--text-primary,#e2e8f0)', marginBottom:'1rem' }}>✍️ {exp?.role} @ {exp?.company}</h3>
                  {Array.isArray(exp?.improved_bullets) && exp.improved_bullets.map((bullet, j) => (
                    <div key={j} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', padding:'0.6rem 0', borderBottom:j < exp.improved_bullets.length-1 ? '1px solid var(--border,rgba(255,255,255,0.08))' : 'none' }}>
                      <span style={{ color:C.green, fontWeight:700, flexShrink:0 }}>→</span>
                      <span style={{ fontSize:'0.83rem', color:'var(--text-secondary,#94a3b8)', lineHeight:1.55, flex:1 }}>{bullet}</span>
                      <button onClick={() => copyText(bullet)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--text-muted,#64748b)', flexShrink:0, padding:'0.1rem 0.3rem' }} aria-label="Copy bullet to clipboard" title="Copy bullet">📋</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
