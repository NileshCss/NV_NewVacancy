import { ALL_SKILLS } from './data/skills.js'
import { getDegreeLevel } from './data/degrees.js'

// ── Section header patterns ──────────────────────────
const SECTIONS = {
  summary:        /^\s*(summary|objective|profile|about|overview)/im,
  skills:         /^\s*(skills|technologies|tech stack|expertise)/im,
  experience:     /^\s*(experience|employment|work history|career)/im,
  education:      /^\s*(education|qualification|academic)/im,
  projects:       /^\s*(projects|portfolio|works|personal projects)/im,
  certifications: /^\s*(certif|certificate|courses|training)/im,
  achievements:   /^\s*(achievement|award|honor|recognition)/im,
}

// ── OLD DATABASE (keeping for reference, not used) ──
export const SKILLS_DB = {
  technical: [
    // Programming languages
    'javascript','typescript','python','java','c++','c#',
    'php','ruby','swift','kotlin','go','rust','scala',
    // Frontend
    'react','vue','angular','nextjs','html','css',
    'tailwind','bootstrap','sass','jquery','redux',
    // Backend
    'nodejs','express','django','flask','spring','laravel',
    'fastapi','nestjs','graphql','rest api','microservices',
    // Database
    'mysql','postgresql','mongodb','redis','firebase',
    'supabase','oracle','sql server','sqlite','dynamodb',
    // Cloud & DevOps
    'aws','azure','gcp','docker','kubernetes','jenkins',
    'github actions','ci/cd','terraform','ansible','linux',
    // Mobile
    'react native','flutter','android','ios','xamarin',
    // Data & AI
    'machine learning','deep learning','tensorflow','pytorch',
    'pandas','numpy','scikit-learn','tableau','power bi',
    'data analysis','data science','opencv','nlp',
    // Testing
    'jest','selenium','cypress','junit','postman',
    // Tools
    'git','jira','figma','vs code','intellij',
  ],
  soft: [
    'leadership','communication','teamwork','problem solving',
    'critical thinking','time management','creativity',
    'adaptability','collaboration','project management',
    'analytical','presentation','negotiation','mentoring',
  ],
  domain: [
    'banking','finance','healthcare','education','ecommerce',
    'logistics','manufacturing','telecom','insurance',
    'government','retail','media','hospitality',
  ],
  certifications: [
    'aws certified','azure certified','google cloud',
    'pmp','scrum','agile','cissp','ceh','ccna',
    'oracle certified','microsoft certified','comptia',
  ],
}

// ── Indian Education Degrees ─────────────────────────
const DEGREES = {
  high: ['phd','doctorate','post doctoral','m.tech','mtech',
         'mca','mba','m.sc','msc','m.a','ma','llm'],
  mid:  ['b.tech','btech','bca','bsc','b.sc','b.a','ba',
         'bba','bcom','b.com','lllb','be','b.e'],
  basic:['diploma','itm','12th','hsc','intermediate',
         '10th','ssc','matriculation'],
}

// ── Section detectors ────────────────────────────────
const SECTION_PATTERNS = {
  summary:        /summary|objective|profile|about|overview/i,
  skills:         /skills|technologies|tech stack|expertise/i,
  experience:     /experience|employment|work history|career/i,
  education:      /education|qualification|academic/i,
  projects:       /projects|portfolio|works/i,
  certifications: /certification|certificate|courses|training/i,
  achievements:   /achievement|award|honor|recognition/i,
}

// ── Extract email ─────────────────────────────────────
function extractEmail(text) {
  const match = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  )
  return match ? match[0].toLowerCase() : null
}

// ── Extract phone ─────────────────────────────────────
function extractPhone(text) {
  const match = text.match(
    /(\+91[\s-]?)?[6-9]\d{9}|(\+91[\s-]?)?\d{10}/
  )
  return match ? match[0].replace(/\s/g, '') : null
}

// ── Extract name (first non-email line) ──────────────
function extractName(text) {
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2 && l.length < 60)

  for (const line of lines.slice(0, 8)) {
    // Skip lines that look like emails, phones, URLs
    if (line.includes('@')) continue
    if (/\d{7,}/.test(line)) continue
    if (line.startsWith('http')) continue
    if (/[<>{}[\]]/.test(line)) continue
    // Must have at least 2 words that look like a name
    const words = line.split(/\s+/)
    if (words.length >= 2 && words.length <= 5) {
      if (words.every(w => /^[A-Za-z.'-]+$/.test(w))) {
        return line
      }
    }
  }
  return null
}

// ── Extract skills from text ──────────────────────────
function extractSkills(text) {
  const lower = text.toLowerCase()
  const found = new Set()

  for (const skill of ALL_SKILLS) {
    // Match whole word only
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(lower)) {
      found.add(skill)
    }
  }

  return [...found]
}

// ── Extract experience years ──────────────────────────
function extractExperienceYears(text) {
  // Look for explicit mentions
  const explicit = text.match(
    /(\d+\.?\d*)\s*\+?\s*years?\s*(of\s*)?(experience|exp)/i
  )
  if (explicit) return parseFloat(explicit[1])

  // Calculate from date ranges
  const dateRanges = [
    ...text.matchAll(
      /(\d{4})\s*[-–—to]+\s*(present|current|\d{4})/gi
    )
  ]

  if (dateRanges.length === 0) return 0

  let totalMonths = 0
  const currentYear = new Date().getFullYear()

  for (const range of dateRanges) {
    const start = parseInt(range[1])
    const endStr = range[2].toLowerCase()
    const end = (endStr === 'present' || endStr === 'current')
      ? currentYear
      : parseInt(range[2])

    if (start >= 1990 && end >= start && end <= currentYear + 1) {
      totalMonths += (end - start) * 12
    }
  }

  return Math.round((totalMonths / 12) * 10) / 10
}

