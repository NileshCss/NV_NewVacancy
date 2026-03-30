import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

// ─────────────────────────────────────────────────────────
// STEP 1: Scrape webpage content from URL via CORS proxy
// ─────────────────────────────────────────────────────────
export async function scrapeURL(url) {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    const response = await fetch(proxyUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    if (!data.contents) throw new Error('Could not fetch page content')

    // Strip HTML tags to get clean text
    const parser = new DOMParser()
    const doc = parser.parseFromString(data.contents, 'text/html')

    // Remove non-content elements
    doc.querySelectorAll('script, style, nav, footer, header, aside').forEach(el => el.remove())

    const text = doc.body?.innerText || doc.body?.textContent || ''
    const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 8000)

    return {
      success: true,
      content: cleanText,
      url,
      title: doc.title || '',
    }
  } catch (error) {
    throw new Error(`Scraping failed: ${error.message}`)
  }
}

// ─────────────────────────────────────────────────────────
// STEP 2: AI extracts structured job data from scraped text
// ─────────────────────────────────────────────────────────
export async function extractJobDataWithAI(scrapedContent, sourceUrl) {
  const prompt = `
You are an expert at extracting Indian government and private job/exam 
notification data from websites.

Extract ALL job/exam details from this webpage content and return 
ONLY a valid JSON object. No explanation, no markdown, just JSON.

Webpage URL: ${sourceUrl}
Webpage Content:
${scrapedContent}

Return this exact JSON structure (use null for missing fields):
{
  "title": "Full job/exam title",
  "organization": "Organization/board name",
  "category": "govt or private",
  "department": "Department name or null",
  "location": "Location or All India",
  "state": "State name or null",
  "qualification": "Required qualification",
  "vacancies": 0,
  "salary_range": "Salary range as string or null",
  "age_limit": "Age limit as string or null",
  "apply_url": "Direct application URL",
  "notification_url": "PDF notification URL or null",
  "last_date": "YYYY-MM-DD format or null",
  "exam_date": "YYYY-MM-DD format or null",
  "form_fill_start": "YYYY-MM-DD format or null",
  "form_fill_end": "YYYY-MM-DD format or null",
  "admit_card_date": "YYYY-MM-DD format or null",
  "result_date": "YYYY-MM-DD format or null",
  "tags": ["tag1", "tag2", "tag3"],
  "is_featured": false,
  "confidence": 0.95
}

Rules:
- category must be exactly "govt" or "private"
- All dates must be in YYYY-MM-DD format
- vacancies must be a number (0 if unknown)
- tags should be lowercase, relevant keywords (max 5)
- confidence: 0.0 to 1.0 based on how complete the data is
- If this is not a job/exam notification, return {"error": "Not a job notification"}
`

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = response.content[0].text.trim()

  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI did not return valid JSON')

  const jobData = JSON.parse(jsonMatch[0])

  if (jobData.error) throw new Error(jobData.error)

  return {
    ...jobData,
    source_url: sourceUrl,
    ai_extracted: true,
    ai_extracted_at: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────
// STEP 3: Upload extracted job data to Supabase
// ─────────────────────────────────────────────────────────
export async function uploadJobToSupabase(jobData, adminId) {
  // Log AI activity start
  const { data: logEntry } = await supabase
    .from('ai_activity_log')
    .insert({
      admin_id: adminId,
      action_type: 'extract_and_upload',
      input_data: { source_url: jobData.source_url },
      status: 'processing',
    })
    .select()
    .single()

  try {
    // Check if job already exists from this URL
    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('source_url', jobData.source_url)
      .maybeSingle()

    let result

    if (existing) {
      // Update existing job
      const { data, error } = await supabase
        .from('jobs')
        .update({
          ...jobData,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      result = { ...data, action: 'updated' }
    } else {
      // Insert new job
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          ...jobData,
          is_active: true,
          created_by: adminId,
        })
        .select()
        .single()

      if (error) throw error
      result = { ...data, action: 'created' }
    }

    // Update activity log — success
    if (logEntry) {
      await supabase
        .from('ai_activity_log')
        .update({
          status: 'success',
          output_data: { action: result.action, job_id: result.id },
          job_id: result.id,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id)
    }

    return result
  } catch (error) {
    // Update activity log — failed
    if (logEntry) {
      await supabase
        .from('ai_activity_log')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id)
    }
    throw error
  }
}

// ─────────────────────────────────────────────────────────
// STEP 4: AI processes admin natural language instruction
// to extend/update job dates
// ─────────────────────────────────────────────────────────
export async function processAdminInstruction(instruction, jobs, adminId) {
  const jobsContext = jobs.map(j => ({
    id: j.id,
    title: j.title,
    organization: j.organization,
    last_date: j.last_date,
    form_fill_end: j.form_fill_end,
    exam_date: j.exam_date,
    form_fill_start: j.form_fill_start,
  }))

  const today = new Date().toISOString().split('T')[0]

  const prompt = `
You are an AI assistant managing an Indian job portal database.
Today's date is: ${today}

Admin instruction: "${instruction}"

Available jobs in database:
${JSON.stringify(jobsContext, null, 2)}

Based on the admin instruction, determine what database updates need
to be made. Return ONLY a valid JSON array of update operations.

Each update operation must follow this exact format:
[
  {
    "job_id": "uuid of the job to update",
    "job_title": "title for confirmation",
    "updates": {
      "last_date": "YYYY-MM-DD or null (don't include if not changing)",
      "form_fill_end": "YYYY-MM-DD or null (don't include if not changing)",
      "form_fill_start": "YYYY-MM-DD or null (don't include if not changing)",
      "exam_date": "YYYY-MM-DD or null (don't include if not changing)",
      "admit_card_date": "YYYY-MM-DD or null (don't include if not changing)"
    },
    "reason": "Human readable explanation of what changed and why",
    "extension_note": "e.g. Last date extended by 15 days as per admin instruction"
  }
]

Rules:
- Only include fields that actually need to change in "updates"
- Calculate new dates correctly based on the instruction
- If instruction says "extend by X days" add X days to current date value of that field
- If instruction says "set to [date]" use that specific date
- Match job names flexibly (partial match is okay)
- If no jobs match, return []
- If instruction is unclear, return []
- Return ONLY the JSON array, no explanation
`

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = response.content[0].text.trim()
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const operations = JSON.parse(jsonMatch[0])

  // Execute each update operation
  const results = []
  for (const op of operations) {
    try {
      const { data: currentJob } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', op.job_id)
        .single()

      if (!currentJob) continue

      const historyEntry = {
        date: today,
        instruction,
        note: op.extension_note,
        changes: op.updates,
        admin_id: adminId,
      }
      const currentHistory = currentJob.extension_history || []

      const { data, error } = await supabase
        .from('jobs')
        .update({
          ...op.updates,
          extension_history: [...currentHistory, historyEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', op.job_id)
        .select()
        .single()

      if (error) throw error

      await supabase.from('ai_activity_log').insert({
        admin_id: adminId,
        action_type: 'date_extension',
        input_data: { instruction, job_id: op.job_id },
        output_data: { updates: op.updates, reason: op.reason },
        status: 'success',
        job_id: op.job_id,
        completed_at: new Date().toISOString(),
      })

      results.push({
        job_id: op.job_id,
        job_title: op.job_title,
        updates: op.updates,
        reason: op.reason,
        success: true,
      })
    } catch (err) {
      results.push({
        job_id: op.job_id,
        job_title: op.job_title,
        success: false,
        error: err.message,
      })
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────
// STEP 5: Get expired/expiring jobs for AI monitoring
// ─────────────────────────────────────────────────────────
export async function getExpiringJobs() {
  const today = new Date().toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const { data: expired } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .lt('last_date', today)
    .order('last_date', { ascending: false })

  const { data: expiringSoon } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .gte('last_date', today)
    .lte('last_date', in7Days)
    .order('last_date', { ascending: true })

  return {
    expired: expired || [],
    expiringSoon: expiringSoon || [],
  }
}
