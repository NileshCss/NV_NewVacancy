import { useState, useRef, useCallback } from 'react'
import { useSmartMatch } from '../hooks/useSmartMatch'

// ── Constants (hoisted — never re-created on render) ──
const COLORS = { brand:'#f97316', green:'#22c55e', red:'#ef4444', yellow:'#f59e0b', purple:'#8b5cf6', blue:'#3b82f6' }
const ALLOWED_EXTS  = new Set(['pdf','docx','doc','txt'])
const ALLOWED_MIMES = new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain'])
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_JD_CHARS   = 8000
const ANALYSIS_MODES = [{v:'full',l:'🧠 Full Analysis'},{v:'ats_only',l:'📊 ATS Only'},{v:'skill_gap',l:'🛠 Skill Gap'},{v:'rewrite',l:'✍️ Rewrite'}]
const TABS = [{id:'summary',icon:'🎯',label:'Summary'},{id:'ats',icon:'📊',label:'ATS Score'},{id:'jobs',icon:'💼',label:'Matches'},{id:'gaps',icon:'🛠',label:'Skill Gap'},{id:'tips',icon:'💡',label:'Improve'},{id:'rewrite',icon:'✍️',label:'Rewrite'}]
const FEATURES = [{ icon: '🎯', title: 'ATS Score', sub: 'Grade A+ to D' }, { icon: '💼', title: 'Job Match', sub: '% confidence score' }, { icon: '📈', title: 'Skill Gaps', sub: '+ learning roadmap' }]
const STEP_LABELS = ['📄 Extracting text', '🔍 Parsing structure', '🎯 Scoring ATS', '💼 Matching jobs', '💡 Generating tips', '✍️ Rewriting bullets']

const REC_STYLES = {
  critical: { badge:'🔴 Critical', className:'critical', badgeColor: COLORS.red },
  high:     { badge:'🟡 High',     className:'high',     badgeColor: COLORS.yellow },
  medium:   { badge:'🔵 Medium',   className:'medium',   badgeColor: '#94a3b8' },
}

async function safeClip(text) {
  try { await navigator.clipboard.writeText(text); return true }
  catch { return false }
}

// ── Score Ring ────────────────────────────────────────
function ScoreRing({ score = 0, size = 120, color = COLORS.brand, label }) {
  const r    = size / 2 - 10
  const circ = 2 * Math.PI * r
  const dash = Math.min(100, Math.max(0, score)) / 100 * circ
  return (
    <div className="sm-ring">
      <div className="sm-ring-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle className="track" cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="8" />
          <circle
            className="fill" cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="sm-ring-value">
          <span className="sm-ring-num" style={{ fontSize: size > 100 ? '1.75rem' : '1.1rem' }}>{score}</span>
          <span className="sm-ring-sub">/100</span>
        </div>
      </div>
      {label && <span className="sm-ring-label">{label}</span>}
    </div>
  )
}

// ── Progress Bar ─────────────────────────────────────
function Bar({ value = 0, color = COLORS.brand, label, weight }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className="sm-bar">
      <div className="sm-bar-header">
        <span className="sm-bar-label">
          {label}
          {weight && <span className="sm-bar-weight">({weight})</span>}
        </span>
        <span className="sm-bar-pct" style={{ color }}>{Math.round(pct)}%</span>
      </div>
      <div className="sm-bar-track">
        <div className="sm-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}cc)`, boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  )
}

// ── Skill Chip ───────────────────────────────────────
function Chip({ label, type = 'neutral' }) {
  return (
    <span className={`sm-chip ${type}`}>
      {type === 'match' && '✓ '}
      {type === 'missing' && '✗ '}
      {label}
    </span>
  )
}

// ── Recommendation Card ──────────────────────────────
function RecCard({ rec }) {
  if (!rec) return null
  const s     = REC_STYLES[rec.severity] || REC_STYLES.medium
  const boost = Number(rec.score_boost) || 0
  return (
    <div className={`sm-rec ${s.className}`}>
      <div className="sm-rec-top">
        <span className="sm-rec-badge" style={{ color: s.badgeColor }}>{s.badge}</span>
        {boost > 0 && <span className="sm-rec-boost">+{boost} pts</span>}
      </div>
      <div className="sm-rec-title">{rec.title}</div>
      {rec.before && <div className="sm-rec-before"><strong>Before:</strong> {rec.before}</div>}
      {rec.after  && <div className="sm-rec-after"><strong>After:</strong> {rec.after}</div>}
      <div className="sm-rec-desc">{rec.description}</div>
    </div>
  )
}

