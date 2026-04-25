import { SKILL_DEMAND }   from './data/skills.js'
import { getResource }    from './data/resources.js'

export function analyzeGaps(resume, topJobs) {
  const have = new Set(
    (resume.skills || []).map(s => s.toLowerCase())
  )

  // Count how many jobs need each skill
  const freq = {}
  for (const job of topJobs) {
    for (const s of [
      ...(job.matchedSkills || []),
      ...(job.missingSkills || []),
    ]) {
      freq[s.toLowerCase()] = (freq[s.toLowerCase()] || 0) + 1
    }
  }

  // Gaps = skills needed by jobs but not in resume
  const gaps = Object.entries(freq)
    .filter(([skill]) => !have.has(skill))
    .sort(([,a], [,b]) => b - a)
    .map(([skill, count]) => ({
      skill,
      frequency:   count,
      demandScore: SKILL_DEMAND[skill] || 50,
      priority:    count >= 3 ? 'high' : count >= 2 ? 'medium' : 'low',
      resource:    getResource(skill),
    }))
    .slice(0, 12)

  // Strengths = skills in resume that jobs also want
  const strengths = Object.entries(freq)
    .filter(([skill]) => have.has(skill))
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([skill, count]) => ({
      skill,
      frequency:   count,
      demandScore: SKILL_DEMAND[skill] || 50,
    }))

  return {
    gaps,
    strengths,
    highPriority: gaps.filter(g => g.priority === 'high'),
    quickWins:    gaps.filter(
      g => g.priority !== 'high' && g.resource.weeks <= 3
    ),
  }
}
