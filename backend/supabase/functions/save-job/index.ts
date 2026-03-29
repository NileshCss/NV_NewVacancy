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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { job_id } = await req.json()
    if (!job_id) throw new Error('Valid Job ID is required')

    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    // Toggle saved job
    const { data: existing } = await supabase.from('saved_jobs')
      .select('*')
      .eq('user_id', user.id)
      .eq('job_id', job_id)
      .single()

    if (existing) {
      await supabase.from('saved_jobs').delete().eq('user_id', user.id).eq('job_id', job_id)
      return new Response(JSON.stringify({ message: 'Removed from saved jobs', status: 'removed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else {
      await supabase.from('saved_jobs').insert({ user_id: user.id, job_id })
      return new Response(JSON.stringify({ message: 'Added to saved jobs', status: 'saved' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
