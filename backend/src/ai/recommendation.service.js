'use strict';

/**
 * recommendation.service.js
 * Generates "similar jobs" recommendations using skills + category + city overlap.
 * Pure Postgres query — no AI tokens consumed.
 */

const supabase = require('../config/supabase');

/**
 * Get similar/related jobs for a given job.
 *
 * @param {object} job            - Reference job (from DB)
 * @param {number} [limit]        - Max results (default 6)
 * @returns {Promise<Array>}      - Array of similar job objects
 */
async function getSimilarJobs(job, limit = 6) {
  const { id, skills = [], category, location, organization } = job;

  try {
    // Strategy: score by (skills overlap × 3) + (same category × 2) + (same location × 1)
    // Implemented as a series of queries combined client-side for simplicity

    const queries = [];

    // 1. Same category + at least one overlapping skill
    if (skills.length > 0 && category) {
      queries.push(
        supabase
          .from('jobs')
          .select('id, title, organization, location, salary_range, category, skills, slug, posted_at')
          .eq('category', category)
          .eq('status', 'published')
          .neq('id', id)
          .contains('skills', skills.slice(0, 3)) // at least first 3 skills
          .limit(limit)
      );
    }

    // 2. Same company (other openings)
    if (organization) {
      queries.push(
        supabase
          .from('jobs')
          .select('id, title, organization, location, salary_range, category, skills, slug, posted_at')
          .ilike('organization', `%${organization}%`)
          .eq('status', 'published')
          .neq('id', id)
          .limit(3)
      );
    }

    // 3. Same category, same city
    if (category && location) {
      const city = location.split(',')[0].trim();
      queries.push(
        supabase
          .from('jobs')
          .select('id, title, organization, location, salary_range, category, skills, slug, posted_at')
          .eq('category', category)
          .ilike('location', `%${city}%`)
          .eq('status', 'published')
          .neq('id', id)
          .limit(4)
      );
    }

    const results = await Promise.allSettled(queries);

    // Deduplicate by id
    const seen = new Set();
    const combined = [];

    for (const r of results) {
      if (r.status !== 'fulfilled' || r.value.error) continue;
      for (const item of (r.value.data || [])) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
        if (combined.length >= limit) break;
      }
      if (combined.length >= limit) break;
    }

    return combined.slice(0, limit);

  } catch (err) {
    console.error('[Recommendation] Error fetching similar jobs:', err.message);
    return [];
  }
}

/**
 * Get trending jobs (most viewed in last 7 days).
 * @param {number} [limit]
 * @returns {Promise<Array>}
 */
async function getTrendingJobs(limit = 8) {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, organization, location, salary_range, category, slug, view_count, posted_at')
      .eq('status', 'published')
      .gt('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('view_count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Recommendation] getTrendingJobs error:', err.message);
    return [];
  }
}

module.exports = { getSimilarJobs, getTrendingJobs };
