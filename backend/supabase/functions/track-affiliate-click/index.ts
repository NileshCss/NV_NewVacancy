// @ts-nocheck
/**
 * Supabase Edge Function: Track Affiliate Click
 * Records when a user clicks on an affiliate link
 * 
 * Usage:
 * POST /functions/v1/track-affiliate-click
 * Body: { affiliateId, userId, ipAddress, userAgent }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { affiliateId, userId, ipAddress, userAgent } = await req.json()

    if (!affiliateId) {
      return new Response(
        JSON.stringify({ error: "Missing affiliateId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Record the click
    const { data, error } = await supabase
      .from("affiliate_clicks")
      .insert({
        affiliate_id: affiliateId,
        user_id: userId || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        clicked_at: new Date().toISOString(),
      })

    if (error) {
      console.error("Database error:", error)
      return new Response(
        JSON.stringify({ error: "Failed to record click" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const { error: countError } = await supabase.rpc('increment_affiliate_clicks', { aff_id: affiliateId })
    if (countError) {
      console.error('Counter update failed:', countError)
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Function error:", error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unexpected error' }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
