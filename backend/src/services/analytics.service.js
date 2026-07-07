'use strict';

/**
 * analytics.service.js
 * Lightweight event logging for views, applies, searches.
 */

const supabase = require('../config/supabase');

/**
 * Log an analytics event.
 * Fire-and-forget — never throws.
 *
 * @param {'view'|'apply'|'search'|'share'|'save'} eventType
 * @param {object} [meta]
 */
async function logEvent(eventType, meta = {}) {
  try {
    await supabase.from('analytics').insert({
      event_type: eventType,
      job_id:     meta.jobId     || null,
      user_id:    meta.userId    || null,
      ip_hash:    meta.ip        ? meta.ip.slice(0, 20) : null,
      metadata:   meta,
    });
  } catch { /* non-fatal */ }
}

/**
 * Get dashboard analytics summary.
 * @returns {Promise<object>}
 */
async function getDashboardStats() {
  try {
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
    const since1d = new Date(Date.now() - 86400000).toISOString();

    const [jobsToday, jobsThisWeek, walkins, scrapeLog, analytics7d] = await Promise.allSettled([
      supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('posted_at', since1d).eq('status', 'published'),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('posted_at', since7d).eq('status', 'published'),
      supabase.from('walkins').select('id', { count: 'exact', head: true }).gte('date', new Date().toISOString().split('T')[0]),
      supabase.from('scrape_logs').select('*').order('run_at', { ascending: false }).limit(10),
      supabase.from('analytics').select('event_type').gte('created_at', since7d),
    ]);

    const eventCounts = {};
    for (const row of (analytics7d.status === 'fulfilled' ? analytics7d.value.data || [] : [])) {
      eventCounts[row.event_type] = (eventCounts[row.event_type] || 0) + 1;
    }

    return {
      jobs: {
        today:    jobsToday.status === 'fulfilled'    ? jobsToday.value.count    : null,
        thisWeek: jobsThisWeek.status === 'fulfilled' ? jobsThisWeek.value.count : null,
      },
      walkins: {
        today: walkins.status === 'fulfilled' ? walkins.value.count : null,
      },
      scrapeLogs: scrapeLog.status === 'fulfilled' ? scrapeLog.value.data || [] : [],
      analytics7d: eventCounts,
    };

  } catch (err) {
    console.error('[Analytics] getDashboardStats error:', err.message);
    return {};
  }
}

module.exports = { logEvent, getDashboardStats };
