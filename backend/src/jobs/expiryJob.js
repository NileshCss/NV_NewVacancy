'use strict';

/**
 * expiryJob.js
 * Nightly cron job — checks all scraped jobs for expiry.
 * Runs every day at 2:00 AM IST (20:30 UTC previous day).
 */

const cron = require('node-cron');
const { checkAndExpireJobs } = require('../services/expiryCheckerService');

let isRunning = false;

/**
 * Start the nightly cron job scheduler.
 * Call this once from server.js after app.listen().
 */
function startExpiryJob() {
  // '30 20 * * *' = 20:30 UTC = 2:00 AM IST
  cron.schedule('30 20 * * *', async () => {
    if (isRunning) {
      console.log('[ExpiryJob] Previous run still in progress — skipping.');
      return;
    }

    isRunning = true;
    console.log('[ExpiryJob] Starting nightly expiry check —', new Date().toISOString());

    try {
      const results = await checkAndExpireJobs();
      console.log('[ExpiryJob] Completed:', results);
    } catch (err) {
      console.error('[ExpiryJob] Failed:', err.message);
    } finally {
      isRunning = false;
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  console.log('[ExpiryJob] Nightly expiry checker scheduled for 2:00 AM IST');
}

/**
 * Manually trigger the expiry check (for testing or admin use).
 * Returns the results object or { error } if already running.
 */
async function triggerManualCheck() {
  if (isRunning) return { error: 'Expiry check is already running' };
  isRunning = true;
  try {
    const results = await checkAndExpireJobs();
    return results;
  } finally {
    isRunning = false;
  }
}

module.exports = { startExpiryJob, triggerManualCheck };
