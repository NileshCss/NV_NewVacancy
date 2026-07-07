'use strict';

/**
 * expireJobs.js
 * Daily cron: mark expired jobs as status='expired'.
 *
 * Schedule: 2:00 AM IST daily ('0 20 * * *' UTC = 2:00 AM IST)
 * Never hard-deletes. Excluded from public queries via status filter.
 *
 * Supersedes the old jobs/expiryJob.js — the old file is kept for
 * backward compat (server.js still imports startExpiryJob from it).
 * This new cron is registered separately in server.js.
 */

const cron     = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

async function runExpireJobs() {
  console.log('[ExpireJobs] 🗓️  Running daily expiry check...');
  const start = Date.now();

  try {
    const today = new Date().toISOString().split('T')[0];

    // Expire jobs where last_date < today and still published/draft
    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'expired', is_active: false, updated_at: new Date().toISOString() })
      .lt('last_date', today)
      .in('status', ['published', 'draft'])
      .select('id');

    if (error) throw error;

    const count = (data || []).length;
    console.log(`[ExpireJobs] ✅ Marked ${count} job(s) as expired in ${Date.now() - start}ms`);
    return { expired: count };

  } catch (err) {
    console.error('[ExpireJobs] Error:', err.message);
    return { error: err.message };
  }
}

function startExpireJobsCron() {
  // 2:00 AM IST = 20:30 UTC (IST = UTC+5:30)
  const schedule = process.env.EXPIRE_JOBS_CRON || '30 20 * * *';

  cron.schedule(schedule, () => {
    console.log('[ExpireJobs] ⏰ Daily expiry cron triggered');
    runExpireJobs().catch(err =>
      console.error('[ExpireJobs] Unhandled cron error:', err.message)
    );
  }, { timezone: 'Asia/Kolkata' });

  console.log(`[ExpireJobs] Scheduled: "${schedule}" (IST)`);
}

module.exports = { startExpireJobsCron, runExpireJobs };
