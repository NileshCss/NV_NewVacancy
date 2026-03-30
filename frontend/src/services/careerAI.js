import OpenAI from 'openai'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ─────────────────────────────────────────────────────────────────
// OpenAI Client (uses VITE_OPENAI_API_KEY from .env)
// ─────────────────────────────────────────────────────────────────
const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true,
})

if (!import.meta.env.VITE_OPENAI_API_KEY) {
  console.warn('[NV-AI] VITE_OPENAI_API_KEY is not set. AI analysis will fail.')
}

// ─────────────────────────────────────────────────────────────────
// PDF Text Extraction — uses local pdfjs worker (no CDN needed)
// ─────────────────────────────────────────────────────────────────
export async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

        const typedArray = new Uint8Array(e.target.result)
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise

        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          fullText += content.items.map(item => item.str).join(' ') + '\n'
        }

        resolve(fullText.trim())
      } catch (err) {
        reject(new Error(`PDF parsing failed: ${err.message}`))
      }
    }
    reader.onerror = () => reject(new Error('File reading failed'))
    reader.readAsArrayBuffer(file)
  })
}

// ─────────────────────────────────────────────────────────────────
// DOCX Text Extraction
// ─────────────────────────────────────────────────────────────────
export async function extractTextFromDOCX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer: e.target.result })
        resolve(result.value.trim())
      } catch (err) {
        reject(new Error(`DOCX parsing failed: ${err.message}`))
      }
    }
    reader.onerror = () => reject(new Error('File reading failed'))
    reader.readAsArrayBuffer(file)
  })
}

// ─────────────────────────────────────────────────────────────────
// Unified text extractor — auto-detects format
// ─────────────────────────────────────────────────────────────────
export async function extractResumeText(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf'))  return extractTextFromPDF(file)
  if (name.endsWith('.docx') || name.endsWith('.doc')) return extractTextFromDOCX(file)
  if (name.endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('File reading failed'))
      reader.readAsText(file)
    })
  }
  throw new Error('Unsupported format. Please upload PDF, DOCX, or TXT.')
}

