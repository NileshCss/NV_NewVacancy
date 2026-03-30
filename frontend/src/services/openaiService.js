import OpenAI from 'openai'

// ─────────────────────────────────────────────────────────────────
// STEP 1: SETUP OPENAI CLIENT
// ─────────────────────────────────────────────────────────────────
const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true, // For development only as requested
})

// Ensures the user knows if the key is missing
if (!import.meta.env.VITE_OPENAI_API_KEY) {
  console.warn('VITE_OPENAI_API_KEY is not defined in your environment variables.')
}

// ─────────────────────────────────────────────────────────────────
// 🧠 STEP 2: CREATE AI FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * 1. analyzeResume
 * Extracts skills, matches jobs, calculates ATS score, and returns structured JSON
 */
export async function analyzeResume(resumeText, jobs, targetJob = null, userPreferences = null) {
  const prompt = `
You are an expert ATS (Applicant Tracking System) and Indian career coach.
Analyze this resume against the available jobs.
Return ONLY valid JSON matching this structure perfectly. No markdown formatting or explanation.

RESUME TEXT:
${resumeText.slice(0, 5000)}

AVAILABLE JOBS:
${JSON.stringify(jobs.slice(0, 20))}

TARGET JOB: ${targetJob ? JSON.stringify(targetJob) : 'None'}
User Prefs: ${userPreferences ? JSON.stringify(userPreferences) : 'None'}

Return format exactly (fill with actual data, score out of 100):
{
  "summary_card": {
    "candidate_name": "", "overall_readiness": "", "best_match_job": "", 
    "best_match_score": 0, "immediate_action": "", "top_strength": ""
  },
  "ats_analysis": {
    "overall_ats_score": 0,
    "grade": "A|B|C|D",
    "breakdown": {
      "keywords": { "score": 0, "max": 30, "verdict": "" },
      "skills": { "score": 0, "max": 25, "verdict": "" },
      "experience": { "score": 0, "max": 20, "verdict": "" },
      "format": { "score": 0, "max": 15, "verdict": "" },
      "education": { "score": 0, "max": 10, "verdict": "" }
    },
    "ats_compatibility": { "workday": 0, "greenhouse": 0, "naukri": 0 },
    "error_flags": []
  },
  "resume_data": {
    "professional_summary": "",
    "all_skills_flat": []
  },
  "job_matches": [
    {
      "job_title": "", "organization": "", "location": "", "salary_range": "",
      "apply_url": "", "match_score": 0, "score_breakdown": { "skills": 0, "experience": 0 }
    }
  ],
  "recommended_jobs": {
    "top_picks": [
      {
        "job_title": "", "organization": "", "location": "", "salary_range": "",
        "match_score": 0, "why_recommended": "", "quick_tip": "", "apply_url": ""
      }
    ]
  },
  "suggestions": {
    "total_potential_ats_improvement": "+10",
    "critical": [{"issue": "", "improved": "", "ats_impact": "+5", "action": ""}],
    "important": [{"issue": "", "action": "", "ats_impact": "+2"}],
    "career_path": {
      "current_level": "", "next_level": "", "skills_to_add": [], "recommended_certifications": []
    }
  },
  "india_insights": {
    "salary_intelligence": { "current_market_value": "", "after_skill_upgrade": "", "top_paying_companies_for_profile": [] },
    "govt_eligibility": { "recommended_govt_exams": [{"exam":"", "reason":""}] }
  }
}
`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4.1-mini' as requested
      messages: [
        { role: 'system', content: 'You are a professional AI job assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' } // Enforces JSON mapping
    })

    const resultText = response.choices[0].message.content
    return JSON.parse(resultText)
  } catch (error) {
    console.error('OpenAI analyzeResume Error:', error)
    throw new Error('Failed to analyze resume with OpenAI. Ensure API key is correct and not rate limited.')
  }
}

/**
 * 2. generateJobRecommendations
 * Fast route to just get job matches based on a smaller user profile chunk
 */
export async function generateJobRecommendations(userProfile, jobs) {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a career matcher. Return ONLY a JSON array of matched job IDs and reasons. Format: [{"job_id": "...", "reason": "..."}]' },
        { role: 'user', content: `PROFILE: ${JSON.stringify(userProfile)}\nJOBS: ${JSON.stringify(jobs.slice(0, 30))}` }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
    
    // GPT returns a JSON object when response_format JSON is enabled.
    // Assuming standard wrapping behavior e.g., { "matches": [...] }
    const result = JSON.parse(response.choices[0].message.content)
    return result.matches || result
  } catch (error) {
    console.error('OpenAI generation error:', error)
    throw new Error('Failed to fetch job recommendations.')
  }
}

/**
 * 3. chatAssistant
 * General AI assistant for admin / end user back-and-forth dialog
 */
export async function chatAssistant(prompt, chatHistory = []) {
  try {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant for New_vacancy, a job portal.' },
      ...chatHistory,
      { role: 'user', content: prompt }
    ]

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
    })

    return response.choices[0].message.content
  } catch (error) {
    console.error('OpenAI Chat Error:', error)
    throw new Error('AI Assistant is currently unavailable.')
  }
}
