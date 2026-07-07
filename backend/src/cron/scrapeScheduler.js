'use strict';

/**
 * scrapeScheduler.js
 * Hourly automated scraper — runs all registered plugins,
 * processes raw HTML through the AI extraction pipeline,
 * and publishes results to the jobs table.
 *
 * Schedule: every hour at :05 past (0 5 * * * → cron: '5 * * * *')
 * Fallback: manually triggered via POST /api/admin/run-scrapers
 */

const cron       = require('node-cron');
const registry   = require('../scrapers/registry');
const { extractJobData }    = require('../ai/extractJob.service');
const { runDuplicateCheck } = require('../services/duplicate.service');
const { generateSlug }      = require('../services/slug.service');
const { generateSeoFields } = require('../services/seo.service');
const { detectFakeJob }     = require('../ai/fakeJobDetector.service');
const { createClient }      = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

let isRunning = false;

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Process a single raw scraped job through the full publish pipeline.
 */
async function processRawJob(rawJob) {
  const { rawText, sourceUrl, sourceName, isInternship = false, isGovt = false } = rawJob;

  try {
    // Step 1: AI extract
    const jobData = await extractJobData(rawText || '', sourceUrl);

    // Override with scraper-detected flags
    if (isInternship) { jobData.isInternship = true; jobData.employmentType = 'Internship'; }
    if (isGovt)       { jobData.category = 'Government'; }

    // Step 2: Duplicate check
    const dupResult = await runDuplicateCheck(jobData, sourceUrl);
    if (dupResult.isDuplicate) {
      return { status: 'skipped', reason: 'duplicate', url: sourceUrl };
    }

    // Step 3: Slug + SEO
    const slug      = await generateSlug(jobData);
    const seoFields = generateSeoFields(jobData, slug);

    // Step 4: Fake-job detection
    let fakeResult = { isFake: false, riskLevel: 'low' };
    try {
      fakeResult = await detectFakeJob(jobData);
    } catch { /* non-fatal */ }

    const status = fakeResult.isFake ? 'flagged_review' : 'published';

    // Step 5: Insert
    const payload = {
      title:            jobData.jobTitle,
      organization:     jobData.company,
      location:         jobData.location,
      state:            jobData.state,
      salary_range:     jobData.salary,
      job_description:  jobData.description,
      apply_url:        jobData.applyLink,
      category:         isGovt || jobData.category?.toLowerCase().includes('government') ? 'govt' : 'private',
      qualification:    jobData.qualification,
      tags:             jobData.skills || [],
      skills:           jobData.skills || [],
      employment_type:  jobData.employmentType || 'Full-time',
      work_mode:        jobData.workMode || 'Office',
      is_walkin:        Boolean(jobData.isWalkin),
      is_internship:    Boolean(jobData.isInternship),
      walkin_date:      jobData.walkinDate,
      walkin_venue:     jobData.walkinVenue,
      batch_year:       jobData.batch,
      benefits:         jobData.benefits,
      source_url:       sourceUrl,
      source_name:      sourceName,
      scraped:          true,
      scrape_confidence: jobData.confidence,
      ai_flags:         { fake: fakeResult, duplicate: false },
      slug,
      status,
      is_active:        status === 'published',
      apply_deadline:   jobData.deadline,
      last_date:        jobData.deadline ? new Date(jobData.deadline) : null,
      posted_at:        new Date().toISOString(),
      ...seoFields,
    };

    const { data: saved, error } = await supabase
      .from('jobs')
      .insert([payload])
      .select('id, slug')
      .single();

    if (error) return { status: 'error', reason: error.message, url: sourceUrl };

    // Walk-in detail record
    if (jobData.isWalkin && jobData.walkinDate && saved?.id) {
      try {
        await supabase.from('walkins').insert({
          job_id:           saved.id,
          venue:            jobData.walkinVenue,
          date:             jobData.walkinDate,
          registration_url: jobData.registrationLink,
          map_url:          jobData.mapUrl,
        });
      } catch (e) {}
    }

    return { status: 'inserted', jobId: saved?.id, slug: saved?.slug, url: sourceUrl };

  } catch (err) {
    console.error(`[ScrapeScheduler] Pipeline error for ${sourceUrl}: ${err.message}`);
    return { status: 'error', reason: err.message, url: sourceUrl };
  }
}

