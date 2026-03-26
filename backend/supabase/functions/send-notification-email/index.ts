// @ts-nocheck
/**
 * Supabase Edge Function: Send Email Notification
 * Triggers: When a new job matching user interests is posted
 * 
 * Usage:
 * POST /functions/v1/send-notification-email
 * Body: { userId, jobId, userEmail, userName, jobTitle, organization }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const RESEND_API_URL = "https://api.resend.com/emails"

serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { userId, jobId, userEmail, userName, jobTitle, organization } = await req.json()

    // Validate required fields
    if (!userEmail || !jobTitle || !organization) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Send email via Resend
    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "jobs@newvacancy.com",
        to: userEmail,
        subject: `New Job Alert: ${jobTitle} at ${organization}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hi ${userName}! 👋</h2>
            <p>We found a job matching your interests:</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">${jobTitle}</h3>
              <p><strong>${organization}</strong></p>
              <a href="https://newvacancy.com/job/${jobId}" 
                 style="display: inline-block; background: #007BFF; color: white; padding: 10px 20px; 
                        border-radius: 5px; text-decoration: none; margin-top: 10px;">
                View Job
              </a>
            </div>
            
            <p>Don't miss out - apply today!</p>
            <p style="color: #666; font-size: 12px;">
              You received this email because you're subscribed to job alerts on New Vacancy
            </p>
          </div>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      console.error("Email send error:", errorData)
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorData }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
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
