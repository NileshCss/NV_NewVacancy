// @ts-ignore: Supabase Edge Function imports
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
// @ts-ignore: ESM import for Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore: Deno std library import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

type SupportedAction =
  | 'scrape_url'
  | 'extract_job'
  | 'process_instruction'
  | 'answer'
  | 'content'
  | 'analyze'

type PromptAction = 'answer' | 'content' | 'analyze'

type JsonRecord = Record<string, unknown>

type ActionRequestBody = {
  action?: SupportedAction
  prompt?: string
  payload?: JsonRecord
  url?: string
  scrapedContent?: string
  sourceUrl?: string
  instruction?: string
  jobs?: unknown[]
}

type UserProfile = {
  role: string | null
  is_blocked: boolean | null
}

type SupabaseClient = ReturnType<typeof createClient>

type AnthropicTextContent = {
  type: 'text'
  text: string
}

type AnthropicContent =
  | AnthropicTextContent
  | {
      type: string
      [key: string]: unknown
    }

type AnthropicMessageResponse = {
  content?: AnthropicContent[]
  error?: {
    message?: string
  }
}

const ALLOWED_UPDATE_FIELDS = [
  'last_date',
  'form_fill_end',
  'form_fill_start',
  'exam_date',
  'admit_card_date',
  'result_date',
] as const

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
}

const CORS_BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getEnv(key: string) {
  try {
    const deno = (globalThis as typeof globalThis & {
      Deno?: { env?: { get?: (envKey: string) => string | undefined } }
    }).Deno

    return deno?.env?.get?.(key)
  } catch {
    return undefined
  }
}

function getRequiredEnvs(keys: string[]) {
  const values: Record<string, string> = {}
  const missing: string[] = []

  for (const key of keys) {
    const value = getEnv(key)
    if (!value) {
      missing.push(key)
    } else {
      values[key] = value
    }
  }

  return { values, missing }
}

const ANTHROPIC_MODEL = getEnv('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*'
  return {
    ...CORS_BASE_HEADERS,
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  }
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...buildCorsHeaders(req),
    },
  })
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unexpected server error'
}

function assertHttpUrl(value: string) {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Invalid URL format')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are supported')
  }

  return parsed.toString()
}

function compactWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function decodeHtmlEntities(input: string) {
  const entityMap: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }

  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity: string) => {
    const lower = entity.toLowerCase()

    if (lower in entityMap) return entityMap[lower]

    if (lower.startsWith('#x')) {
      const codePoint = Number.parseInt(lower.slice(2), 16)
      if (Number.isFinite(codePoint)) return String.fromCodePoint(codePoint)
    }

    if (lower.startsWith('#')) {
      const codePoint = Number.parseInt(lower.slice(1), 10)
      if (Number.isFinite(codePoint)) return String.fromCodePoint(codePoint)
    }

    return `&${entity};`
  })
}

function stripHtmlToText(html: string) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

  return compactWhitespace(decodeHtmlEntities(cleaned))
}

function safeJsonParse<T>(rawText: string): T {
  const cleaned = rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    if (objMatch) {
      return JSON.parse(objMatch[0]) as T
    }

    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      return JSON.parse(arrMatch[0]) as T
    }

    throw new Error('AI response was not valid JSON')
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'new-vacancy-edge-bot/1.0',
      },
    })

    return response
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeAction(body: ActionRequestBody): SupportedAction {
  if (body.action) return body.action
  return 'answer'
}

function isPromptAction(action: SupportedAction): action is PromptAction {
  return action === 'answer' || action === 'content' || action === 'analyze'
}

