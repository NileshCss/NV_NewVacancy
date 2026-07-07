'use strict';

/**
 * scraper.controller.js
 * Express controllers for the job scraper feature.
 *
 * Routes:
 *   POST /api/admin/scrape-job           → preview (no DB write)
 *   POST /api/admin/scrape-and-save      → scrape + full publish pipeline
 *   POST /api/admin/trigger-expiry-check → manually run nightly checker
 *
 * Publish pipeline (scrape-and-save):
 *   scrape → AI extract → duplicate check → slug → SEO → fake-job flag → insert
 */

const { createClient }       = require('@supabase/supabase-js');
const { scrapeJobUrl }       = require('../services/scraperService');
const { extractJobData }     = require('../ai/extractJob.service');     // NEW Ollama/Groq router
const { generateSlug }       = require('../services/slug.service');
const { generateSeoFields }  = require('../services/seo.service');
const { runDuplicateCheck }  = require('../services/duplicate.service');
const { detectFakeJob }      = require('../ai/fakeJobDetector.service');
const { triggerManualCheck } = require('../jobs/expiryJob');

// Service-role client for inserts (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

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
      // Surface specific blocking/timeout codes to the frontend
      const code = scrapeResult.error?.includes('blocking') || scrapeResult.error?.includes('forbidden')
        ? 'SCRAPE_BLOCKED'
        : scrapeResult.error?.includes('timed out') || scrapeResult.error?.includes('timeout')
          ? 'SCRAPE_TIMEOUT'
          : 'SCRAPE_FAILED';
      return res.status(422).json({
        success: false, error: scrapeResult.error, code,
      });
    }

    // Detect JS-rendered pages: scraped content is too short to extract from
    const contentLength = scrapeResult.content?.trim().length || 0;
    if (contentLength < 200) {
      console.warn(`[ScraperCtrl] Content too short (${contentLength} chars) — likely JS-rendered page: ${url.trim()}`);
      // Don't hard-fail — try AI anyway, it may still extract the URL domain info
    }

    // Step 2: AI Extract
    let jobData;
    try {
      jobData = await extractJobData(scrapeResult.content, url.trim());
    } catch (aiErr) {
      console.error('[ScraperCtrl] AI extraction failed:', aiErr.message);
      return res.status(503).json({
        success: false,
        error: 'AI extraction service is unavailable. Check that Groq API key is set or Ollama is running.',
        code: 'AI_UNAVAILABLE',
      });
    }

    // Detect JS-rendered page by confidence + content length
    if (contentLength < 200 || (jobData.confidence === 0 && contentLength < 500)) {
      return res.json({
        success: true,
        data:    jobData,
        code:    'JS_RENDERED_PAGE',
        meta: {
          url:              url.trim(),
          processingTimeMs: Date.now() - start,
          confidence:       jobData.confidence,
          scrapedAt:        new Date().toISOString(),
          warning:          'Page content appears to be JavaScript-rendered. Extraction confidence is low.',
        },
      });
    }

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
    console.error('[ScraperCtrl] scrapeJobPreview error:', err.message, err.stack);
    return res.status(500).json({
      success: false, error: `Server error: ${err.message}`, code: 'INTERNAL_ERROR',
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

    // ── Step 3: Duplicate check ────────────────────────────────────────────
    const dupResult = await runDuplicateCheck(jobData, url.trim());
    if (dupResult.isDuplicate && !overrides.force_insert) {
      return res.status(409).json({
        success:     false,
        error:       `Duplicate detected: ${dupResult.reason}`,
        code:        'DUPLICATE_JOB',
        matches:     dupResult.matches,
        extractedData: jobData,
      });
    }

    // ── Step 4: Generate slug ──────────────────────────────────────────────
    const slug = await generateSlug({
      company:  jobData.company,
      jobTitle: jobData.jobTitle,
      location: jobData.location,
    });

    // ── Step 5: Generate SEO fields ────────────────────────────────────────
    const seoFields = generateSeoFields(jobData, slug);

    // ── Step 6: Fake-job detection (non-blocking) ──────────────────────────
    let fakeResult = { isFake: false, riskLevel: 'low', reasons: [] };
    try {
      fakeResult = await detectFakeJob(jobData);
    } catch (err) {
      console.warn('[ScraperCtrl] Fake-job detection failed (non-fatal):', err.message);
    }

    // Determine publish status
    const status = fakeResult.isFake ? 'flagged_review' : 'published';

    // ── Step 7: Build DB payload ───────────────────────────────────────────
    const payload = {
      title:            jobData.jobTitle,
      organization:     jobData.company,
      location:         jobData.location,
      state:            jobData.state || null,
      salary_range:     jobData.salary,
      job_description:  jobData.description,
      apply_url:        jobData.applyLink,
      category:         mapCategory(jobData.category),
      qualification:    jobData.qualification,
      experience_range: `${jobData.experienceMin || 0}-${jobData.experienceMax || 2}`,
      tags:             Array.isArray(jobData.skills) ? jobData.skills : [],
      skills:           Array.isArray(jobData.skills) ? jobData.skills : [],
      benefits:         jobData.benefits || null,
      employment_type:  jobData.employmentType || 'Full-time',
      work_mode:        jobData.workMode || 'Office',
      is_walkin:        Boolean(jobData.isWalkin),
      is_internship:    Boolean(jobData.isInternship),
      walkin_date:      jobData.walkinDate || null,
      walkin_venue:     jobData.walkinVenue || null,
      batch_year:       jobData.batch || null,
      source_url:       url.trim(),
      source_name:      overrides.source_name || 'manual',
      scraped:          true,
      scrape_confidence: jobData.confidence,
      ai_flags:         { fake: fakeResult, duplicate: dupResult.isDuplicate },
      slug,
      status,
      is_featured:      Boolean(overrides.is_featured ?? false),
      is_active:        status === 'published',
      created_by:       req.user?.id || null,
      apply_deadline:   jobData.deadline || null,
      last_date:        jobData.deadline ? new Date(jobData.deadline) : null,
      posted_at:        new Date().toISOString(),
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
      // SEO
      ...seoFields,
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

    // ── Step 8: Walk-in detail record ─────────────────────────────────────
    if (jobData.isWalkin && jobData.walkinDate && saved?.id) {
      await supabase.from('walkins').insert({
        job_id:           saved.id,
        venue:            jobData.walkinVenue,
        address:          jobData.walkinAddress,
        date:             jobData.walkinDate,
        registration_url: jobData.registrationLink,
        map_url:          jobData.mapUrl,
      }).catch(err => console.warn('[ScraperCtrl] walkins insert failed:', err.message));
    }

    return res.status(201).json({
      success:  true,
      message:  status === 'flagged_review'
                  ? 'Job saved but flagged for admin review (possible fake job signals)'
                  : 'Job scraped and published successfully',
      status,
      slug,
      data:     saved,
      meta: {
        processingTimeMs: Date.now() - start,
        confidence:       jobData.confidence,
        fakeRisk:         fakeResult.riskLevel,
        duplicate:        dupResult.isDuplicate,
      },
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map AI-extracted category string to the DB category enum.
 * DB currently supports: 'govt', 'private'.
 * Extended categories stored in the categories table — here we map to the jobs.category column.
 */
function mapCategory(aiCategory = '') {
  const cat = aiCategory.toLowerCase();
  if (cat.includes('government') || cat.includes('govt') || cat.includes('banking') || cat.includes('defence')) return 'govt';
  return 'private';
}

module.exports = { scrapeJobPreview, scrapeAndSave, manualExpiryCheck };

