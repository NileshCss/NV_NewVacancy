import React, { useState } from 'react'

export default function AIResultsDashboard({ result, onReset }) {
  const [tab, setTab] = useState('summary')

  if (!result) return null

  const {
    summary_card,
    resume_data,
    ats_analysis,
    job_matches = [],
    recommended_jobs,
    suggestions,
    india_insights,
  } = result

  // Guard against missing properties
  const safeJobMatches = Array.isArray(job_matches) ? job_matches : []
  const topPicks = recommended_jobs?.top_picks || []

  return (
    <div style={{ padding: '2rem 1.25rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            AI Analysis Complete ✨
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Analyzed {resume_data?.personal?.name || 'Resume'} against {safeJobMatches.length} live jobs.
          </p>
        </div>
        <button onClick={onReset} style={{ padding: '0.6rem 1.25rem', background: 'var(--white-5)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
          ← Run New Analysis
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Overall ATS Score</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#6366f1', fontFamily: 'Sora, sans-serif', lineHeight: 1 }}>
            {ats_analysis?.overall_ats_score || 0}<span style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>/100</span>
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Grade: <strong style={{ color: '#86efac' }}>{ats_analysis?.grade || 'N/A'}</strong></div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Best Job Match</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summary_card?.best_match_job || 'No strong match'}
          </div>
          <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Sora, sans-serif' }}>
            {summary_card?.best_match_score || 0}% Match
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Career Readiness</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {summary_card?.overall_readiness || 'N/A'}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            Top Strength: {summary_card?.top_strength || 'Skills'}
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { id: 'summary', name: 'Overview & Insights' },
          { id: 'matches', name: `Job Matches (${safeJobMatches.length})` },
          { id: 'ats', name: 'ATS Analysis' },
          { id: 'improve', name: 'Improvement Plan' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '0.8rem 1.25rem', fontSize: '0.9rem', fontWeight: 600,
              background: 'transparent', border: 'none',
              color: tab === t.id ? '#6366f1' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.id ? '#6366f1' : 'transparent'}`,
              marginBottom: '-1px', cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ minHeight: '50vh' }}>
        
        {/* OVERVIEW TAB */}
        {tab === 'summary' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            {/* AI Summary */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🧠 AI Professional Summary
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {resume_data?.professional_summary || 'No summary generated.'}
              </p>
              
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Extracted Skills</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {resume_data?.all_skills_flat?.slice(0, 15).map((s, i) => (
                    <span key={i} style={{ background: 'rgba(99,102,241,0.1)', color: '#c7d2fe', padding: '0.2rem 0.6rem', borderRadius: 6, fontSize: '0.75rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {s}
                    </span>
                  ))}
                  {(resume_data?.all_skills_flat?.length || 0) > 15 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>+{resume_data.all_skills_flat.length - 15} more</span>
                  )}
                </div>
              </div>
            </div>

            {/* India Insights */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🇮🇳 Indian Market Insights
              </h3>
              
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Estimated Market Value</div>
                <div style={{ fontSize: '1.2rem', color: '#10b981', fontWeight: 800 }}>
                  {india_insights?.salary_intelligence?.current_market_value || 'Unknown'}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>
                    → {india_insights?.salary_intelligence?.after_skill_upgrade || ''} (after upskilling)
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Top Target Companies</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {india_insights?.salary_intelligence?.top_paying_companies_for_profile?.map(c => (
                    <span key={c} style={{ background: 'var(--white-5)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.25rem 0.75rem', borderRadius: 999, fontSize: '0.8rem' }}>{c}</span>
                  ))}
                </div>
              </div>

              {india_insights?.govt_eligibility?.recommended_govt_exams?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Govt Exam Recommendations</div>
                  {india_insights.govt_eligibility.recommended_govt_exams.map((exam, i) => (
                    <div key={i} style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', padding: '0.75rem', borderRadius: 8, marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>🏛️ {exam.exam}</div>
                      <div style={{ color: 'var(--brand)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{exam.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(16,185,129,0.1)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize: '2rem' }}>💡</div>
                <div>
                  <div style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem', marginBottom: '0.2rem' }}>Immediate Action Suggested</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{summary_card?.immediate_action}</div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* JOB MATCHES TAB */}
        {tab === 'matches' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>🎯 Top Recommendations</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Best jobs based on your skills, experience, and keywords.</p>
            </div>

            {topPicks.length > 0 ? (
              <div style={{ display: 'grid', gap: '1rem', marginBottom: '3rem' }}>
                {topPicks.map((job, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: '#10b981' }} />
                    <div style={{ flex: '1 1 300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{job.job_title}</h4>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: 999, fontWeight: 700 }}>
                          {job.match_score}% MATCH
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{job.organization} • {job.location || 'All India'} • {job.salary_range}</div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}><strong>Why:</strong> {job.why_recommended}</p>
                    </div>
                    <div style={{ flex: '0 0 auto', background: 'var(--white-5)', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)', maxWidth: 280 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--brand-l)', fontWeight: 700, marginBottom: '0.25rem', textTransform: 'uppercase' }}>Expert Tip</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{job.quick_tip}"</div>
                    </div>
                    <div style={{ flex: '0 0 100%', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <a href={job.apply_url} target="_blank" rel="noreferrer" style={{ padding: '0.6rem 1.5rem', background: '#6366f1', color: '#fff', fontSize: '0.85rem', fontWeight: 700, borderRadius: 8, textDecoration: 'none' }}>
                        Apply Now →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No strong job recommendations found.</p>
            )}

            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>All Job Matches ({safeJobMatches.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {safeJobMatches.map((job, idx) => (
                <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{job.job_title}</div>
                    <div style={{ fontWeight: 800, color: job.match_score >= 65 ? '#10b981' : job.match_score >= 40 ? '#f59e0b' : '#ef4444', fontSize: '1.1rem' }}>{job.match_score}%</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>{job.organization}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--text-muted)' }}>Skills Match:</span> <strong style={{ color: 'var(--text-primary)' }}>{job.score_breakdown?.skills}/50</strong></div>
                    <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--text-muted)' }}>Exp Match:</span> <strong style={{ color: 'var(--text-primary)' }}>{job.score_breakdown?.experience}/20</strong></div>
                  </div>
                  <a href={job.apply_url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: '0.5rem', background: 'var(--white-5)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, borderRadius: 6, textDecoration: 'none' }}>
                    View Job
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ATS ANALYSIS TAB */}
        {tab === 'ats' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>ATS Breakdown</h3>
              
              {[
                { label: 'Keywords & Optimization', data: ats_analysis?.breakdown?.keywords },
                { label: 'Skills Relevance', data: ats_analysis?.breakdown?.skills },
                { label: 'Experience & Clarity', data: ats_analysis?.breakdown?.experience },
                { label: 'Formatting & Readability', data: ats_analysis?.breakdown?.format },
                { label: 'Education Match', data: ats_analysis?.breakdown?.education },
              ].map((item, i) => {
                if (!item.data) return null
                const pct = (item.data.score / item.data.max) * 100
                const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{item.label}</div>
                      <div style={{ fontWeight: 800, color }}>{item.data.score} / {item.data.max}</div>
                    </div>
                    <div style={{ height: 6, background: 'var(--white-8)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.75rem' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.data.verdict}</div>
                  </div>
                )
              })}
            </div>

            <div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', top: '5.5rem', position: 'sticky' }}>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>System Compatibility</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {ats_analysis?.ats_compatibility && Object.entries(ats_analysis.ats_compatibility).map(([sys, score]) => (
                    <div key={sys} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{sys}</span>
                      <strong style={{ color: score >= 75 ? '#10b981' : '#f59e0b' }}>{score}%</strong>
                    </div>
                  ))}
                </div>

                <h4 style={{ fontSize: '1rem', color: '#ef4444', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>🚩 Red Flags</h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem' }}>
                  {ats_analysis?.red_flags?.map((flag, i) => <li key={i}>{flag}</li>)}
                  {(!ats_analysis?.red_flags || ats_analysis.red_flags.length === 0) && <li style={{ color: 'var(--text-muted)', listStyle: 'none', marginLeft: '-1.2rem' }}>No critical red flags.</li>}
                </ul>

                <h4 style={{ fontSize: '1rem', color: '#10b981', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>✅ Green Flags</h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {ats_analysis?.green_flags?.map((flag, i) => <li key={i}>{flag}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* IMPROVE TAB */}
        {tab === 'improve' && (
          <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>Action Plan</h3>
              <p style={{ color: 'var(--brand)', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.25rem' }}>Total Potential ATS Improvement: {suggestions?.total_potential_ats_improvement || '+0'}</p>
            </div>

            {suggestions?.critical?.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '1.5rem' }}>
                <h4 style={{ fontSize: '1rem', color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🔴 Critical Fixes (Do This First)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {suggestions.critical.map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{s.issue}</strong>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.1)', color: '#c7d2fe', padding: '0.15rem 0.5rem', borderRadius: 999 }}>{s.ats_impact}</span>
                      </div>
                      {s.current && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textDecoration: 'line-through' }}>Instead of: "{s.current}"</div>}
                      {s.improved && <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>Use: "{s.improved}"</div>}
                      {s.action && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.action}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestions?.important?.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 16, padding: '1.5rem' }}>
                <h4 style={{ fontSize: '1rem', color: '#f59e0b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🟡 Important Improvements
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {suggestions.important.map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.25rem' }}>{s.issue}</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.action}</div>
                      <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.5rem', fontWeight: 600 }}>Impact: {s.ats_impact}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestions?.career_path && (
              <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 16, padding: '1.5rem' }}>
                <h4 style={{ fontSize: '1.1rem', color: '#c084fc', marginBottom: '1rem' }}>📈 Career Growth Plan</h4>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-card)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{suggestions.career_path.current_level}</div>
                  <div style={{ color: 'var(--text-muted)' }}>→</div>
                  <div style={{ padding: '0.5rem 1rem', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{suggestions.career_path.next_level}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Skills to Add</div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {suggestions.career_path.skills_to_add?.map(s => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Recommended Certs</div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {suggestions.career_path.recommended_certifications?.map(c => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
