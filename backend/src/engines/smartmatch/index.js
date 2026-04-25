'use strict';
const { callClaude }                      = require('../../config/anthropic');
const { cacheGet, cacheSet }              = require('../../config/redis');
const { extractResumeText, validateResumeText } = require('./resumeParser');
const {
  FULL_ENGINE_PROMPT,
  ATS_ONLY_PROMPT,
  JD_MATCH_PROMPT,
  SKILL_GAP_PROMPT,
  REWRITE_PROMPT,
} = require('./prompts');

// Max resume text length sent to Claude (prevents token overflow)
const MAX_RESUME_CHARS = 8000;

/**
 * Truncate resume text safely at a sentence boundary
 * @param {string} text
 * @returns {string}
 */
function truncateResume(text) {
  if (text.length <= MAX_RESUME_CHARS) return text;
  const truncated = text.slice(0, MAX_RESUME_CHARS);
  const lastNewline = truncated.lastIndexOf('\n');
  return lastNewline > MAX_RESUME_CHARS * 0.8
    ? truncated.slice(0, lastNewline)
    : truncated;
}

/**
 * Build user content string for Claude
 * @param {string} resumeText
 * @param {string|null} jobDescription
 * @returns {string}
 */
function buildUserContent(resumeText, jobDescription = null) {
  const parts = [
    '=== RESUME TEXT START ===',
    truncateResume(resumeText),
    '=== RESUME TEXT END ===',
  ];

  if (jobDescription && jobDescription.trim().length > 50) {
    parts.push('');
    parts.push('=== JOB DESCRIPTION START ===');
    parts.push(jobDescription.trim().slice(0, 3000));
    parts.push('=== JOB DESCRIPTION END ===');
    parts.push('');
    parts.push(
      'IMPORTANT: job_match.enabled must be true. ' +
      'Compute full job match analysis.'
    );
  } else {
    parts.push('');
    parts.push('NOTE: No job description provided. Set job_match.enabled=false.');
  }

  return parts.join('\n');
}

/**
 * Validate and sanitize the SmartMatch result
 * Ensures no null arrays, no missing fields
 * @param {object} result
 * @returns {object}
 */
function sanitizeResult(result) {
  // Ensure all top-level fields exist
  const defaults = {
    parsed:           {},
    ats:              { score: 0, grade: 'D', percentile: 'N/A', verdict: 'Analysis incomplete', breakdown: {} },
    job_match:        { enabled: false, score: 0, verdict: 'N/A', required_matched: [], required_missing: [], preferred_matched: [], preferred_missing: [], breakdown: {} },
    weaknesses:       [],
    strengths:        [],
    top_actions:      [],
    salary:           { current_band: 'N/A', after_rewrite: 'N/A', after_3months: 'N/A', after_6months: 'N/A' },
    skill_roadmap:    [],
    rewritten_bullets:{ summary: '', experience_improvements: [], project_improvements: [] },
    meta:             { resume_type: 'unknown', experience_level: 'unknown', primary_domain: 'unknown', target_roles: [], analysis_confidence: 70 },
  };

  const sanitized = { ...defaults, ...result };

  // Ensure all arrays are arrays (not null)
  if (!Array.isArray(sanitized.weaknesses))    sanitized.weaknesses    = [];
  if (!Array.isArray(sanitized.strengths))     sanitized.strengths     = [];
  if (!Array.isArray(sanitized.top_actions))   sanitized.top_actions   = [];
  if (!Array.isArray(sanitized.skill_roadmap)) sanitized.skill_roadmap = [];

  // Ensure parsed.skills object
  if (!sanitized.parsed.skills) {
    sanitized.parsed.skills = {
      languages: [], frontend: [], backend: [],
      databases: [], cloud_devops: [], testing: [], concepts: [],
    };
  }

  // Ensure experience and projects are arrays
  if (!Array.isArray(sanitized.parsed.experience)) sanitized.parsed.experience = [];
  if (!Array.isArray(sanitized.parsed.projects))   sanitized.parsed.projects   = [];
  if (!Array.isArray(sanitized.parsed.education))  sanitized.parsed.education  = [];
  if (!Array.isArray(sanitized.parsed.certifications)) sanitized.parsed.certifications = [];
  if (!Array.isArray(sanitized.parsed.achievements))   sanitized.parsed.achievements   = [];

  // Ensure ATS score is a valid number 0-100
  if (typeof sanitized.ats.score !== 'number' || isNaN(sanitized.ats.score)) {
    sanitized.ats.score = 0;
  }
  sanitized.ats.score = Math.min(100, Math.max(0, sanitized.ats.score));

  return sanitized;
}

