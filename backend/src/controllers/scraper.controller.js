'use strict';

/**
 * scraper.controller.js
 * Express controllers for the job scraper feature.
 *
 * Routes:
 *   POST /api/admin/scrape-job          → preview (no DB write)
 *   POST /api/admin/scrape-and-save     → scrape + save to DB
 *   POST /api/admin/trigger-expiry-check → manually run nightly checker
 */

const supabase            = require('../config/supabase');
const { scrapeJobUrl }    = require('../services/scraperService');
const { extractJobData }  = require('../services/aiExtractorService');
const { triggerManualCheck } = require('../jobs/expiryJob');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/scrape-job
// Scrape a URL, extract job data via AI, return preview JSON.
// The admin reviews in the form modal. Nothing is saved to DB.
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeJobPreview(req, res) {
  const { url } = req.body;

  if (!url?.trim()) {
    return res.status(400).json({
      success: false, error: 'URL is required', code: 'MISSING_URL',
    });
  }

  try { new URL(url.trim()); }
  catch {
    return res.status(400).json({
      success: false, error: 'Invalid URL. Must start with http:// or https://', code: 'INVALID_URL',
    });
  }

  try {
    const start = Date.now();
    console.log(`[ScraperCtrl] Extracting: ${url.trim()}`);

    // Step 1: Scrape
    const scrapeResult = await scrapeJobUrl(url.trim());

    if (scrapeResult.isLikelyExpired) {
      return res.status(410).json({
        success: false,
        error:   'This job URL is no longer accessible (404/410). The vacancy may be closed.',
        code:    'URL_EXPIRED',
        isExpired: true,
      });
    }

    if (!scrapeResult.success) {
      return res.status(422).json({
        success: false, error: scrapeResult.error, code: 'SCRAPE_FAILED',
      });
    }

    // Step 2: AI Extract
    const jobData = await extractJobData(scrapeResult.content, url.trim());

    if (jobData.isExpired) {
      return res.status(410).json({
        success: false,
        error:   'This job posting appears to be closed or expired.',
        code:    'JOB_EXPIRED',
        isExpired: true,
        extractedData: jobData,
      });
    }

    return res.json({
      success: true,
      data:    jobData,
      meta: {
        url:             url.trim(),
        processingTimeMs: Date.now() - start,
        confidence:      jobData.confidence,
        scrapedAt:       new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error('[ScraperCtrl] scrapeJobPreview error:', err);
    return res.status(500).json({
      success: false, error: 'Internal server error', code: 'INTERNAL_ERROR',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/scrape-and-save
// Scrape + extract + save directly to DB in one step.
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeAndSave(req, res) {
  const { url, overrides = {} } = req.body;

  if (!url?.trim()) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const start = Date.now();

    const scrapeResult = await scrapeJobUrl(url.trim());
    if (scrapeResult.isLikelyExpired) {
      return res.status(410).json({
        success: false,
        error:   'Job URL is not accessible — cannot save an expired job.',
        code:    'URL_EXPIRED',
      });
    }
    if (!scrapeResult.success) {
      return res.status(422).json({ success: false, error: scrapeResult.error });
    }

    const jobData = await extractJobData(scrapeResult.content, url.trim());
    if (jobData.isExpired) {
      return res.status(409).json({
        success: false,
        error:   'This job has expired and cannot be saved.',
        code:    'JOB_EXPIRED',
      });
    }

    // Map extracted fields → exact DB column names
    const payload = {
      title:            jobData.jobTitle,
      organization:     jobData.company,
      location:         jobData.location,
      salary_range:     jobData.salary,
      job_description:  jobData.description,
      apply_url:        jobData.applyLink,
      category:         jobData.category === 'Government' ? 'govt' : 'private',
      qualification:    jobData.qualification,
      experience_range: '0-1',           // default — admin can update in form
      tags:             Array.isArray(jobData.skills) ? jobData.skills : [],
      source_url:       url.trim(),
      scraped:          true,
      scrape_confidence: jobData.confidence,
      is_featured:      Boolean(overrides.is_featured ?? false),
      is_active:        Boolean(overrides.is_active   ?? true),
      created_by:       req.user?.id || null,
      posted_at:        new Date().toISOString(),
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    };

    const { data: saved, error: dbError } = await supabase
      .from('jobs')
      .insert([payload])
      .select()
      .single();

    if (dbError) {
      console.error('[ScraperCtrl] DB error:', dbError);
      return res.status(500).json({
        success: false,
        error:   'Extracted but failed to save to database',
        code:    'DB_ERROR',
        details: dbError.message,
        extractedData: jobData,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Job scraped and saved successfully',
      data:    saved,
      meta:    { processingTimeMs: Date.now() - start, confidence: jobData.confidence },
    });

  } catch (err) {
    console.error('[ScraperCtrl] scrapeAndSave error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/trigger-expiry-check
// Manually run the nightly expiry checker (super-admin only).
// ─────────────────────────────────────────────────────────────────────────────
async function manualExpiryCheck(req, res) {
  try {
    const results = await triggerManualCheck();
    if (results?.error) {
      return res.status(409).json({ success: false, error: results.error });
    }
    return res.json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { scrapeJobPreview, scrapeAndSave, manualExpiryCheck };
