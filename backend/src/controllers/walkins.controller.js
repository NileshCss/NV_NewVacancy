'use strict';

/**
 * walkins.controller.js
 * CRUD + public listing for walk-in job drives.
 *
 * Public routes:
 *   GET /api/walkins?period=today|tomorrow|week|month|upcoming
 *
 * Admin routes:
 *   POST   /api/walkins         — create walk-in record
 *   PUT    /api/walkins/:id     — update
 *   DELETE /api/walkins/:id     — delete (soft: marks job is_walkin=false)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const supabasePublic = require('../config/supabase');

// ── Date helpers ──────────────────────────────────────────────────────────────

function toIST(date) {
  // Returns date string in YYYY-MM-DD for IST timezone
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function dateRange(period) {
  const today     = toIST(new Date());
  const tomorrow  = toIST(new Date(Date.now() + 86400000));
  const weekEnd   = toIST(new Date(Date.now() + 7 * 86400000));
  const monthEnd  = toIST(new Date(Date.now() + 30 * 86400000));

  switch (period) {
    case 'today':    return { gte: today,    lte: today    };
    case 'tomorrow': return { gte: tomorrow, lte: tomorrow };
    case 'week':     return { gte: today,    lte: weekEnd  };
    case 'month':    return { gte: today,    lte: monthEnd };
    case 'upcoming': return { gte: today,    lte: monthEnd };
    default:         return { gte: today,    lte: weekEnd  };
  }
}

// ── Public: list walk-ins ─────────────────────────────────────────────────────

async function listWalkins(req, res) {
  const period = req.query.period || 'week';
  const { gte, lte } = dateRange(period);

  try {
    // Join walkins with jobs to get full job info
    const { data, error } = await supabasePublic
      .from('walkins')
      .select(`
        id, venue, address, date, start_time, end_time,
        required_docs, dress_code, map_url, registration_url,
        jobs:job_id (
          id, title, organization, location, salary_range,
          qualification, skills, tags, apply_url, slug, status
        )
      `)
      .gte('date', gte)
      .lte('date', lte)
      .order('date', { ascending: true });

    if (error) throw error;

    // Filter to active/published jobs only
    const filtered = (data || []).filter(w => w.jobs?.status === 'published');

    res.json({ success: true, data: filtered, period, count: filtered.length });

  } catch (err) {
    console.error('[WalkinsCtrl] listWalkins error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Admin: create walk-in ─────────────────────────────────────────────────────

async function createWalkin(req, res) {
  const { job_id, venue, address, date, start_time, end_time, required_docs, dress_code, map_url, registration_url } = req.body;

  if (!job_id || !date) {
    return res.status(400).json({ success: false, error: 'job_id and date are required' });
  }

  try {
    // Mark job as walk-in
    await supabaseAdmin.from('jobs').update({ is_walkin: true, walkin_date: date, walkin_venue: venue }).eq('id', job_id);

    const { data, error } = await supabaseAdmin.from('walkins').insert({
      job_id, venue, address, date, start_time, end_time,
      required_docs: Array.isArray(required_docs) ? required_docs : [],
      dress_code, map_url, registration_url,
    }).select().single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('[WalkinsCtrl] createWalkin error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Admin: update walk-in ─────────────────────────────────────────────────────

async function updateWalkin(req, res) {
  const { id } = req.params;
  const updates = req.body;
  delete updates.id;
  delete updates.job_id;

  try {
    const { data, error } = await supabaseAdmin.from('walkins').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Admin: delete walk-in ─────────────────────────────────────────────────────

async function deleteWalkin(req, res) {
  const { id } = req.params;

  try {
    // Get job_id first
    const { data: walkin } = await supabaseAdmin.from('walkins').select('job_id').eq('id', id).single();

    if (walkin?.job_id) {
      await supabaseAdmin.from('jobs').update({ is_walkin: false }).eq('id', walkin.job_id);
    }

    const { error } = await supabaseAdmin.from('walkins').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true, message: 'Walk-in deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listWalkins, createWalkin, updateWalkin, deleteWalkin };
