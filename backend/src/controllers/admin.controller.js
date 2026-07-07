'use strict';

/**
 * admin.controller.js
 * Admin dashboard stats + manual scraper trigger API.
 *
 * All routes require admin/super_admin role (enforced in router).
 */

const { createClient }   = require('@supabase/supabase-js');
const { getDashboardStats } = require('../services/analytics.service');
const { runAllScrapers }    = require('../cron/scrapeScheduler');
const { runExpireJobs }     = require('../cron/expireJobs');
const { checkHealth }       = require('../ai/ollamaClient');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// ── GET /api/admin/dashboard-stats ───────────────────────────────────────────

async function dashboardStats(req, res) {
  try {
    const stats = await getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/admin/scrape-logs ────────────────────────────────────────────────

async function scrapeLogs(req, res) {
  try {
    const { data, error } = await supabase
      .from('scrape_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/admin/ai-logs ────────────────────────────────────────────────────

async function aiLogs(req, res) {
  try {
    const { data, error } = await supabase
      .from('ai_logs')
      .select('id, model, provider, parsed_ok, validation_error, duration_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/admin/flagged-jobs ───────────────────────────────────────────────

async function flaggedJobs(req, res) {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, organization, location, status, ai_flags, source_url, posted_at')
      .eq('status', 'flagged_review')
      .order('posted_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── POST /api/admin/run-scrapers ──────────────────────────────────────────────

async function triggerScrapers(req, res) {
  try {
    res.json({ success: true, message: 'Scraper run started in background. Check /api/admin/scrape-logs for results.' });
    // Run after responding (non-blocking)
    runAllScrapers().catch(err =>
      console.error('[AdminCtrl] Background scraper error:', err.message)
    );
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── POST /api/admin/approve-job/:id ──────────────────────────────────────────

async function approveJob(req, res) {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'published', is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data, message: 'Job approved and published' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/admin/ollama-health ──────────────────────────────────────────────

async function ollamaHealth(req, res) {
  try {
    const health = await checkHealth();
    res.json({ success: true, ...health });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
}

// ── POST /api/admin/run-expire ────────────────────────────────────────────────

async function triggerExpire(req, res) {
  try {
    const result = await runExpireJobs();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  dashboardStats, scrapeLogs, aiLogs, flaggedJobs,
  triggerScrapers, approveJob, ollamaHealth, triggerExpire,
};