function sanitizeExtractedJob(raw: JsonRecord, sourceUrl: string) {
  const category = raw.category === 'govt' ? 'govt' : 'private'
  const vacancies = Number(raw.vacancies)
  const confidenceValue = Number(raw.confidence)

  const normalized: JsonRecord = {
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    organization: typeof raw.organization === 'string' ? raw.organization.trim() : '',
    category,
    department: typeof raw.department === 'string' ? raw.department.trim() : null,
    location: typeof raw.location === 'string' ? raw.location.trim() : 'All India',
    state: typeof raw.state === 'string' ? raw.state.trim() : null,
    qualification: typeof raw.qualification === 'string' ? raw.qualification.trim() : null,
    vacancies: Number.isFinite(vacancies) && vacancies >= 0 ? Math.floor(vacancies) : 0,
    salary_range: typeof raw.salary_range === 'string' ? raw.salary_range.trim() : null,
    age_limit: typeof raw.age_limit === 'string' ? raw.age_limit.trim() : null,
    apply_url: typeof raw.apply_url === 'string' && raw.apply_url.trim() ? raw.apply_url.trim() : sourceUrl,
    notification_url: typeof raw.notification_url === 'string' ? raw.notification_url.trim() : null,
    last_date: typeof raw.last_date === 'string' ? raw.last_date : null,
    exam_date: typeof raw.exam_date === 'string' ? raw.exam_date : null,
    form_fill_start: typeof raw.form_fill_start === 'string' ? raw.form_fill_start : null,
    form_fill_end: typeof raw.form_fill_end === 'string' ? raw.form_fill_end : null,
    admit_card_date: typeof raw.admit_card_date === 'string' ? raw.admit_card_date : null,
    result_date: typeof raw.result_date === 'string' ? raw.result_date : null,
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6).map((tag) => String(tag).toLowerCase()) : [],
    is_featured: Boolean(raw.is_featured),
    confidence:
      Number.isFinite(confidenceValue) && confidenceValue >= 0 && confidenceValue <= 1
        ? confidenceValue
        : 0.6,
    source_url: sourceUrl,
    ai_extracted: true,
    ai_extracted_at: new Date().toISOString(),
  }

  if (!normalized.title || !normalized.organization) {
    throw new Error('AI could not extract a valid job title and organization')
  }

  return normalized
}

function normalizeInstructionOperations(raw: unknown) {
  if (!Array.isArray(raw)) return []

  const datePattern = /^\d{4}-\d{2}-\d{2}$/

  return raw
    .map((item) => {
      const op = (item || {}) as JsonRecord
      const updates = (op.updates || {}) as JsonRecord
      const sanitizedUpdates: JsonRecord = {}

      for (const field of ALLOWED_UPDATE_FIELDS) {
        const value = updates[field]
        if (typeof value === 'string' && datePattern.test(value.trim())) {
          sanitizedUpdates[field] = value.trim()
        }
      }

      return {
        job_id: typeof op.job_id === 'string' ? op.job_id : '',
        job_title: typeof op.job_title === 'string' ? op.job_title : '',
        updates: sanitizedUpdates,
        reason: typeof op.reason === 'string' ? op.reason : '',
        extension_note: typeof op.extension_note === 'string' ? op.extension_note : '',
      }
    })
    .filter((item) => item.job_id && Object.keys(item.updates).length > 0)
}

async function callAnthropicText(
  apiKey: string,
  input: {
    system: string
    prompt: string
    maxTokens?: number
    temperature?: number
  }
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: input.maxTokens || 1800,
        temperature: input.temperature ?? 0.2,
        system: input.system,
        messages: [
          {
            role: 'user',
            content: input.prompt,
          },
        ],
      }),
    })

    const raw = await response.text()
    let parsed: AnthropicMessageResponse | null = null

    if (raw) {
      try {
        parsed = JSON.parse(raw) as AnthropicMessageResponse
      } catch {
        if (!response.ok) {
          throw new Error(`Anthropic API HTTP ${response.status}: ${raw}`)
        }
      }
    }

    if (!response.ok) {
      const apiMessage = parsed?.error?.message || `Anthropic API HTTP ${response.status}`
      throw new Error(apiMessage)
    }

    if (!parsed) {
      throw new Error('Anthropic API returned an empty response body')
    }

    if (parsed.error?.message) {
      throw new Error(parsed.error.message)
    }

    const textBlock = (parsed.content || []).find(
      (block): block is AnthropicTextContent => block.type === 'text' && typeof (block as AnthropicTextContent).text === 'string'
    )

    if (!textBlock?.text?.trim()) {
      throw new Error('AI returned an empty response')
    }

    return textBlock.text.trim()
  } catch (error) {
    const message = toErrorMessage(error)
    if (message.toLowerCase().includes('aborted')) {
      throw new Error('Anthropic API request timed out')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function callAnthropicJson<T>(
  apiKey: string,
  input: {
    system: string
    prompt: string
    maxTokens?: number
    temperature?: number
  }
) {
  const rawText = await callAnthropicText(apiKey, input)
  return safeJsonParse<T>(rawText)
}

async function requireAdmin(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string
): Promise<{ userId: string; serviceClient: SupabaseClient }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing Authorization header')
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    throw new Error('Invalid or expired user session')
  }

  const profileResult = await serviceClient
    .from('profiles')
    .select('role, is_blocked')
    .eq('id', user.id)
    .maybeSingle()

  const profile = (profileResult.data as UserProfile | null) || null
  const profileError = profileResult.error

  if (profileError) {
    throw new Error('Failed to verify admin role')
  }

  if (!profile || profile.role !== 'admin' || profile.is_blocked === true) {
    throw new Error('Admin access is required')
  }

  return { userId: user.id, serviceClient }
}