// ─────────────────────────────────────────────────────────────────
// NV-AI CAREER INTELLIGENCE — Main Analysis Engine (OpenAI GPT-4o-mini)
// ─────────────────────────────────────────────────────────────────
export async function analyzeResumeWithAI({
  resumeText,
  jobs,
  targetJob = null,
  userPreferences = null,
  onProgress = () => {},
}) {
  onProgress('🧠 Parsing your resume structure...')

  // Slim down jobs payload — only include fields AI needs
  const jobsSlim = jobs.slice(0, 30).map(j => ({
    id:           j.id,
    title:        j.title,
    organization: j.organization,
    category:     j.category,
    location:     j.location || 'All India',
    salary_range: j.salary_range || null,
    tags:         j.tags || [],
    last_date:    j.last_date || null,
    apply_url:    j.apply_url,
  }))

  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are NV-AI, an advanced career intelligence assistant for New_vacancy — India's leading job portal.
You combine: senior HR recruiter expertise, ATS scoring engine (like Workday/Greenhouse), professional Indian market career coach, and technical skills assessor.

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no backticks, no text outside JSON
- All scores must be numbers, arrays must be arrays (never null)
- Match scores capped at 100, minimum 0
- Sort job_matches by match_score descending
- Never fabricate data not in the resume
- Today is ${today}`

  const userMessage = `Analyze this resume and match against the jobs. Return the exact JSON structure below.

RESUME:
${resumeText.slice(0, 5500)}

JOBS (${jobsSlim.length} listings):
${JSON.stringify(jobsSlim)}

TARGET JOB: ${targetJob ? JSON.stringify(targetJob) : 'None'}
PREFERENCES: ${userPreferences ? JSON.stringify(userPreferences) : 'None'}

Return this exact JSON (fill all fields with real data):
{
  "summary_card": {
    "candidate_name": "",
    "overall_readiness": "",
    "best_match_job": "",
    "best_match_score": 0,
    "ats_score": 0,
    "top_strength": "",
    "top_weakness": "",
    "immediate_action": "",
    "jobs_worth_applying": 0,
    "estimated_interview_calls": ""
  },
  "resume_data": {
    "personal": { "name": null, "email": null, "phone": null, "location": null },
    "professional_summary": "",
    "skills": { "technical": [], "soft": [], "tools": [], "domain": [] },
    "all_skills_flat": [],
    "experience": { "total_years": 0, "current_role": null, "seniority_level": "fresher" },
    "education": [],
    "certifications": [],
    "projects": []
  },
  "job_matches": [
    {
      "job_id": "", "job_title": "", "organization": "", "category": "",
      "location": "", "salary_range": null, "apply_url": "",
      "last_date": null, "match_score": 0,
      "score_breakdown": { "skills": 0, "experience": 0, "keywords": 0, "education": 0 },
      "matched_skills": [], "missing_skills": [],
      "match_strength": "weak", "recommendation_reason": "", "application_tip": ""
    }
  ],
  "recommended_jobs": {
    "top_picks": [
      {
        "rank": 1, "job_id": "", "job_title": "", "organization": "",
        "match_score": 0, "why_recommended": "", "urgency": "medium",
        "days_left": null, "apply_url": "", "salary_range": null,
        "location": "", "quick_tip": ""
      }
    ],
    "total_matches": 0, "strong_matches": 0, "moderate_matches": 0
  },
  "ats_analysis": {
    "overall_ats_score": 0,
    "grade": "C",
    "percentile": "",
    "breakdown": {
      "keywords":   { "score": 0, "max": 30, "found_keywords": [], "missing_keywords": [], "verdict": "" },
      "skills":     { "score": 0, "max": 25, "verdict": "" },
      "experience": { "score": 0, "max": 20, "verdict": "" },
      "format":     { "score": 0, "max": 15, "verdict": "" },
      "education":  { "score": 0, "max": 10, "verdict": "" }
    },
    "ats_compatibility": { "workday": 0, "greenhouse": 0, "taleo": 0, "naukri": 0, "linkedin": 0 },
    "red_flags": [],
    "green_flags": []
  },
  "suggestions": {
    "critical": [{ "issue": "", "current": "", "improved": "", "ats_impact": "+5", "action": "" }],
    "important": [{ "issue": "", "action": "", "ats_impact": "+2" }],
    "career_path": {
      "current_level": "", "next_level": "",
      "skills_to_add": [], "recommended_certifications": [],
      "timeline": "", "salary_projection": ""
    },
    "total_potential_ats_improvement": "+0"
  },
  "india_insights": {
    "govt_eligibility": {
      "is_eligible_for_ssc": false,
      "is_eligible_for_banking": false,
      "recommended_govt_exams": [{ "exam": "", "reason": "" }]
    },
    "salary_intelligence": {
      "current_market_value": "",
      "after_skill_upgrade": "",
      "top_paying_companies_for_profile": []
    },
    "market_demand": {
      "skill_demand_score": 0,
      "most_valued_skills": [],
      "trending_skills_missing": []
    }
  }
}`

  onProgress('🤖 AI analyzing resume & matching jobs...')

  let response
  try {
    response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.15,
      max_tokens: 4000,
      response_format: { type: 'json_object' }, // Forces valid JSON, no markdown wrapping
    })
  } catch (err) {
    // Surface a clear API error to the user
    const msg = err?.error?.message || err?.message || 'OpenAI API error'
    throw new Error(`AI request failed: ${msg}`)
  }

  onProgress('📊 Processing results...')

  const raw = response.choices[0]?.message?.content?.trim()
  if (!raw) throw new Error('AI returned an empty response. Please try again.')

  try {
    return JSON.parse(raw)
  } catch {
    // Fallback: try to extract JSON from response
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) } catch { /* fall through */ }
    }
    throw new Error('Failed to parse AI response. Please try again.')
  }
}
