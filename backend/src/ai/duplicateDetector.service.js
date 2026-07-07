'use strict';

/**
 * duplicateDetector.service.js
 * Fuzzy duplicate detection using Postgres pg_trgm similarity.
 * No AI needed — pure DB query via the find_duplicate_jobs RPC.
 *
 * Uses the supabase SERVICE client (service_role) so RLS is bypassed.
 */

const { createClient } = require('@supabase/supabase-js');

// Use service-role client to bypass RLS for admin-level reads
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Check if a similar job already exists in the DB.
 *
 * @param {object} job
 * @param {string} job.jobTitle    - Role/title
 * @param {string} job.company     - Company name
 * @param {string} [job.location]  - Location string
 * @param {number} [threshold]     - Similarity threshold 0.0–1.0 (default 0.65)
 *
 * @returns {Promise<{isDuplicate: boolean, matches: Array, bestScore: number}>}
 */
async function checkDuplicate(job, threshold = 0.65) {
  const { jobTitle, company, location = '' } = job;

  if (!jobTitle || !company) {
    return { isDuplicate: false, matches: [], bestScore: 0 };
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('find_duplicate_jobs', {
      p_title:     jobTitle,
      p_org:       company,
      p_location:  location,
      p_threshold: threshold,
    });

    if (error) {
      console.error('[DuplicateDetector] RPC error:', error.message);
      return { isDuplicate: false, matches: [], bestScore: 0 };
    }

    const matches   = data || [];
    const bestScore = matches.length > 0 ? matches[0].similarity_score : 0;

    return {
      isDuplicate: matches.length > 0,
      matches,
      bestScore: Math.round(bestScore * 100) / 100,
    };

  } catch (err) {
    console.error('[DuplicateDetector] Unexpected error:', err.message);
    return { isDuplicate: false, matches: [], bestScore: 0 };
  }
}

/**
 * Exact URL duplicate check — cheapest possible check.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function isUrlAlreadySaved(url) {
  if (!url) return false;

  try {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('source_url', url)
      .limit(1);

    if (error) return false;
    return (data || []).length > 0;
  } catch {
    return false;
  }
}

module.exports = { checkDuplicate, isUrlAlreadySaved };
