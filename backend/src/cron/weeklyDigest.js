'use strict';

/**
 * weeklyDigest.js
 * Monday 9:00 AM IST weekly summary digest.
 * Sends top 15 jobs from the past 7 days.
 */

const cron     = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

async function runWeeklyDigest() {
  console.log('[WeeklyDigest] 📊 Preparing weekly digest...');

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, organization, location, salary_range, category, apply_url, slug, view_count')
      .eq('status', 'published')
      .gte('posted_at', since)
      .order('view_count', { ascending: false })
      .limit(15);

    if (error) throw error;

    if (!jobs?.length) {
      console.log('[WeeklyDigest] No jobs this week — skipping');
      return;
    }

    const SITE_URL = process.env.SITE_URL || 'https://www.newvacancy.live';
    const weekStr  = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID) {
      const { sendTelegramMessage } = require('../services/telegram.service');

      let msg = `🗓️ <b>WEEKLY JOB ROUNDUP</b>\n`;
      msg    += `Week ending ${weekStr} | <b>${jobs.length} Top Jobs</b>\n\n`;

      jobs.forEach((job, i) => {
        const jobUrl = job.slug ? `${SITE_URL}/jobs/${job.slug}` : (job.apply_url || SITE_URL);
        msg += `<b>${i + 1}. ${job.title}</b>\n`;
        msg += `🏢 ${job.organization} | 📍 ${job.location}`;
        if (job.salary_range) msg += ` | 💰 ${job.salary_range}`;
        msg += `\n🔗 <a href="${jobUrl}">Apply</a>\n\n`;
      });

      msg += `━━━━━━━━━━━━━━\n🌐 <a href="${SITE_URL}">All Jobs → NewVacancy</a>`;

      await sendTelegramMessage(msg, { parse_mode: 'HTML' });
      console.log('[WeeklyDigest] ✅ Telegram weekly digest sent');
    }

  } catch (err) {
    console.error('[WeeklyDigest] Error:', err.message);
  }
}

function startWeeklyDigestCron() {
  // Monday 9:00 AM IST = Monday 3:30 AM UTC
  const schedule = process.env.WEEKLY_DIGEST_CRON || '30 3 * * 1';

  cron.schedule(schedule, () => {
    console.log('[WeeklyDigest] ⏰ Cron triggered');
    runWeeklyDigest().catch(err =>
      console.error('[WeeklyDigest] Unhandled error:', err.message)
    );
  }, { timezone: 'Asia/Kolkata' });

  console.log(`[WeeklyDigest] Scheduled: "${schedule}" (IST)`);
}

module.exports = { startWeeklyDigestCron, runWeeklyDigest };
