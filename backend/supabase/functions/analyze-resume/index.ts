// deno-lint-ignore-file

// Declare Deno global so TypeScript doesn't complain in non-Deno environments
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// @ts-ignore: Deno remote import — resolved at runtime by Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    // ── Auth check (optional — allow anonymous resume analysis) ─
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn('[analyze-resume] No Authorization header — proceeding anyway')
    }

    // ── Parse request body ────────────────────────────────────
    let body: { messages?: unknown[]; max_tokens?: number; temperature?: number }
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    const { messages, max_tokens = 3500, temperature = 0.15 } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required and must not be empty' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    console.log(`[analyze-resume] ${messages.length} messages, max_tokens=${max_tokens}`)

    // ── Get OpenAI key from Supabase secrets ──────────────────
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      console.error('[analyze-resume] OPENAI_API_KEY secret is not set!')
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY secret not configured in Supabase. Go to Supabase Dashboard → Edge Functions → Secrets and add it.' }),
        { status: 500, headers: jsonHeaders }
      )
    }

    // ── Call OpenAI ───────────────────────────────────────────
    const openAIPayload = {
      model:           'gpt-4o-mini',
      messages,
      temperature,
      max_tokens,
      response_format: { type: 'json_object' },
    }

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: JSON.stringify(openAIPayload),
    })

    if (!openAIRes.ok) {
      const errBody = await openAIRes.text()
      console.error(`[analyze-resume] OpenAI ${openAIRes.status}:`, errBody)

      let msg = `OpenAI HTTP ${openAIRes.status}`
      try {
        const parsed = JSON.parse(errBody)
        msg = parsed?.error?.message || msg
      } catch { /* use default msg */ }

      return new Response(
        JSON.stringify({ error: msg, status: openAIRes.status }),
        { status: openAIRes.status, headers: jsonHeaders }
      )
    }

    const data = await openAIRes.json()
    console.log('[analyze-resume] Success — tokens used:', data?.usage?.total_tokens ?? 'unknown')

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: jsonHeaders }
    )

  } catch (err: unknown) {
    console.error('[analyze-resume] Unhandled error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