// ══ MAIN PAGE ════════════════════════════════════════
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
    <div className="sm-page">
      <div className="sm-hero">
        <div className="container">
          <div className="sm-badge">🧠 SmartMatch™ Engine v2.0</div>
          <h1 className="sm-h1">AI Resume Analyzer</h1>
          <p className="sm-subtitle">
            Get your ATS score, job match %, skill gaps, and rewritten bullets — for any resume, instantly free.
          </p>
        </div>
      </div>

      <div className="sm-body">
        <div className="sm-features">
          {FEATURES.map(f => (
            <div key={f.title} className="sm-feat anim-up">
              <div className="sm-feat-icon">{f.icon}</div>
              <div>
                <div className="sm-feat-title">{f.title}</div>
                <div className="sm-feat-sub">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Upload Zone */}
        <div
          className={`sm-upload${file ? ' has-file' : ''}${dragging ? ' dragging' : ''}`}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          tabIndex={0}
          role="button"
          aria-label="Upload resume file"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
          {file ? (
            <>
              <span className="sm-upload-icon">✅</span>
              <div className="sm-upload-name">{file.name}</div>
              <div className="sm-upload-meta">{(file.size / 1024).toFixed(1)}KB — Click to change</div>
            </>
          ) : (
            <>
              <span className="sm-upload-icon">📄</span>
              <div className="sm-upload-title">Drop resume here or click to upload</div>
              <div className="sm-upload-hint">Supports PDF, DOCX, DOC, TXT — Max 5MB</div>
              <div className="sm-upload-tags">
                {['PDF', 'DOCX', 'DOC', 'TXT'].map(f => <span key={f} className="sm-upload-tag">{f}</span>)}
              </div>
            </>
          )}
        </div>

        {/* File Error */}
        {fileErr && <div className="sm-error-inline" role="alert">⚠ {fileErr}</div>}

        {/* JD Input */}
        <details style={{ marginBottom: '1.25rem' }}>
          <summary className="sm-jd-toggle">
            ＋ Paste a Job Description for match scoring (optional)
          </summary>
          <textarea
            className="sm-jd-textarea"
            value={jobDesc}
            onChange={e => { if (e.target.value.length <= MAX_JD_CHARS) setJobDesc(e.target.value) }}
            placeholder="Paste the job description here to get a match % score..."
            rows={5}
            maxLength={MAX_JD_CHARS}
            aria-label="Job description (optional)"
          />
          <div className="sm-jd-count">{jobDesc.length} / {MAX_JD_CHARS}</div>
        </details>

        {/* Mode Selector */}
        <div className="sm-modes">
          {ANALYSIS_MODES.map(m => (
            <button
              key={m.v}
              className={`sm-mode-btn${mode === m.v ? ' active' : ''}`}
              onClick={() => setMode(m.v)}
              aria-pressed={mode === m.v}
            >
              {m.l}
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          className={`sm-cta${file ? ' ready' : ''}`}
          onClick={() => file && analyze(file, jobDesc.trim(), mode)}
          disabled={!file}
          aria-disabled={!file}
          aria-label="Analyze my resume"
        >
          🚀 Analyze My Resume
        </button>
        <p className="sm-privacy">🔒 Your resume is analyzed securely. Never stored without login.</p>
      </div>
    </div>
  )

  // ─ ANALYZING ────────────────────────────────────────
  if (step === 'analyzing') return (
    <div className="sm-analyzing">
      <div className="sm-progress-ring">
        <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={60} cy={60} r={50} fill="none" stroke="rgba(249,115,22,0.1)" strokeWidth="8" />
          <circle cx={60} cy={60} r={50} fill="none" stroke={COLORS.brand} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${progress/100*314} ${314-progress/100*314}`} style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 8px ${COLORS.brand})` }} />
        </svg>
        <div className="sm-progress-pct">{progress}%</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 className="sm-analyzing-title">Analyzing Resume...</h2>
        <p className="sm-analyzing-label">{stepLabel}</p>
      </div>
      <div className="sm-step-pills">
        {STEP_LABELS.map((s, i) => (
          <span key={i} className={`sm-step-pill${progress >= (i + 1) * 15 ? ' active' : ''}`}>{s}</span>
        ))}
      </div>
    </div>
  )

  // ─ ERROR ────────────────────────────────────────────
  if (step === 'error') return (
    <div className="sm-error-page">
      <div className="sm-error-icon">⚠️</div>
      <h2 className="sm-error-title">Analysis Failed</h2>
      <p className="sm-error-msg">{error}</p>
      <button className="sm-retry-btn" onClick={reset}>Try Again</button>
    </div>
  )

  // ─ RESULTS ──────────────────────────────────────────
  if (step === 'results' && result) {
    const { parsed, ats, job_match, weaknesses, strengths, top_actions, salary, skill_roadmap, rewritten_bullets, meta, detected_role } = result
    const atsScore = Math.min(100, Math.max(0, Number(ats?.score) || 0))
    const jmScore  = Math.min(100, Math.max(0, Number(job_match?.score) || 0))
    const summary  = {
      name:      String(parsed?.name || 'Candidate').slice(0, 80),
      atsScore,
      atsGrade:  String(ats?.grade || 'D'),
      readiness: Math.round(atsScore * 0.6 + jmScore * 0.4),
    }
    // Strengths = ONLY skills Claude found in the actual CV text (ground truth)
    const allSkills = [...new Set([
      ...(Array.isArray(parsed?.skills?.languages)    ? parsed.skills.languages    : []),
      ...(Array.isArray(parsed?.skills?.frontend)     ? parsed.skills.frontend     : []),
      ...(Array.isArray(parsed?.skills?.backend)      ? parsed.skills.backend      : []),
      ...(Array.isArray(parsed?.skills?.databases)    ? parsed.skills.databases    : []),
      ...(Array.isArray(parsed?.skills?.cloud_devops) ? parsed.skills.cloud_devops : []),
      ...(Array.isArray(parsed?.skills?.testing)      ? parsed.skills.testing      : []),
      ...(Array.isArray(parsed?.skills?.concepts)     ? parsed.skills.concepts     : []),
    ])]

    // Role-aware missing skills — prefer v4 result.missing.*, fall back to ats.breakdown
    const missingCriticalRaw  = result.missing?.critical?.length  > 0
      ? result.missing.critical
      : (ats?.breakdown?.skills?.missing_critical || []).map(s => ({ skill: s, why: '' }))
    const missingImportantRaw = result.missing?.high?.length > 0
      ? result.missing.high
      : (ats?.breakdown?.skills?.missing_important || []).map(s => ({ skill: s, why: '' }))
    const missingMediumRaw    = result.missing?.medium || []

    // String lists for ats breakdown back-compat
    const missingCritical  = missingCriticalRaw.map(m  => typeof m === 'string' ? m : m.skill)
    const missingImportant = missingImportantRaw.map(m => typeof m === 'string' ? m : m.skill)
    const totalMissing     = missingCritical.length + missingImportant.length

    // Human-readable role label
    const ROLE_LABELS = {
      JAVA_FULLSTACK: 'Full Stack Java Developer',
      JAVA_BACKEND: 'Java Backend Developer',
      MERN_FULLSTACK: 'MERN Full Stack Developer',
      FRONTEND: 'Frontend Developer',
      PYTHON_BACKEND: 'Python Backend Developer',
      DEVOPS: 'DevOps Engineer',
      DATA_SCIENCE: 'Data Scientist',
      ANDROID: 'Android Developer',
      GENERAL_FULLSTACK: 'Full Stack Developer',
    }
    const roleLabel = ROLE_LABELS[detected_role] || detected_role || 'Developer'

    return (
      <div className="sm-page">
        {/* ── Header ── */}
        <div className="sm-results-header">
          <div className="sm-results-inner">
            <div className="sm-results-info">
              <div className="sm-results-label">🧠 SmartMatch™ Analysis Complete</div>
              <h1 className="sm-results-name">{summary.name}'s Results</h1>
              <p className="sm-results-meta">
                {allSkills.length} skills from CV • {parsed?.total_experience_years || 0} yrs exp • {parsed?.projects?.length || 0} projects • Detected: <strong>{roleLabel}</strong>
              </p>
            </div>
            <div className="sm-rings">
              <ScoreRing score={summary.atsScore}      label="ATS Score" color={COLORS.brand}  />
              <ScoreRing score={job_match?.score || 0}  label="Job Match" color={COLORS.green}  />
              <ScoreRing score={summary.readiness}      label="Readiness" color={COLORS.purple} />
            </div>
          </div>
        </div>

        {/* ── Tabs + Content ── */}
        <div className="sm-content">
          <div className="sm-tabs">
            {TABS.map(tab => (
              <button key={tab.id} className={`sm-tab${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.icon} {tab.label}
              </button>
            ))}
            <button className="sm-tab-reset" onClick={reset}>↺ Analyze Another</button>
          </div>

          {/* ── SUMMARY TAB ── */}
          {activeTab === 'summary' && (
            <div className="sm-tab-panel">
              <div className="sm-stat-grid">
                {[
                  { icon: '🎯', label: 'ATS Score',   value: `${summary.atsScore}%`,              sub: `Grade ${summary.atsGrade}`,            color: COLORS.brand  },
                  { icon: '💼', label: 'Job Match',    value: `${job_match?.score || 0}%`,          sub: job_match?.verdict || 'No JD provided', color: COLORS.green  },
                  { icon: '🛠', label: 'Skills Found', value: allSkills.length,                     sub: 'detected from your CV',                color: COLORS.purple },
                  { icon: '⚡', label: 'Skill Gaps',   value: totalMissing,                         sub: `${missingCritical.length} critical gaps for ${roleLabel}`, color: COLORS.yellow },
                ].map(item => (
                  <div key={item.label} className="sm-stat">
                    <div className="sm-stat-icon" style={{ background: `${item.color}18` }}>{item.icon}</div>
                    <div>
                      <div className="sm-stat-val" style={{ color: item.color }}>{item.value}</div>
                      <div className="sm-stat-name">{item.label}</div>
                      <div className="sm-stat-sub">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {salary && (
                <div className="sm-card">
                  <div className="sm-card-title">💰 Salary Projection (India 2026)</div>
                  <div className="sm-salary-grid">
                    {[
                      { label: 'Current',       value: salary.current_band,  color: 'var(--text-muted)' },
                      { label: 'After Rewrite', value: salary.after_rewrite, color: COLORS.yellow },
                      { label: '3 Months',      value: salary.after_3months, color: COLORS.brand },
                      { label: '6 Months',      value: salary.after_6months, color: COLORS.green },
                    ].map(item => (
                      <div key={item.label} className="sm-salary-item">
                        <div className="sm-salary-label">{item.label}</div>
                        <div className="sm-salary-val" style={{ color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {top_actions?.length > 0 && (
                <div className="sm-wins">
                  <div className="sm-wins-title">⚡ Quick Wins — Do These Now</div>
                  {top_actions.slice(0, 5).map((a, i) => (
                    <div key={i} className="sm-win-row">
                      <span className="sm-win-text">
                        <span className="sm-win-num">{i + 1}.</span>
                        {a.action}
                      </span>
                      <div className="sm-win-badges">
                        {a.score_boost > 0 && <span className="sm-win-badge pts">+{a.score_boost} pts</span>}
                        {a.time_estimate && <span className="sm-win-badge time">{a.time_estimate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ATS TAB ── */}
          {activeTab === 'ats' && ats && (
            <div className="sm-tab-panel">
              <div className="sm-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  <ScoreRing score={summary.atsScore} size={140} label="ATS Score" color={COLORS.brand} />
                  <div>
                    <div style={{ fontFamily: 'Sora,sans-serif', fontSize: '3rem', fontWeight: 900, color: COLORS.brand, lineHeight: 1 }}>{summary.atsGrade}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '.35rem' }}>
                      {ats?.verdict || (summary.atsScore >= 85 ? 'Excellent Resume ✨' : summary.atsScore >= 70 ? 'Very Good 👍' : summary.atsScore >= 55 ? 'Good — Improvable' : summary.atsScore >= 40 ? 'Needs Work' : 'Major Improvement Needed')}
                    </div>
                    <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>{ats?.percentile || 'Calculated vs Indian market'}</div>
                  </div>
                </div>
                {ats?.breakdown && (
                  <>
                    <Bar value={ats.breakdown.skills?.raw_score     || ats.breakdown.skills?.raw     || 0} color={COLORS.brand}  label="🛠 Skill Match"   weight="40%" />
                    <Bar value={ats.breakdown.experience?.raw_score || ats.breakdown.experience?.raw || 0} color={COLORS.green}  label="💼 Experience"    weight="25%" />
                    <Bar value={ats.breakdown.education?.raw_score  || ats.breakdown.education?.raw  || 0} color={COLORS.purple} label="🎓 Education"     weight="15%" />
                    <Bar value={ats.breakdown.completeness?.raw_score || ats.breakdown.completeness?.raw || 0} color={COLORS.yellow} label="📋 Completeness" weight="10%" />
                    <Bar value={ats.breakdown.keywords?.raw_score   || ats.breakdown.keywords?.raw   || 0} color={COLORS.blue}   label="🔑 Keywords"     weight="10%" />
                    {ats.breakdown.cert_bonus > 0 && (
                      <div style={{ fontSize: '.82rem', color: COLORS.green, marginTop: '.5rem', fontWeight: 600 }}>
                        🏆 Certification Bonus: +{ats.breakdown.cert_bonus} pts
                      </div>
                    )}
                  </>
                )}
                {ats?.breakdown?.keywords?.missing_high_value?.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.6rem' }}>High-Value Missing Keywords (for {roleLabel})</div>
                    <div>{ats.breakdown.keywords.missing_high_value.map(k => <Chip key={k} label={k} type="missing" />)}</div>
                  </div>
                )}
                {result.experience_parsed?.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.75rem' }}>Experience Breakdown</div>
                    {result.experience_parsed.map((exp, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '.83rem' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.company}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{exp.role}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{exp.months}mo</span>
                          <span style={{ color: exp.is_tech_role ? COLORS.green : COLORS.yellow, fontSize: '11px', fontWeight: 600 }}>
                            {exp.is_tech_role ? '🖥 Tech' : '📋 Non-tech'} T{exp.tier}
                          </span>
                          <span style={{ color: COLORS.brand, fontWeight: 700 }}>{exp.weighted_months?.toFixed(1)}w</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Total weighted: {result.experience_parsed.reduce((s, e) => s + (e.weighted_months || 0), 0).toFixed(1)} months
                      {' '}(of 24 needed for 100%)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── JOBS TAB ── */}
          {activeTab === 'jobs' && (
            <div className="sm-tab-panel">
              {!job_match?.enabled ? (
                <div className="sm-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💼</div>
                  <h3 style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '.5rem' }}>No Job Description Provided</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.88rem', marginBottom: '1.25rem' }}>Go back and paste a job description to see your match score.</p>
                  <button className="sm-retry-btn" onClick={reset}>↺ Analyze Again with JD</button>
                </div>
              ) : (
                <div className="sm-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <ScoreRing score={job_match.score || 0} size={130} color={COLORS.green} label="Match Score" />
                    <div>
                      <div style={{ fontFamily: 'Sora,sans-serif', fontSize: '1.5rem', fontWeight: 900, color: COLORS.green }}>{job_match.verdict}</div>
                      <div style={{ fontSize: '.9rem', color: 'var(--text-secondary)', marginTop: '.3rem' }}>
                        {job_match.apply_recommended ? '✅ Recommended to apply' : '⚠️ Consider improving first'}
                      </div>
                    </div>
                  </div>
                  <Bar value={job_match.breakdown?.skills     || 0} color={COLORS.brand}  label="Skills Match"    weight="50%" />
                  <Bar value={job_match.breakdown?.experience || 0} color={COLORS.green}  label="Experience Match" weight="20%" />
                  <Bar value={job_match.breakdown?.education  || 0} color={COLORS.purple} label="Education Match"  weight="20%" />
                  <Bar value={job_match.breakdown?.keywords   || 0} color={COLORS.blue}   label="Keyword Match"    weight="10%" />
                  <div className="sm-match-grid">
                    <div>
                      <div className="sm-match-section-label" style={{ color: COLORS.green }}>✅ You Have</div>
                      {job_match.required_matched?.map(s => <Chip key={s} label={s} type="match" />)}
                    </div>
                    <div>
                      <div className="sm-match-section-label" style={{ color: COLORS.red }}>✗ You Need</div>
                      {job_match.required_missing?.map(s => <Chip key={s} label={s} type="missing" />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── GAPS TAB ── */}
          {activeTab === 'gaps' && (
            <div className="sm-tab-panel">
              <div className="sm-gaps-grid">
                <div className="sm-gap-card strengths">
                  <h3 className="sm-gap-title" style={{ color: COLORS.green }}>✅ Your Strengths ({allSkills.length})</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Skills extracted directly from your CV</p>
                  {allSkills.length === 0 ? (
                    <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>No skills detected. Make sure your resume clearly lists your technical skills.</p>
                  ) : (
                    <div>{allSkills.slice(0, 24).map(s => <Chip key={s} label={s} type="match" />)}</div>
                  )}
                </div>
                <div className="sm-gap-card missing-skills">
                  <h3 className="sm-gap-title" style={{ color: COLORS.red }}>⚠️ Skill Gaps ({totalMissing})</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Based on your detected role: <strong>{roleLabel}</strong></p>
                  {totalMissing === 0 && missingMediumRaw.length === 0 ? (
                    <p style={{ fontSize: '.85rem', color: COLORS.green }}>🎉 Great profile! No critical skill gaps for a {roleLabel} role.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                      {missingCriticalRaw.map((item, i) => {
                        const skill = typeof item === 'string' ? item : item.skill
                        const why   = typeof item === 'string' ? '' : item.why || item.role_relevance || ''
                        return (
                          <div key={i} className="sm-gap-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <span className="sm-gap-item-name">{skill}</span>
                              <Chip label="✗ Critical" type="missing" />
                            </div>
                            {why && <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '2px' }}>{why}</span>}
                          </div>
                        )
                      })}
                      {missingImportantRaw.map((item, i) => {
                        const skill = typeof item === 'string' ? item : item.skill
                        const why   = typeof item === 'string' ? '' : item.why || item.role_relevance || ''
                        return (
                          <div key={i} className="sm-gap-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <span className="sm-gap-item-name">{skill}</span>
                              <span className="sm-chip" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: 500 }}>! High</span>
                            </div>
                            {why && <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '2px' }}>{why}</span>}
                          </div>
                        )
                      })}
                      {missingMediumRaw.map((item, i) => {
                        const skill = typeof item === 'string' ? item : item.skill
                        return (
                          <div key={i} className="sm-gap-item">
                            <span className="sm-gap-item-name">{skill}</span>
                            <span className="sm-chip" style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: 500 }}>~ Medium</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {skill_roadmap?.length > 0 && (
                  <div className="sm-roadmap">
                    <div className="sm-card">
                      <div className="sm-card-title">📈 Learning Roadmap</div>
                      <div className="sm-roadmap-grid">
                        {skill_roadmap.map((phase, i) => (
                          <div key={i} className="sm-roadmap-phase" style={{ borderLeftColor: i === 0 ? COLORS.red : i === 1 ? COLORS.yellow : COLORS.green }}>
                            <div className="sm-phase-label" style={{ color: i === 0 ? COLORS.red : i === 1 ? COLORS.yellow : COLORS.green }}>{phase.phase} — {phase.duration}</div>
                            <div className="sm-phase-skills">{phase.skills?.join(', ')}</div>
                            <div className="sm-phase-milestone">🎯 {phase.milestone}</div>
                            <div className="sm-phase-salary">💰 {phase.salary_unlocked}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TIPS TAB ── */}
          {activeTab === 'tips' && (
            <div className="sm-tab-panel">
              {allSkills.length > 0 && (
                <div className="sm-strengths">
                  <h3 className="sm-card-title" style={{ color: COLORS.green, marginBottom: '.4rem' }}>✅ Detected Strengths from CV</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '.8rem' }}>Role: <strong>{roleLabel}</strong></p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem' }}>
                    {allSkills.slice(0, 16).map(s => (
                      <span key={s} className="sm-chip match">✓ {s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    ))}
                  </div>
                </div>
              )}
              {weaknesses?.map((w, i) => <RecCard key={i} rec={w} />)}
            </div>
          )}

          {/* ── REWRITE TAB ── */}
          {activeTab === 'rewrite' && (
            <div className="sm-tab-panel">
              {clipMsg && <div className="sm-toast" role="status" aria-live="polite">✓ {clipMsg}</div>}
              {rewritten_bullets?.summary && (
                <div className="sm-rewrite-card">
                  <h3 className="sm-card-title" style={{ marginBottom: '.75rem' }}>📝 Rewritten Professional Summary</h3>
                  <p style={{ fontSize: '.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, fontStyle: 'italic' }}>"{rewritten_bullets.summary}"</p>
                  <button className="sm-copy-btn" onClick={() => copyText(rewritten_bullets.summary)} aria-label="Copy summary">📋 Copy Summary</button>
                </div>
              )}
              {rewritten_bullets?.experience_improvements?.map((exp, i) => (
                <div key={i} className="sm-rewrite-card">
                  <h3 className="sm-card-title" style={{ marginBottom: '1rem' }}>✍️ {exp?.role} @ {exp?.company}</h3>
                  {Array.isArray(exp?.improved_bullets) && exp.improved_bullets.map((bullet, j) => (
                    <div key={j} className="sm-bullet-row">
                      <span className="sm-bullet-arrow">→</span>
                      <span className="sm-bullet-text">{bullet}</span>
                      <button className="sm-bullet-copy" onClick={() => copyText(bullet)} aria-label="Copy bullet" title="Copy bullet">📋</button>
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
