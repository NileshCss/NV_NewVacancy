import { extractFromFile, parseResume } from './resumeParser.js'
import { calculateATS }                 from './atsScorer.js'
import { matchAll }                     from './jobMatcher.js'
import { analyzeGaps }                  from './skillGapAnalyzer.js'
import { generateRecs }                 from './recommendationEngine.js'

export { extractFromFile }

export async function runSmartMatch(file, jobs) {

  // ── 1. Extract text from file ──────────────────────
  const text = await extractFromFile(file)
  if (!text || text.length < 50) {
    throw new Error(
      'Could not read resume text. Try a different file.'
    )
  }

  // ── 2. Parse resume into structured data ──────────
  const resume = parseResume(text)
  if (!resume) throw new Error('Resume parsing failed.')

  // ── 3. ATS Score ───────────────────────────────────
  const primaryJob = jobs?.[0] || null
  const ats = calculateATS(resume, primaryJob)

  // ── 4. Match against all jobs ──────────────────────
  const matches = matchAll(resume, jobs || [])

  // ── 5. Skill gap analysis ──────────────────────────
  const gaps = analyzeGaps(resume, matches.all.slice(0, 15))

  // ── 6. Recommendations ────────────────────────────
  const recs = generateRecs(resume, ats, gaps)

  // ── 7. Summary card ───────────────────────────────
  const best = matches.top[0]
  const readiness = Math.round(
    ats.score * 0.5 + (best?.matchScore || 0) * 0.5
  )

  const summary = {
    name:           resume.name || 'Candidate',
    readiness,
    atsScore:       ats.score,
    atsGrade:       ats.grade,
    atsLabel:       ats.label,
    bestJob:        best?.title || null,
    bestOrg:        best?.organization || null,
    bestScore:      best?.matchScore || 0,
    bestUrl:        best?.applyUrl || null,
    bestDaysLeft:   best?.daysLeft,
    skillCount:     resume.skillCount,
    jobsToApply:    matches.top.length,
    topStrength:    gaps.strengths[0]?.skill || null,
    topGap:         gaps.gaps[0]?.skill || null,
    potentialGain:  recs.potentialGain,
    action:
      best
        ? `Apply to "${best.title}" at ${best.organization}${
            best.daysLeft > 0 ? ` — ${best.daysLeft} days left!` : ''
          }`
        : 'Improve resume then search for jobs',
  }

  return {
    // Meta
    at:      new Date().toISOString(),
    file:    file.name,
    resume,
    ats,
    matches,
    gaps,
    recs,
    summary
  }
}

