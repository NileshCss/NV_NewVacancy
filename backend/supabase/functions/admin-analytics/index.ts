// @ts-nocheck
/**
 * Supabase Edge Function: Admin Analytics
 * Provides detailed analytics for admin dashboard
 * 
 * Usage:
 * GET /functions/v1/admin-analytics
 * Query params: { period: '7d|30d|90d', metric: 'users|jobs|applications' }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const period = url.searchParams.get("period") || "30d"
    const metric = url.searchParams.get("metric") || "all"

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate date range
    const now = new Date()
    const startDate = new Date()

    switch (period) {
      case "7d":
        startDate.setDate(now.getDate() - 7)
        break
      case "30d":
        startDate.setDate(now.getDate() - 30)
        break
      case "90d":
        startDate.setDate(now.getDate() - 90)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    const analytics = {}

    // User analytics
    if (metric === "all" || metric === "users") {
      const { data: userStats } = await supabase
        .from("profiles")
        .select("created_at, role")
        .gte("created_at", startDate.toISOString())

      analytics.users = {
        total: userStats.length,
        new: userStats.filter(u => new Date(u.created_at) >= startDate).length,
        admins: userStats.filter(u => u.role === "admin").length,
        regular: userStats.filter(u => u.role === "user").length,
      }
    }

    // Job analytics
    if (metric === "all" || metric === "jobs") {
      const { data: jobStats } = await supabase
        .from("jobs")
        .select("posted_at, category, application_count")
        .gte("posted_at", startDate.toISOString())

      analytics.jobs = {
        total: jobStats.length,
        byCategory: jobStats.reduce((acc, job) => {
          acc[job.category] = (acc[job.category] || 0) + 1
          return acc
        }, {}),
        totalApplications: jobStats.reduce((sum, job) => sum + (job.application_count || 0), 0),
      }
    }

    // Application analytics
    if (metric === "all" || metric === "applications") {
      const { data: appStats } = await supabase
        .from("job_applications")
        .select("applied_at, status")
        .gte("applied_at", startDate.toISOString())

      analytics.applications = {
        total: appStats.length,
        byStatus: appStats.reduce((acc, app) => {
          acc[app.status] = (acc[app.status] || 0) + 1
          return acc
        }, {}),
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        period,
        startDate: startDate.toISOString(),
        analytics 
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