async function createActivityLog(serviceClient: SupabaseClient, payload: JsonRecord) {
  try {
    const result = await serviceClient
      .from('ai_activity_log')
      .insert(payload)
      .select('id')
      .maybeSingle()

    const data = (result.data as { id?: string } | null) || null
    return data?.id || null
  } catch {
    return null
  }
}

async function updateActivityLog(serviceClient: SupabaseClient, id: string | null, payload: JsonRecord) {
  if (!id) return

  try {
    await serviceClient.from('ai_activity_log').update(payload).eq('id', id)
  } catch {
    // no-op
  }
}

async function handleScrapeUrl(payload: JsonRecord) {
  const url = assertHttpUrl(String(payload.url || ''))

  const response = await fetchWithTimeout(url, 15000)
  if (!response.ok) {
    throw new Error(`Failed to fetch URL (HTTP ${response.status})`)
  }

  const html = await response.text()
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = compactWhitespace(decodeHtmlEntities(titleMatch?.[1] || ''))
  const content = stripHtmlToText(html).slice(0, 12000)

  if (!content) {
    throw new Error('Scraped page has no readable content')
  }

  return {
    url,
    title: title || null,
    content,
    content_length: content.length,
  }
}

async function handleExtractJob(apiKey: string, payload: JsonRecord) {
  const sourceUrl = assertHttpUrl(String(payload.source_url || payload.sourceUrl || ''))
  const scrapedContent = String(payload.scraped_content || payload.scrapedContent || '')

  if (!scrapedContent.trim()) {
    throw new Error('scraped_content is required')
  }

  const prompt = `
Extract structured job notification data from the text below.
Return ONLY JSON. No markdown. No explanation.

Source URL: ${sourceUrl}

Content:
${scrapedContent.slice(0, 10000)}

Required JSON schema:
{
  "title": "",
  "organization": "",
  "category": "govt or private",
  "department": null,
  "location": "",
  "state": null,
  "qualification": null,
  "vacancies": 0,
  "salary_range": null,
  "age_limit": null,
  "apply_url": "",
  "notification_url": null,
  "last_date": null,
  "exam_date": null,
  "form_fill_start": null,
  "form_fill_end": null,
  "admit_card_date": null,
  "result_date": null,
  "tags": [],
  "is_featured": false,
  "confidence": 0.0
}

Rules:
- category must be exactly "govt" or "private"
- Dates must be YYYY-MM-DD or null
- vacancies must be a number
- confidence must be between 0 and 1
- If not a job notification, return {"error":"Not a job notification"}
`

  const aiJson = await callAnthropicJson<JsonRecord>(apiKey, {
    system:
      'You are an expert parser for Indian government and private job notifications. Return strict JSON only.',
    prompt,
    maxTokens: 1800,
    temperature: 0,
  })

  if (typeof aiJson.error === 'string' && aiJson.error) {
    throw new Error(aiJson.error)
  }

  return sanitizeExtractedJob(aiJson, sourceUrl)
}

async function handleProcessInstruction(apiKey: string, payload: JsonRecord) {
  const instruction = String(payload.instruction || '').trim()
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : []

  if (!instruction) {
    throw new Error('instruction is required')
  }

  if (!jobs.length) {
    return []
  }

  const jobsContext = jobs.slice(0, 300).map((job) => {
    const item = (job || {}) as JsonRecord

    return {
      id: item.id,
      title: item.title,
      organization: item.organization,
      last_date: item.last_date,
      form_fill_start: item.form_fill_start,
      form_fill_end: item.form_fill_end,
      exam_date: item.exam_date,
      admit_card_date: item.admit_card_date,
      result_date: item.result_date,
    }
  })

  const prompt = `
Today's date is ${new Date().toISOString().slice(0, 10)}.

Admin instruction:
"${instruction}"

Available jobs:
${JSON.stringify(jobsContext)}

Return ONLY a JSON array of operations.
Each operation must match this format:
[
  {
    "job_id": "uuid",
    "job_title": "",
    "updates": {
      "last_date": "YYYY-MM-DD",
      "form_fill_start": "YYYY-MM-DD",
      "form_fill_end": "YYYY-MM-DD",
      "exam_date": "YYYY-MM-DD",
      "admit_card_date": "YYYY-MM-DD",
      "result_date": "YYYY-MM-DD"
    },
    "reason": "",
    "extension_note": ""
  }
]

Rules:
- Include only jobs that match instruction intent.
- Include only fields that should change.
- Use YYYY-MM-DD format for every date.
- Return [] when instruction is unclear or no job matches.
`

  const rawOperations = await callAnthropicJson<unknown>(apiKey, {
    system:
      'You map admin instructions to precise date update operations for a jobs database. Return strict JSON array only.',
    prompt,
    maxTokens: 2200,
    temperature: 0,
  })

  return normalizeInstructionOperations(rawOperations)
}

