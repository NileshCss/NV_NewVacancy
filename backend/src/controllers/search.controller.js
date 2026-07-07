'use strict';

/**
 * search.controller.js
 * Unified search endpoint with analytics logging.
 * GET /api/search?q=&category=&city=&remote=&walkin=&page=
 */

const supabase = require('../config/supabase');

async function search(req, res) {
  const { q = '', category, city, remote, walkin, internship, page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10));
  const perPage = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset  = (pageNum - 1) * perPage;

  try {
    const { data, error } = await supabase.rpc('search_jobs', {
      query_text:   q,
      p_category:   category    || null,
      p_city:       city        || null,
      p_remote:     remote      === 'true' ? true : null,
      p_walkin:     walkin      === 'true' ? true : null,
      p_internship: internship  === 'true' ? true : null,
      p_limit:      perPage,
      p_offset:     offset,
    });

    if (error) throw error;

    // Log search term to analytics (fire-and-forget)
    if (q) {
      supabase.from('analytics').insert({
        event_type: 'search',
        metadata:   { query: q, category, city, results: (data || []).length },
      }).catch(() => {});
    }

    res.json({ success: true, data: data || [], query: q, page: pageNum, limit: perPage });

  } catch (err) {
    console.error('[SearchCtrl] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/search/trending
 * Returns top 10 most-searched terms in the last 7 days.
 */
async function trending(req, res) {
  try {
    const { data, error } = await supabase
      .from('analytics')
      .select('metadata')
      .eq('event_type', 'search')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(500);

    if (error) throw error;

    // Count queries
    const counts = {};
    for (const row of (data || [])) {
      const q = row.metadata?.query;
      if (q) counts[q] = (counts[q] || 0) + 1;
    }

    const trending = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    res.json({ success: true, data: trending });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { search, trending };
