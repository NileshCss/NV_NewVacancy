'use strict';

/**
 * dailyDigest.js
 * Daily 8:00 AM IST digest: new jobs from the last 24 hours.
 * Sends via Telegram + WhatsApp (if enabled).
 */

const cron     = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

async function runDailyDigest() {
  console.log('[DailyDigest] 📢 Preparing daily digest...');

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, organization, location, salary_range, category, apply_url, slug')
      .eq('status', 'published')
      .gte('posted_at', since)
      .order('posted_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      console.log('[DailyDigest] No new jobs in last 24h — skipping digest');
      return;
    }

    const SITE_URL  = process.env.SITE_URL || 'https://www.newvacancy.live';
    const dateStr   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    // ── Telegram digest ─────────────────────────────────────────────────────
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID) {
      const { sendTelegramMessage } = require('../services/telegram.service');

      let msg = `📢 <b>DAILY JOB DIGEST</b>\n`;
      msg    += `📅 ${dateStr} | 🎯 <b>${jobs.length} New Jobs</b>\n\n`;

      jobs.slice(0, 8).forEach((job, i) => {
        const jobUrl = job.slug ? `${SITE_URL}/jobs/${job.slug}` : (job.apply_url || SITE_URL);
        msg += `${i + 1}. <b>${job.title}</b>\n`;
        msg += `   🏢 ${job.organization} | 📍 ${job.location}\n`;
        msg += `   🔗 <a href="${jobUrl}">Apply Now</a>\n\n`;
      });

      if (jobs.length > 8) msg += `...and <b>${jobs.length - 8} more!</b>\n\n`;
      msg += `🌐 <a href="${SITE_URL}">${SITE_URL}</a>`;

      await sendTelegramMessage(msg, { parse_mode: 'HTML' });
      console.log('[DailyDigest] Telegram digest sent');
    }

    // ── WhatsApp digest ─────────────────────────────────────────────────────
    if (process.env.WHATSAPP_ENABLED === 'true') {
      try {
        const notification = require('../services/notificationService');
        await notification.notifyBulkDigest(jobs);
        console.log('[DailyDigest] WhatsApp digest sent');
      } catch (err) {
        console.warn('[DailyDigest] WhatsApp digest failed (non-fatal):', err.message);
      }
    }

    // ── Log to notifications table ───────────────────────────────────────────
    await supabase.from('notifications').insert({
      type:      'telegram',
      recipient: process.env.TELEGRAM_CHANNEL_ID || 'digest',
      status:    'sent',
      sent_at:   new Date().toISOString(),
    }).catch(() => {});

    console.log(`[DailyDigest] ✅ Digest sent for ${jobs.length} jobs`);

  } catch (err) {
    console.error('[DailyDigest] Error:', err.message);
  }
}

function startDailyDigestCron() {
  // 8:00 AM IST = 2:30 UTC
  const schedule = process.env.DAILY_DIGEST_CRON || '30 2 * * *';

  cron.schedule(schedule, () => {
    console.log('[DailyDigest] ⏰ Cron triggered');
    runDailyDigest().catch(err =>
      console.error('[DailyDigest] Unhandled error:', err.message)
    );
  }, { timezone: 'Asia/Kolkata' });

  console.log(`[DailyDigest] Scheduled: "${schedule}" (IST)`);
}

module.exports = { startDailyDigestCron, runDailyDigest };
