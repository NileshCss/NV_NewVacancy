import { calculateATS } from './atsScorer.js'

// Match one resume to one job
export function matchOne(resume, job) {
  const ats = calculateATS(resume, job)
  const b   = ats.breakdown

  // Job Match Formula:
  // Skills 50% + Experience 20% + Education 20% + Keywords 10%
  const raw = Math.min(100, Math.round(
    b.skills.score     * 0.50 +
    b.experience.score * 0.20 +
    b.education.score  * 0.20 +
    b.keywords.score   * 0.10
  ))

  // Deadline penalty
  const today    = new Date()
  const lastDate = job.last_date ? new Date(job.last_date) : null
  const daysLeft = lastDate
    ? Math.ceil((lastDate - today) / 86400000)
    : null

  const penalty  =
    daysLeft === null  ? 0 :
    daysLeft < 0       ? 15 :
    daysLeft === 0     ? 8  : 0

  const score = Math.max(0, raw - penalty)

  return {
    // Job info
    jobId:        job.id,
    title:        job.title,
    organization: job.organization,
    category:     job.category,
    location:     job.location,
    salary:       job.salary_range,
    applyUrl:     job.apply_url,
    lastDate:     job.last_date,
    daysLeft,
    isExpired:    daysLeft !== null && daysLeft < 0,

    // Scores
    matchScore:   score,
    atsScore:     ats.score,
    atsGrade:     ats.grade,

    // Skills
    matchedSkills: b.skills.matched,
    missingSkills: b.skills.missing,

    // Strength label
    strength:
      score >= 80 ? 'excellent' :
      score >= 65 ? 'good'      :
      score >= 50 ? 'fair'      : 'weak',
  }
}

// Match one resume to all jobs
export function matchAll(resume, jobs) {
  if (!jobs?.length) {
    return {
      all:[], top:[], good:[], stretch:[],
      total:0, strongCount:0
    }
  }

  const results = jobs
    .filter(j => j.is_active !== false)
    .map(j => matchOne(resume, j))
    .sort((a, b) => b.matchScore - a.matchScore)

  const notExpired = results.filter(r => !r.isExpired)

  return {
    all:         results,
    top:         notExpired.filter(r => r.matchScore >= 70).slice(0, 8),
    good:        notExpired.filter(r => r.matchScore >= 50 && r.matchScore < 70).slice(0, 6),
    stretch:     notExpired.filter(r => r.matchScore >= 35 && r.matchScore < 50).slice(0, 4),
    total:       jobs.length,
    strongCount: notExpired.filter(r => r.matchScore >= 70).length,
  }
}
