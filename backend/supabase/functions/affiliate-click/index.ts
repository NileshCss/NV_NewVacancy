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

    const { target_id } = await req.json()
    if (!target_id) throw new Error('Valid target_id required')

    // Call RPC using the user's logged-in identity or anon
    const { error } = await supabase.rpc('increment_affiliate_clicks', { aff_id: target_id })

    // Optionally log click metrics with IP/UA
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'
    
    // We attempt to get user info if logged in (not guaranteed)
    const { data: { session } } = await supabase.auth.getSession()

    await supabase.from('affiliate_clicks').insert({
      affiliate_id: target_id,
      user_id: session?.user?.id ?? null,
      ip_address: ip,
      user_agent: ua
    })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
