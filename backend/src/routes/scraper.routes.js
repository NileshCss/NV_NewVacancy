'use strict';

/**
 * scraper.routes.js
 * Scraper + expiry-check API routes.
 * Mounted in server.js under /api/admin — so full paths are:
 *   POST /api/admin/scrape-job
 *   POST /api/admin/scrape-and-save
 *   POST /api/admin/trigger-expiry-check
 */

const { Router }       = require('express');
const rateLimit        = require('express-rate-limit');
const { requireAdmin, requireSuperAdmin } = require('../middleware/rbac');
const {
  scrapeJobPreview,
  scrapeAndSave,
  manualExpiryCheck,
} = require('../controllers/scraper.controller');

const router = Router();

// ── Rate limits ──────────────────────────────────────────────────────────────
// 30 scrapes per admin per 15 minutes
const scraperLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      30,
  message:  { success: false, error: 'Too many scrape requests. Wait 15 minutes.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// 3 manual triggers per hour (it scans ALL jobs — expensive)
const expiryLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      3,
  message:  { success: false, error: 'Expiry check can only be triggered 3 times per hour.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Routes ───────────────────────────────────────────────────────────────────
// Preview — admin+: paste URL → get extracted JSON back (no DB write)
router.post('/scrape-job',           scraperLimit, requireAdmin,      scrapeJobPreview);

// Save — admin+: scrape + extract + insert in one step
router.post('/scrape-and-save',      scraperLimit, requireAdmin,      scrapeAndSave);

// Manual expiry check — super admin only
router.post('/trigger-expiry-check', expiryLimit,  requireSuperAdmin, manualExpiryCheck);

module.exports = router;
