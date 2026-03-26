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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const [usersRes, jobsRes, newsRes, clicksRes, recentJobsRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('jobs').select('*', { count: 'exact', head: true }),
      supabase.from('news').select('*', { count: 'exact', head: true }),
      supabase.from('affiliate_clicks').select('*', { count: 'exact', head: true }),
      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    return new Response(
      JSON.stringify({
        totalUsers: usersRes.count ?? 0,
        totalJobs: jobsRes.count ?? 0,
        totalNews: newsRes.count ?? 0,
        totalClicks: clicksRes.count ?? 0,
        recentJobs: recentJobsRes.count ?? 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