/**
 * MAIN ENGINE FUNCTION
 * Analyzes any resume file against all jobs
 * @param {Buffer}  fileBuffer     - Raw file buffer
 * @param {string}  mimetype       - File MIME type
 * @param {string}  filename       - Original filename
 * @param {string}  [jobDesc]      - Optional job description text
 * @param {string}  [userId]       - User ID for caching
 * @param {string}  [mode]         - 'full'|'ats_only'|'job_match'|'skill_gap'|'rewrite'
 * @returns {Promise<object>}
 */
async function runSmartMatch(
  fileBuffer,
  mimetype,
  filename,
  jobDesc   = null,
  userId    = 'anonymous',
  mode      = 'full'
) {
  const startTime = Date.now();

  // ── Step 1: Extract text ─────────────────────────────
  let extracted;
  try {
    extracted = await extractResumeText(fileBuffer, mimetype, filename);
  } catch (err) {
    console.error('[SmartMatch][runSmartMatch] Extraction failed:', err.message);
    throw new Error(`File reading failed: ${err.message}`);
  }

  // ── Step 2: Validate extracted text ──────────────────
  const validation = validateResumeText(extracted.text);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // ── Step 3: Check cache ───────────────────────────────
  const cacheKey = `smartmatch:${userId}:${extracted.hash}:${mode}`;
  const cached   = await cacheGet(cacheKey);
  if (cached) {
    console.log(`[SmartMatch] Cache hit for key: ${cacheKey}`);
    try {
      const parsed = JSON.parse(cached);
      parsed._cached = true;
      return parsed;
    } catch {
      // Cache corrupted — proceed with fresh analysis
    }
  }

  // ── Step 4: Select prompt based on mode ──────────────
  const prompts = {
    full:       FULL_ENGINE_PROMPT,
    ats_only:   ATS_ONLY_PROMPT,
    job_match:  JD_MATCH_PROMPT,
    skill_gap:  SKILL_GAP_PROMPT,
    rewrite:    REWRITE_PROMPT,
  };

  const systemPrompt = prompts[mode] || FULL_ENGINE_PROMPT;
  const userContent  = buildUserContent(extracted.text, jobDesc);

  // ── Step 5: Call Claude AI ─────────────────────────────
  let rawResult;
  try {
    rawResult = await callClaude(
      systemPrompt,
      userContent,
      mode === 'full' ? 4000 : 2000
    );
  } catch (err) {
    console.error('[SmartMatch][runSmartMatch] AI call failed:', err.message);
    throw new Error(`Analysis failed: ${err.message}`);
  }

  // ── Step 6: Sanitize result ────────────────────────────
  const result = sanitizeResult(rawResult);

  // ── Step 7: Add metadata ───────────────────────────────
  result._meta = {
    analyzedAt:       new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
    fileName:         filename,
    fileHash:         extracted.hash,
    wordCount:        extracted.wordCount,
    mode,
    cached:           false,
  };

  // ── Step 8: Cache result (1 hour) ──────────────────────
  try {
    await cacheSet(cacheKey, JSON.stringify(result), 3600);
  } catch (err) {
    console.warn('[SmartMatch] Cache set failed:', err.message);
  }

  console.log(
    `[SmartMatch] Analysis complete. ` +
    `Score: ${result.ats?.score || 0} | ` +
    `Time: ${result._meta.processingTimeMs}ms | ` +
    `File: ${filename} | User: ${userId}`
  );

  return result;
}

module.exports = { runSmartMatch };
