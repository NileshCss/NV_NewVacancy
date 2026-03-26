// @ts-nocheck
/**
 * Supabase Edge Function: Generate Job Recommendations
 * Analyzes user profile and job history to suggest relevant jobs
 * 
 * Usage:
 * POST /functions/v1/generate-job-recommendations
 * Body: { userId, limit: 10 }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { userId, limit = 10 } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user profile and preferences
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("job_preferences, location, skills")
      .eq("id", userId)
      .single()

    if (profileError) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get user's job application history
    const { data: applications } = await supabase
      .from("job_applications")
      .select("jobs(category, qualification)")
      .eq("user_id", userId)
      .limit(20)

    // Extract preferences from history
    const preferredCategories = new Set()
    const preferredQualifications = new Set()

    applications?.forEach(app => {
      if (app.jobs?.category) preferredCategories.add(app.jobs.category)
      if (app.jobs?.qualification) preferredQualifications.add(app.jobs.qualification)
    })

    // Build recommendation query
    let query = supabase
      .from("jobs")
      .select("*")
      .eq("is_active", true)
      .order("posted_at", { ascending: false })
      .limit(limit)

    // Filter by user preferences
    if (profile.job_preferences?.categories?.length > 0) {
      query = query.in("category", profile.job_preferences.categories)
    } else if (preferredCategories.size > 0) {
      query = query.in("category", Array.from(preferredCategories))
    }

    if (profile.location) {
      query = query.ilike("location", `%${profile.location}%`)
    }

    if (profile.skills?.length > 0) {
      // Simple keyword matching in job titles
      const skillKeywords = profile.skills.join("|")
      query = query.or(`title.ilike.%${skillKeywords}%,qualification.ilike.%${skillKeywords}%`)
    }

    const { data: recommendations, error } = await query

    if (error) {
      console.error("Recommendation query error:", error)
      return new Response(
        JSON.stringify({ error: "Failed to generate recommendations" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recommendations,
        total: recommendations.length 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Function error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
