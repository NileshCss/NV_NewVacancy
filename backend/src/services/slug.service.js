'use strict';

/**
 * slug.service.js
 * Generates SEO-friendly, unique slugs for job listings.
 * Format: {company}-{role}-{city}-{shortId}
 *
 * Example: "infosys-java-developer-bangalore-a1b2"
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Convert text to slug-safe string.
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-')          // spaces → dashes
    .replace(/-+/g, '-')           // collapse multiple dashes
    .replace(/^-|-$/g, '')         // trim leading/trailing dashes
    .slice(0, 60);                 // cap at 60 chars
}

/**
 * Generate a 4-char alphanumeric short ID.
 * @returns {string}
 */
function shortId() {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Check if a slug already exists in the jobs table.
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
async function slugExists(slug) {
  try {
    const { data } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('slug', slug)
      .limit(1);
    return (data || []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Generate a unique slug for a job posting.
 *
 * @param {object} jobData
 * @param {string} jobData.company    - Company/organization name
 * @param {string} jobData.jobTitle   - Job title/role
 * @param {string} [jobData.location] - Location/city
 * @returns {Promise<string>}         - Unique slug
 */
async function generateSlug(jobData) {
  const { company = '', jobTitle = '', location = '' } = jobData;

  // Extract first city from location (e.g. "Mumbai, Pune" → "Mumbai")
  const city = location.split(',')[0].trim();

  const baseSlug = [
    slugify(company),
    slugify(jobTitle),
    slugify(city),
  ].filter(Boolean).join('-');

  // Try base slug first
  const candidateBase = baseSlug || 'job';
  if (!(await slugExists(candidateBase))) return candidateBase;

  // Append short IDs until unique (max 5 tries)
  for (let i = 0; i < 5; i++) {
    const candidate = `${candidateBase}-${shortId()}`;
    if (!(await slugExists(candidate))) return candidate;
  }

  // Fallback: timestamp-based slug
  return `${candidateBase}-${Date.now()}`;
}

module.exports = { generateSlug, slugify };
