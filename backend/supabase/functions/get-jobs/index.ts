// @ts-nocheck
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const url = new URL(req.url)
    const category = url.searchParams.get('category') || undefined
    const state = url.searchParams.get('state') || undefined
    const search = url.searchParams.get('search') || undefined
    const page = Number(url.searchParams.get('page') || '1')
    const limit = Number(url.searchParams.get('limit') || '12')

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('posted_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (category) query = query.eq('category', category)
    if (state) query = query.eq('state', state)
    if (search) query = query.ilike('title', `%${search}%`)

    const { data, count, error } = await query
    if (error) throw error

    return new Response(JSON.stringify({ jobs: data ?? [], total: count ?? 0, page, limit }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