// ── Main run ──────────────────────────────────────────────────────────────────

async function runAllScrapers() {
  if (!process.env.SCRAPER_ENABLED || process.env.SCRAPER_ENABLED === 'false') {
    console.log('[ScrapeScheduler] Scraping is disabled (SCRAPER_ENABLED=false)');
    return;
  }

  if (isRunning) {
    console.warn('[ScrapeScheduler] Previous run still in progress — skipping this cycle');
    return;
  }

  isRunning = true;
  const runStart = Date.now();

  const scrapers = registry.getAll();
  if (scrapers.length === 0) {
    console.warn('[ScrapeScheduler] No scrapers registered');
    isRunning = false;
    return;
  }

  console.log(`[ScrapeScheduler] 🚀 Starting hourly run — ${scrapers.length} sources`);

  const globalStats = { inserted: 0, skipped: 0, flagged: 0, errors: 0 };

  for (const scraper of scrapers) {
    const sourceName = scraper.getSourceName();
    const logEntry   = {
      source_name: sourceName,
      status:      'running',
      run_at:      new Date().toISOString(),
    };

    // Log run start
    let logRow = null;
    try {
      const { data, error } = await supabase
        .from('scrape_logs')
        .insert(logEntry)
        .select('id')
        .single();
      if (!error) logRow = data;
    } catch (e) {}

    const scrapeStart = Date.now();
    const stats = { found: 0, inserted: 0, skipped: 0, flagged: 0, errors: 0 };

    try {
      const { rawJobs, errors: scrapeErrors } = await scraper.run();
      stats.found  = rawJobs.length;
      stats.errors = scrapeErrors;

      for (const rawJob of rawJobs) {
        const result = await processRawJob(rawJob);

        if (result.status === 'inserted') {
          stats.inserted++;
          if (result.flagged) stats.flagged++;
        } else if (result.status === 'skipped') {
          stats.skipped++;
        } else {
          stats.errors++;
        }

        // Small delay between jobs to avoid overwhelming Ollama
        await new Promise(r => setTimeout(r, 500));
      }

    } catch (err) {
      console.error(`[ScrapeScheduler] Source ${sourceName} failed: ${err.message}`);
      stats.errors++;
    }

    // Update log row
    if (logRow?.id) {
      try {
        await supabase.from('scrape_logs').update({
          status:        stats.errors > stats.inserted ? 'partial' : 'success',
          jobs_found:    stats.found,
          jobs_inserted: stats.inserted,
          jobs_skipped:  stats.skipped,
          jobs_flagged:  stats.flagged,
          duration_ms:   Date.now() - scrapeStart,
        }).eq('id', logRow.id);
      } catch (e) {}
    }

    globalStats.inserted += stats.inserted;
    globalStats.skipped  += stats.skipped;
    globalStats.flagged  += stats.flagged;
    globalStats.errors   += stats.errors;

    console.log(`[ScrapeScheduler] ${sourceName}: +${stats.inserted} new, ${stats.skipped} dups, ${stats.flagged} flagged, ${stats.errors} errors`);
  }

  isRunning = false;
  const duration = Math.round((Date.now() - runStart) / 1000);
  console.log(`[ScrapeScheduler] ✅ Run complete in ${duration}s — inserted: ${globalStats.inserted}, skipped: ${globalStats.skipped}, flagged: ${globalStats.flagged}, errors: ${globalStats.errors}`);

  return globalStats;
}

// ── Cron schedule ─────────────────────────────────────────────────────────────

function startScrapeJob() {
  // Run at 5 minutes past every hour: '5 * * * *'
  const schedule = process.env.SCRAPER_CRON || '5 * * * *';

  cron.schedule(schedule, () => {
    console.log(`[ScrapeScheduler] ⏰ Cron triggered (${schedule})`);
    runAllScrapers().catch(err =>
      console.error('[ScrapeScheduler] Unhandled error in cron run:', err.message)
    );
  }, { timezone: 'Asia/Kolkata' });

  console.log(`[ScrapeScheduler] Scheduled: "${schedule}" (IST)`);
}

module.exports = { startScrapeJob, runAllScrapers };
