'use strict';

/**
 * expiryCheckerService.js
 * Scans all active scraped jobs and deactivates those whose source URL is
 * no longer accessible or whose content says "applications closed".
 * Called by the nightly cron job (jobs/expiryJob.js).
 */

const supabase = require('../config/supabase');
const { scrapeJobUrl }   = require('./scraperService');
const { extractJobData } = require('./aiExtractorService');

/**
 * Deactivate an expired job — sets active=false, auto_expired=true.
 * Soft delete: job stays in DB for admin review.
 * @param {string} jobId
 * @param {string} jobTitle
 * @param {string} reason - 'http_error' | 'content_expired'
 */
async function handleExpiredJob(jobId, jobTitle, reason) {
  try {
    const { error } = await supabase
      .from('jobs')
      .update({
        is_active:    false,
        auto_expired: true,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) throw error;
    console.log(`[ExpiryChecker] Deactivated: "${jobTitle}" (${jobId}) — reason: ${reason}`);
  } catch (err) {
    console.error(`[ExpiryChecker] Failed to deactivate job ${jobId}:`, err.message);
  }
}

/**
 * Check all active scraped jobs for expiry.
 * Runs every night. Safe to call manually for testing.
 * @returns {Promise<{ checked, expired, errors, skipped }>}
 */
async function checkAndExpireJobs() {
  console.log('[ExpiryChecker] Starting nightly expiry check…');
  const startTime = Date.now();
  const results = { checked: 0, expired: 0, errors: 0, skipped: 0 };

  try {
    // Fetch only active jobs that were scraped (have a source_url)
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, organization, source_url, is_active, created_at')
      .eq('is_active', true)
      .eq('scraped', true)
      .not('source_url', 'is', null)
      .neq('source_url', '');

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      console.log('[ExpiryChecker] No scraped jobs to check.');
      return results;
    }

    console.log(`[ExpiryChecker] Checking ${jobs.length} scraped jobs…`);

    for (const job of jobs) {
      results.checked++;
      try {
        const scrapeResult = await scrapeJobUrl(job.source_url);

        // HTTP 404/410 → definitely expired
        if (scrapeResult.isLikelyExpired || !scrapeResult.success) {
          await handleExpiredJob(job.id, job.title, 'http_error');
          results.expired++;
          await new Promise(r => setTimeout(r, 2000)); // respectful delay
          continue;
        }

        // Use AI to detect expiry from content
        const extracted = await extractJobData(scrapeResult.content, job.source_url);

        if (extracted.isExpired) {
          await handleExpiredJob(job.id, job.title, 'content_expired');
          results.expired++;
        } else {
          // Still live — update last_checked_at
          await supabase
            .from('jobs')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', job.id);
        }

        // 2s delay between requests to avoid hammering websites
        await new Promise(r => setTimeout(r, 2000));

      } catch (jobErr) {
        console.error(`[ExpiryChecker] Error checking job ${job.id}:`, jobErr.message);
        results.errors++;
        // Never break the whole batch
      }
    }

  } catch (err) {
    console.error('[ExpiryChecker] Fatal error:', err.message);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[ExpiryChecker] Done in ${duration}s | Checked: ${results.checked} | Expired: ${results.expired} | Errors: ${results.errors}`);
  return results;
}

module.exports = { checkAndExpireJobs };
