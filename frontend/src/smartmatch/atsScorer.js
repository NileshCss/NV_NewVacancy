import { DEGREE_SCORES } from './data/degrees.js'

// ── Scoring weights ──────────────────────────────────
const W = {
  skills:       0.40,
  experience:   0.25,
  education:    0.15,
  completeness: 0.10,
  keywords:     0.10,
}

// ── 1. Skill Match Score ─────────────────────────────
function scoreSkills(candidateSkills, jobTags) {
  if (!jobTags?.length) {
    return { score: 70, matched: [], missing: [] }
  }

  const cSet = new Set(candidateSkills.map(s => s.toLowerCase()))
  const matched = []
  const missing = []

  for (const tag of jobTags) {
    const lower = tag.toLowerCase()
    const found = cSet.has(lower) ||
      [...cSet].some(s => s.includes(lower) || lower.includes(s))

    found ? matched.push(tag) : missing.push(tag)
  }

  return {
    score:   Math.min(100, Math.round(
      (matched.length / jobTags.length) * 100
    )),
    matched,
    missing,
  }
}

// ── 2. Experience Score ──────────────────────────────
function scoreExperience(years, category) {
  if (category === 'govt') {
    return { score: 80, label: 'Open to all candidates' }
  }

  const expected = years >= 5 ? 5 : years >= 3 ? 3 : years >= 1 ? 1 : 0
  const score = years >= expected
    ? 100
    : Math.round((years / Math.max(expected, 1)) * 100)

  return {
    score,
    label: `${years} yrs experience`,
  }
}

// ── 3. Education Score ───────────────────────────────
function scoreEducation(level, jobQualification) {
  const base = DEGREE_SCORES[level] || DEGREE_SCORES.unknown

  if (!jobQualification) return { score: base }

  const req = jobQualification.toLowerCase()

  if (
    req.includes('b.tech') || req.includes('graduate') ||
    req.includes('degree') || req.includes('bca')
  ) {
    const score =
      level === 'postgraduate' ? 100 :
      level === 'graduate'     ? 100 :
      level === 'diploma'      ?  60 : 40
    return { score }
  }

  if (req.includes('12th') || req.includes('hsc')) {
    return { score: level !== 'unknown' ? 100 : 60 }
  }

  return { score: base }
}

// ── 4. Completeness Score ────────────────────────────
function scoreCompleteness(resume) {
  const checks = {
    name:           Boolean(resume.name),
    email:          Boolean(resume.email),
    phone:          Boolean(resume.phone),
    skills:         resume.skillCount > 3,
    experience:     resume.experienceYears > 0 || resume.sections?.experience,
    education:      Boolean(resume.education),
    projects:       resume.projects?.length > 0,
    summary:        Boolean(resume.sections?.summary),
    certifications: resume.certifications?.length > 0,
    socialLink:     Boolean(resume.linkedin || resume.github),
  }

  const filled = Object.values(checks).filter(Boolean).length
  const total  = Object.keys(checks).length

  return {
    score:  Math.round((filled / total) * 100),
    checks,
    filled,
    total,
  }
}

// ── 5. Keyword Score ─────────────────────────────────
function scoreKeywords(resumeKeywords, jobTitle, jobTags) {
  const targets = [
    ...(jobTitle?.toLowerCase().split(/\s+/) || []),
    ...(jobTags?.map(t => t.toLowerCase()) || []),
  ]

  if (!targets.length) return { score: 50 }

  const rKw  = resumeKeywords.map(k => k.toLowerCase())
  const hits = targets.filter(t =>
    rKw.some(k => k.includes(t) || t.includes(k))
  ).length

  return { score: Math.min(100, Math.round((hits / targets.length) * 100)) }
}

// ─────────────────────────────────────────────────────
// MAIN ATS SCORER
// ─────────────────────────────────────────────────────

export function calculateATS(resume, job) {
  const skillResult = scoreSkills(
    resume.skills || [],
    job?.tags || []
  )
  const expResult  = scoreExperience(
    resume.experienceYears || 0,
    job?.category || 'private'
  )
  const eduResult  = scoreEducation(
    resume.educationLevel || 'unknown',
    job?.qualification || ''
  )
  const compResult = scoreCompleteness(resume)
  const kwResult   = scoreKeywords(
    resume.keywords || [],
    job?.title || '',
    job?.tags || []
  )

  // Weighted total
  const total = Math.min(100, Math.round(
    skillResult.score * W.skills       +
    expResult.score   * W.experience   +
    eduResult.score   * W.education    +
    compResult.score  * W.completeness +
    kwResult.score    * W.keywords
  ))

  const grade =
    total >= 85 ? 'A+' :
    total >= 75 ? 'A'  :
    total >= 65 ? 'B+' :
    total >= 55 ? 'B'  :
    total >= 45 ? 'C'  : 'D'

  return {
    score: total,
    grade,
    label:
      total >= 85 ? 'Excellent'      :
      total >= 70 ? 'Very Good'       :
      total >= 55 ? 'Good'            :
      total >= 40 ? 'Needs Work'      :
                    'Major Improvement Needed',
    breakdown: {
      skills:       { score: skillResult.score, weight: '40%', matched: skillResult.matched, missing: skillResult.missing },
      experience:   { score: expResult.score,   weight: '25%', label: expResult.label   },
      education:    { score: eduResult.score,   weight: '15%'                           },
      completeness: { score: compResult.score,  weight: '10%', checks: compResult.checks },
      keywords:     { score: kwResult.score,    weight: '10%'                           },
    },
  }
}