async function handlePromptAction(apiKey: string, action: PromptAction, prompt: string) {
  if (!prompt.trim()) {
    throw new Error('prompt is required')
  }

  const systemByAction: Record<'answer' | 'content' | 'analyze', string> = {
    answer: 'You are a helpful assistant for a job portal admin panel. Keep answers concise and practical.',
    content:
      'You are a professional content writer for a jobs and career platform. Return polished, production-ready copy.',
    analyze:
      'You are a data analyst for a jobs platform. Share concise, actionable insights with reasoning.',
  }

  const text = await callAnthropicText(apiKey, {
    system: systemByAction[action],
    prompt,
    maxTokens: 1800,
    temperature: action === 'answer' ? 0.3 : 0.5,
  })

  return text
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 204,
      headers: buildCorsHeaders(req),
    })
  }

  const { values, missing } = getRequiredEnvs([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
  ])

  if (missing.length > 0) {
    return jsonResponse(
      req,
      {
        error: 'Required environment variables are missing',
        missing,
      },
      500
    )
  }

  const supabaseUrl = values.SUPABASE_URL
  const supabaseAnonKey = values.SUPABASE_ANON_KEY
  const serviceRoleKey = values.SUPABASE_SERVICE_ROLE_KEY
  const anthropicApiKey = values.ANTHROPIC_API_KEY

  let body: ActionRequestBody

  try {
    body = (await req.json()) as ActionRequestBody
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }

  const action = normalizeAction(body)

  let adminContext: { userId: string; serviceClient: SupabaseClient }

  try {
    adminContext = await requireAdmin(req, supabaseUrl, supabaseAnonKey, serviceRoleKey)
  } catch (error) {
    const message = toErrorMessage(error)
    const status = message.includes('Authorization') || message.includes('session') ? 401 : 403
    return jsonResponse(req, { error: message }, status)
  }

  const payload: JsonRecord = {
    ...(body.payload || {}),
  }

  if (body.url) payload.url = body.url
  if (body.scrapedContent) payload.scrapedContent = body.scrapedContent
  if (body.sourceUrl) payload.sourceUrl = body.sourceUrl
  if (body.instruction) payload.instruction = body.instruction
  if (body.jobs) payload.jobs = body.jobs

  const logId = await createActivityLog(adminContext.serviceClient, {
    admin_id: adminContext.userId,
    action_type: action,
    action,
    prompt: body.prompt || null,
    input_data: payload,
    status: 'processing',
  })

  try {
    if (action === 'scrape_url') {
      const response = await handleScrapeUrl(payload)

      await updateActivityLog(adminContext.serviceClient, logId, {
        status: 'success',
        output_data: response,
        completed_at: new Date().toISOString(),
      })

      return jsonResponse(req, { success: true, action, response })
    }

    if (action === 'extract_job') {
      const response = await handleExtractJob(anthropicApiKey, payload)

      await updateActivityLog(adminContext.serviceClient, logId, {
        status: 'success',
        output_data: response,
        completed_at: new Date().toISOString(),
      })

      return jsonResponse(req, { success: true, action, response })
    }

    if (action === 'process_instruction') {
      const response = await handleProcessInstruction(anthropicApiKey, payload)

      await updateActivityLog(adminContext.serviceClient, logId, {
        status: 'success',
        output_data: { operations: response },
        completed_at: new Date().toISOString(),
      })

      return jsonResponse(req, { success: true, action, response })
    }

    if (isPromptAction(action)) {
      const prompt = String(body.prompt || payload.prompt || '')
      const response = await handlePromptAction(anthropicApiKey, action, prompt)

      await updateActivityLog(adminContext.serviceClient, logId, {
        status: 'success',
        response,
        output_data: { text: response },
        completed_at: new Date().toISOString(),
      })

      return jsonResponse(req, {
        success: true,
        action,
        response,
        provider: 'anthropic',
      })
    }

    return jsonResponse(req, { error: `Unsupported action: ${action}` }, 400)
  } catch (error) {
    const message = toErrorMessage(error)

    await updateActivityLog(adminContext.serviceClient, logId, {
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString(),
    })

    const status =
      message.includes('Invalid URL') ||
      message.includes('required') ||
      message.includes('supported') ||
      message.includes('valid JSON')
        ? 400
        : 500

    return jsonResponse(req, { error: message }, status)
  }
})
