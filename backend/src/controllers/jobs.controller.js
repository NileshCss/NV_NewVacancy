'use strict';

/**
 * jobs.controller.js
 * Public job listing and detail API.
 *
 * Routes (mounted at /api/jobs):
 *   GET /              — list/filter jobs (paginated)
 *   GET /:slug         — job detail by slug
 *   GET /:id/similar   — similar job recommendations
 *   POST /:id/view     — increment view count (analytics)
 */

const supabase = require('../config/supabase');
const { getSimilarJobs } = require('../ai/recommendation.service');

const PUBLIC_JOB_COLUMNS = `
  id, title, organization, location, state, salary_range,
  category, qualification, tags, skills, employment_type, work_mode,
  is_walkin, is_internship, walkin_date, walkin_venue, batch_year,
  apply_url, slug, status, posted_at, last_date, is_featured, view_count,
  meta_title, meta_description, keywords, json_ld, canonical_url,
  job_description, benefits, source_name, created_at
`.trim();

// ── List / filter jobs ────────────────────────────────────────────────────────

async function listJobs(req, res) {
  const {
    q         = '',
    category,
    city,
    remote,
    walkin,
    internship,
    govt,
    private: pvt,
    skills,
    page      = 1,
    limit     = 20,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10));
  const perPage = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset  = (pageNum - 1) * perPage;

  try {
    // Use the full-text search RPC for text queries
    if (q) {
      const { data, error } = await supabase.rpc('search_jobs', {
        query_text:   q,
        p_category:   category || null,
        p_city:       city     || null,
        p_remote:     remote   === 'true' ? true  : null,
        p_walkin:     walkin   === 'true' ? true  : null,
        p_internship: internship === 'true' ? true : null,
        p_limit:      perPage,
        p_offset:     offset,
      });

      if (error) throw error;
      return res.json({ success: true, data: data || [], page: pageNum, limit: perPage });
    }

    // Build filter query
    let query = supabase
      .from('jobs')
      .select(PUBLIC_JOB_COLUMNS)
      .eq('status', 'published')
      .order('posted_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (category)              query = query.eq('category', category);
    if (govt === 'true')       query = query.eq('category', 'govt');
    if (pvt  === 'true')       query = query.eq('category', 'private');
    if (remote === 'true')     query = query.eq('work_mode', 'Remote');
    if (walkin === 'true')     query = query.eq('is_walkin', true);
    if (internship === 'true') query = query.eq('is_internship', true);
    if (city)                  query = query.ilike('location', `%${city}%`);
    if (skills)                query = query.overlaps('skills', skills.split(',').map(s => s.trim()));

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [], page: pageNum, limit: perPage });

  } catch (err) {
    console.error('[JobsCtrl] listJobs error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Job detail by slug ────────────────────────────────────────────────────────

async function getJobBySlug(req, res) {
  const { slug } = req.params;

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(PUBLIC_JOB_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Increment view count (fire-and-forget)
    supabase.from('jobs')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id)
      .catch(() => {});

    // Log analytics (fire-and-forget)
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    supabase.from('analytics').insert({
      event_type: 'view',
      job_id:     data.id,
      ip_hash:    ip.slice(0, 20),
    }).catch(() => {});

    res.json({ success: true, data });

  } catch (err) {
    console.error('[JobsCtrl] getJobBySlug error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Similar jobs ──────────────────────────────────────────────────────────────

async function getSimilar(req, res) {
  const { id } = req.params;

  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('id, skills, category, location, organization')
      .eq('id', id)
      .single();

    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const similar = await getSimilarJobs(job, 6);
    res.json({ success: true, data: similar });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Track apply click ─────────────────────────────────────────────────────────

async function trackApply(req, res) {
  const { id } = req.params;

  try {
    await supabase.from('jobs')
      .update({ apply_count: supabase.rpc('increment', { x: 1 }) })
      .eq('id', id);

    await supabase.from('analytics').insert({
      event_type: 'apply',
      job_id:     id,
      user_id:    req.user?.id || null,
    });

    res.json({ success: true });
  } catch {
    res.json({ success: true }); // non-fatal
  }
}

module.exports = { listJobs, getJobBySlug, getSimilar, trackApply };
