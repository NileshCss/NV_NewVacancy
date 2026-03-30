import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ─────────────────────────────────────────────────────────────────
// Helper: Retry with exponential backoff
// ─────────────────────────────────────────────────────────────────
async function retryWithBackoff(fn, maxRetries = 3, initialDelayMs = 2000) {
  let lastError
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      
      // Only retry on rate limit errors
      if (err.message?.includes('429') || err.message?.includes('rate')) {
        if (attempt < maxRetries - 1) {
          const delayMs = initialDelayMs * Math.pow(2, attempt)
          console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} - Waiting ${delayMs}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
      }
      
      throw err
    }
  }
  
  throw lastError
}

// ─────────────────────────────────────────────────────────────────
// AI Chat — Using Google Gemini API (browser-compatible)
// ─────────────────────────────────────────────────────────────────

/** Call Google Gemini API directly from browser */
async function openAIChat({ messages, max_tokens = 3500, temperature = 0.15 }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  if (!apiKey) {
    throw new Error(
      '❌ Google Gemini API key not found.\n\n' +
      'Solution:\n' +
      '1. Open your .env file in the frontend folder\n' +
      '2. Add or update: VITE_GEMINI_API_KEY=your-key\n' +
      '3. Get your key from: https://aistudio.google.com/app/apikeys\n' +
      '4. Restart the dev server (npm run dev)'
    )
  }

  // Use retry logic to handle rate limits
  return retryWithBackoff(async () => {
    // Convert messages format for Gemini API
    let geminiMessages = []
    let systemInstruction = ''
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content
      } else {
        geminiMessages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: {
              text: systemInstruction || 'You are a helpful assistant that responds in JSON format.'
            }
          },
          contents: geminiMessages,
          generationConfig: {
            temperature,
            maxOutputTokens: max_tokens,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      const errorMsg = errorData?.error?.message || `HTTP ${response.status}`
      
      console.error('[openAIChat] Gemini API Error:', errorData)
      
      if (response.status === 401 || errorMsg.includes('API key')) {
        throw new Error(
          '❌ Invalid Google Gemini API key.\n\n' +
          'Solution:\n' +
          '1. Go to https://aistudio.google.com/app/apikeys\n' +
          '2. Create a new API key or use an existing one\n' +
          '3. Update VITE_GEMINI_API_KEY in your .env file\n' +
          '4. Restart the dev server'
        )
      }
      
      if (response.status === 429 || errorMsg.includes('rate')) {
        throw new Error('429_RATE_LIMIT: API rate limit exceeded. Retrying...')
      }
      
      if (errorMsg.includes('quota')) {
        throw new Error(
          '💳 API quota exceeded.\n\n' +
          'Solution: Check your Google Cloud billing at:\n' +
          'https://console.cloud.google.com/billing'
        )
      }
      
      throw new Error(`Gemini API Error: ${errorMsg}`)
    }

    const data = await response.json()
    
    if (data?.error) {
      throw new Error(`Gemini API Error: ${data.error.message}`)
    }

    // Extract the response text from Gemini response format
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) {
      throw new Error('Empty response from Gemini API')
    }

    try {
      return JSON.parse(responseText)
    } catch {
      // If response isn't valid JSON, return it as-is wrapped in a structure
      return { raw_response: responseText }
    }
  }, /* maxRetries */ 5, /* initialDelayMs */ 2000).catch(err => {
    console.error('[openAIChat] Final Error:', err)
    
    if (err.message?.includes('Failed to fetch')) {
      throw new Error(
        '❌ Network error - cannot reach Gemini API.\n\n' +
        'Check your internet connection and try again.'
      )
    }
    
    if (err.message?.includes('429') || err.message?.includes('rate')) {
      throw new Error(
        '⏸️ API rate limit exceeded after retries.\n\n' +
        'The Gemini free tier has strict rate limits.\n' +
        'Wait a few minutes and try again, or upgrade to a paid plan:\n' +
        'https://aistudio.google.com/'
      )
    }
    
    throw err
  })
}


// ─────────────────────────────────────────────────────────────────
// PDF Text Extraction
// ─────────────────────────────────────────────────────────────────
export async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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
// Unified text extractor
// ─────────────────────────────────────────────────────────────────
export async function extractResumeText(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf'))                      return extractTextFromPDF(file)
  if (name.endsWith('.docx') || name.endsWith('.doc')) return extractTextFromDOCX(file)
  if (name.endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = (e) => resolve(e.target.result)
      reader.onerror = ()  => reject(new Error('File reading failed'))
      reader.readAsText(file)
    })
  }
  throw new Error('Unsupported format. Please upload PDF, DOCX, or TXT.')
}

// ─────────────────────────────────────────────────────────────────
// Helper: race promise against timeout
// ─────────────────────────────────────────────────────────────────
function withTimeout(promise, ms, errorMsg) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  )
  return Promise.race([promise, timeout])
}

// ─────────────────────────────────────────────────────────────────
// NV-AI CAREER INTELLIGENCE — Main Analysis Engine
// ─────────────────────────────────────────────────────────────────
export async function analyzeResumeWithAI({
  resumeText,
  jobs,
  targetJob = null,
  userPreferences = null,
  onProgress = () => {},
}) {
  onProgress('🧠 Parsing your resume structure...')

  // ── Slim payload: top 20 jobs, essential fields only ──────────
  const jobsSlim = jobs.slice(0, 20).map(j => ({
    id:           j.id,
    title:        j.title,
    org:          j.organization,
    cat:          j.category,
    loc:          j.location || 'All India',
    salary:       j.salary_range || null,
    tags:         (j.tags || []).slice(0, 5),
    last_date:    j.last_date || null,
    apply_url:    j.apply_url,
  }))

  const today = new Date().toISOString().split('T')[0]

  // ── Trimmed resume (max 4000 chars to stay within token budget) ─
  const resumeTrimmed = resumeText.slice(0, 4000)

  const systemPrompt =
    `You are NV-AI, an expert career coach and ATS analyzer for India's job market.
Today is ${today}. Return ONLY valid JSON with no markdown, no backticks, no extra text.`

  const userMessage =
    `Analyze this resume against the job list below and return EXACTLY this JSON structure:

RESUME:
${resumeTrimmed}

JOBS (${jobsSlim.length} listings):
${JSON.stringify(jobsSlim)}

TARGET JOB: ${targetJob ? JSON.stringify({id: targetJob.id, title: targetJob.title}) : 'None'}
PREFERENCES: ${userPreferences ? JSON.stringify(userPreferences) : 'None'}

Return this JSON (all scores are 0-100 integers, arrays are never null):
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
      "location": "", "salary_range": null, "apply_url": "", "last_date": null,
      "match_score": 0,
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

  // ── Call OpenAI via fetch with 45-second timeout ──────────────
  let response
  try {
    response = await withTimeout(
      openAIChat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  },
        ],
        max_tokens:  3500,
        temperature: 0.15,
      }),
      45_000,
      'AI request timed out after 45 seconds. Please try again.'
    )
  } catch (err) {
    // openAIChat already formats 401/429 errors — just re-throw
    throw new Error(err.message || 'AI analysis failed. Please try again.')
  }

  onProgress('📊 Processing results...')

  const raw = response.choices[0]?.message?.content?.trim()
  if (!raw) throw new Error('AI returned an empty response. Please try again.')

  try {
    return JSON.parse(raw)
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) } catch { /* fall through */ }
    }
    throw new Error('Failed to parse AI response. Please try again.')
  }
}
