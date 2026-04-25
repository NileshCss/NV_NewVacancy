export function generateRecs(resume, ats, gaps) {
  const checks = ats.breakdown.completeness.checks || {}
  const score  = ats.score
  const recs   = { critical:[], important:[], tips:[], quickWins:[] }

  // ── CRITICAL ──────────────────────────────────────
  if (!checks.summary) {
    recs.critical.push({
      icon:   '📝',
      issue:  'No professional summary',
      action: 'Add a 3-4 line summary at the top: your role, ' +
              'years of experience, and 2-3 key skills',
      gain:   '+12 ATS pts',
    })
  }

  if (!checks.skills || resume.skillCount < 4) {
    recs.critical.push({
      icon:   '🛠',
      issue:  'Skills section missing or too weak',
      action: 'Add a dedicated Skills section listing 8-12 ' +
              'relevant technical and soft skills',
      gain:   '+15 ATS pts',
    })
  }

  if (gaps.highPriority.length > 0) {
    const list = gaps.highPriority.slice(0, 4).map(g => g.skill).join(', ')
    recs.critical.push({
      icon:   '⚡',
      issue:  'Missing high-demand skills',
      action: `Add these to your resume if you know them: ${list}`,
      gain:   `+${Math.min(20, gaps.highPriority.length * 5)} ATS pts`,
    })
  }

  // ── IMPORTANT ─────────────────────────────────────
  if (!checks.phone) {
    recs.important.push({
      icon:   '📱',
      issue:  'No phone number',
      action: 'Add phone in format: +91 XXXXX XXXXX',
      gain:   'Recruiter contact',
    })
  }

  if (!checks.projects || resume.projects?.length < 2) {
    recs.important.push({
      icon:   '🚀',
      issue:  'Not enough projects',
      action: 'Add 2-3 projects with: name, tech used, ' +
              'your role, and measurable outcome',
      gain:   '+8 ATS pts',
    })
  }

  if (score < 60) {
    recs.important.push({
      icon:   '🎯',
      issue:  'Low keyword alignment',
      action: 'Use exact terms from job descriptions. ' +
              'Replace "made" with "developed", "helped" with "led"',
      gain:   '+10 ATS pts',
    })
  }

  if (resume.wordCount < 200) {
    recs.important.push({
      icon:   '📄',
      issue:  'Resume too short',
      action: 'Aim for 400-800 words. Expand experience ' +
              'and project descriptions with metrics',
      gain:   'Better parsing',
    })
  }

  // ── TIPS ──────────────────────────────────────────
  if (!checks.certifications) {
    recs.tips.push({
      icon:   '🏆',
      issue:  'No certifications listed',
      action: 'Add free certs from Google, AWS, LinkedIn ' +
              'Learning, or NPTEL',
      gain:   '+5 ATS pts',
    })
  }

  if (!checks.socialLink) {
    recs.tips.push({
      icon:   '🔗',
      issue:  'No LinkedIn or GitHub link',
      action: 'Add your LinkedIn and/or GitHub profile URLs',
      gain:   '87% of tech recruiters check these',
    })
  }

  // ── QUICK WINS ────────────────────────────────────
  if (!checks.phone)   recs.quickWins.push('Add phone number — 2 minutes')
  if (!checks.summary) recs.quickWins.push('Write 3-line summary — 10 minutes')
  if (gaps.quickWins?.[0]) {
    recs.quickWins.push(
      `Add "${gaps.quickWins[0].skill}" to skills — 1 minute`
    )
  }
  if (!checks.certifications) {
    recs.quickWins.push('Add a Google/LinkedIn cert — 5 minutes')
  }

  // ── CAREER PATH ───────────────────────────────────
  const yrs = resume.experienceYears || 0
  recs.careerPath = {
    current:     yrs === 0 ? 'Fresher'  : yrs < 2 ? 'Junior'    : yrs < 5 ? 'Mid-Level' : yrs < 8 ? 'Senior'    : 'Expert',
    next:        yrs === 0 ? 'Junior'   : yrs < 2 ? 'Mid-Level' : yrs < 5 ? 'Senior'    : yrs < 8 ? 'Lead/Architect' : 'CTO/Principal',
    salaryNow:   yrs === 0 ? '₹2.5–5 LPA' : yrs < 2 ? '₹4–8 LPA'  : yrs < 5 ? '₹8–18 LPA'  : yrs < 8 ? '₹18–35 LPA' : '₹35+ LPA',
    salaryNext:  yrs === 0 ? '₹4–8 LPA'   : yrs < 2 ? '₹8–15 LPA' : yrs < 5 ? '₹15–28 LPA' : '₹30–50 LPA',
    learnNext:   gaps.highPriority.slice(0, 3).map(g => g.skill),
    timeline:    resume.skillCount >= 10 ? '3-6 months' : resume.skillCount >= 5 ? '6-9 months' : '9-12 months',
  }

  // ── POTENTIAL SCORE GAIN ──────────────────────────
  recs.potentialGain = Math.min(
    100 - score,
    [...recs.critical, ...recs.important].reduce((sum, r) => {
      return sum + (parseInt(r.gain?.match(/\d+/)?.[0] || 0))
    }, 0)
  )

  return recs
}