// ── Extract education ─────────────────────────────────
function extractEducation(text) {
  const lower = text.toLowerCase()

  // Common degrees to look for (highest level first)
  const degrees = [
    'phd','doctorate','m.tech','mtech','mca','mba','m.sc','msc',
    'b.tech','btech','bca','bsc','b.sc','bcom','b.com','be','b.e',
    'diploma','12th','hsc','10th','ssc',
  ]

  for (const degree of degrees) {
    if (lower.includes(degree)) {
      const idx = lower.indexOf(degree)
      const nearby = text.slice(
        Math.max(0, idx - 100),
        Math.min(text.length, idx + 200)
      )

      const cgpa = nearby.match(/(\d+\.?\d*)\s*(cgpa|gpa|\/10)/i)
      const pct  = nearby.match(/(\d+\.?\d*)\s*%/)
      const year = nearby.match(/20\d{2}/)

      return {
        degree,
        level: getDegreeLevel(degree),
        score: cgpa ? `${cgpa[1]} CGPA`
              : pct  ? `${pct[1]}%`
              : null,
        year: year ? year[0] : null,
      }
    }
  }

  return null
}

// ── Extract projects ──────────────────────────────────
function extractProjects(text) {
  const projects = []
  const lines    = text.split('\n')
  let inProjects = false
  let current    = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (SECTION_PATTERNS.projects.test(trimmed)) {
      inProjects = true
      continue
    }

    // Stop at next section
    if (inProjects) {
      const isNewSection = Object.values(SECTION_PATTERNS)
        .some(p => p.test(trimmed)) &&
        !SECTION_PATTERNS.projects.test(trimmed)

      if (isNewSection) break

      // New project (usually starts with bullet or title case)
      if (trimmed.startsWith('•') ||
          trimmed.startsWith('-') ||
          trimmed.startsWith('*') ||
          /^[A-Z][a-zA-Z\s]+$/.test(trimmed.slice(0, 30))) {

        if (current) projects.push(current)
        current = {
          name: trimmed.replace(/^[•\-*]\s*/, '').slice(0, 60),
          description: '',
          technologies: extractSkills(trimmed),
        }
      } else if (current) {
        current.description += ' ' + trimmed
        current.technologies = [
          ...new Set([
            ...current.technologies,
            ...extractSkills(trimmed),
          ])
        ]
      }
    }
  }

  if (current) projects.push(current)
  return projects.slice(0, 10)
}

// ── Extract certifications ────────────────────────────
function extractCertifications(text) {
  const certs = []
  const lower = text.toLowerCase()

  for (const cert of SKILLS_DB.certifications) {
    if (lower.includes(cert)) {
      certs.push(cert)
    }
  }

  // Also look for "certified" keyword near technology names
  const certMatches = [
    ...text.matchAll(
      /certified\s+in\s+([a-zA-Z\s]+)/gi
    )
  ]
  for (const m of certMatches) {
    certs.push(m[1].trim().slice(0, 50))
  }

  return [...new Set(certs)]
}

// ── Detect which sections are present ────────────────
function detectSections(text) {
  const sections = {}
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    sections[key] = pattern.test(text)
  }
  return sections
}

// ── Extract keywords (for ATS) ────────────────────────
function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)

  // Count frequency
  const freq = {}
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1
  }

  // Return top keywords (freq > 1, not common words)
  const common = new Set([
    'and','the','for','are','but','not','you','all','can','had','her','was','one','our','out','day','get','has','him','his','how','its','may','new','now','old','see','two','way','who','boy','did','has','her','him','his','how','its','may','new','now','old','see','two','way','who','boy','did','its','let','put','say','she','too','use','end','for','had','has','her','him','his','how','its','may','new','now','old','see','two','way','who','boy','did','its','let','put','say','she','too','use'
  ])

  return Object.entries(freq)
    .filter(([w, c]) => c > 1 && !common.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w)
}

// ── Main parse function ──────────────────────────────
export function parseResume(text) {
  if (!text || typeof text !== 'string') return null

  const resume = {
    name:           extractName(text),
    email:          extractEmail(text),
    phone:          extractPhone(text),
    skills:         extractSkills(text),
    skillCount:     0,
    experience:     extractExperienceYears(text),
    education:      extractEducation(text),
    projects:       extractProjects(text),
    certifications: extractCertifications(text),
    keywords:       extractKeywords(text),
    sections:       detectSections(text),
  }

  resume.skillCount = resume.skills.length

  return resume
}

// ── File extraction (PDF/DOCX) ───────────────────────
export async function extractFromFile(file) {
  if (!file) return ''

  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    // PDF extraction using PDF.js
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await import('pdfjs-dist')
    pdf.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'

    const doc = await pdf.getDocument({ data: arrayBuffer }).promise
    let text = ''

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map(item => item.str).join(' ') + '\n'
    }

    return text.trim()
  }

  if (ext === 'docx') {
    // DOCX extraction using Mammoth
    const arrayBuffer = await file.arrayBuffer()
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
  }

  // Plain text files
  if (ext === 'txt') {
    return await file.text()
  }

  throw new Error(`Unsupported file type: ${ext}`)
}
