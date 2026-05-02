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
 * Sanitize and normalize a SmartMatch result.
 * Handles both old schema (v3) and new schema (v4) from Claude.
 * @param {object} result - Raw Claude JSON output
 * @returns {object}      - Normalized result safe for frontend
 */
function sanitizeResult(result) {
  if (!result || typeof result !== 'object') {
    result = {};
  }

  // ── Top-level role fields ─────────────────────────────
  result.detected_role   = result.detected_role   || 'GENERAL_FULLSTACK';
  result.role_confidence = result.role_confidence || 0.5;
  result.role_display    = result.role_display    || result.detected_role;

  // ── found_skills (v4 schema) ─────────────────────────
  if (!result.found_skills || typeof result.found_skills !== 'object') {
    result.found_skills = {};
  }
  const fs = result.found_skills;
  const fsKeys = ['core_fundamentals','frontend','backend','orm_data','databases','cloud_devops','tools_practices','ai_ml'];
  for (const k of fsKeys) {
    if (!Array.isArray(fs[k])) fs[k] = [];
  }

  // ── experience_parsed (v4 schema) ────────────────────
  if (!Array.isArray(result.experience_parsed)) result.experience_parsed = [];

  // ── parsed (v3 schema — keep for backward compat) ────
  if (!result.parsed || typeof result.parsed !== 'object') result.parsed = {};
  const p = result.parsed;
  if (!p.skills || typeof p.skills !== 'object') {
    p.skills = { languages: [], frontend: [], backend: [], databases: [], cloud_devops: [], testing: [], concepts: [] };
  }
  const skillCats = ['languages','frontend','backend','databases','cloud_devops','testing','concepts'];
  for (const k of skillCats) { if (!Array.isArray(p.skills[k])) p.skills[k] = []; }
  if (!Array.isArray(p.experience))      p.experience      = [];
  if (!Array.isArray(p.projects))        p.projects        = [];
  if (!Array.isArray(p.education))       p.education       = [];
  if (!Array.isArray(p.certifications))  p.certifications  = [];
  if (!Array.isArray(p.achievements))    p.achievements    = [];
  if (typeof p.total_experience_years  !== 'number') p.total_experience_years  = 0;
  if (typeof p.weighted_experience_months !== 'number') p.weighted_experience_months = 0;

  // Back-populate parsed.skills from found_skills if parsed.skills is empty ──
  // This ensures the frontend allSkills array is always populated
  const allFound = Object.values(fs).flat();
  if (allFound.length > 0 && p.skills.languages.length === 0 && p.skills.backend.length === 0) {
    p.skills.languages  = [...(fs.core_fundamentals || [])];
    p.skills.frontend   = [...(fs.frontend || [])];
    p.skills.backend    = [...(fs.backend || []), ...(fs.orm_data || [])];
    p.skills.databases  = [...(fs.databases || [])];
    p.skills.cloud_devops = [...(fs.cloud_devops || [])];
    p.skills.testing    = [];
    p.skills.concepts   = [...(fs.tools_practices || []), ...(fs.ai_ml || [])];
  }

  // ── ats (normalize raw/raw_score aliasing) ────────────
  if (!result.ats || typeof result.ats !== 'object') {
    result.ats = { score: 0, grade: 'D', label: 'Incomplete', percentile: 'N/A', verdict: 'Analysis incomplete', breakdown: {} };
  }
  const ats = result.ats;
  if (typeof ats.score !== 'number' || isNaN(ats.score)) ats.score = 0;
  ats.score = Math.min(100, Math.max(0, ats.score));
  ats.grade = ats.grade || (ats.score >= 90 ? 'A+' : ats.score >= 80 ? 'A' : ats.score >= 70 ? 'B+' : ats.score >= 60 ? 'B' : ats.score >= 50 ? 'C' : 'D');
  ats.label = ats.label || ats.verdict || '';

  if (!ats.breakdown || typeof ats.breakdown !== 'object') ats.breakdown = {};
  const bd = ats.breakdown;

  // Normalize each breakdown sub-object — alias raw ↔ raw_score
  const normalizeSub = (sub, defaultObj) => {
    if (!sub || typeof sub !== 'object') return { ...defaultObj };
    const o = { ...defaultObj, ...sub };
    // Alias: if raw exists use it; if raw_score exists use it; copy between them
    if (typeof o.raw === 'number' && typeof o.raw_score !== 'number') o.raw_score = o.raw;
    if (typeof o.raw_score === 'number' && typeof o.raw !== 'number') o.raw = o.raw_score;
    if (typeof o.raw !== 'number') o.raw = o.raw_score || 0;
    if (typeof o.raw_score !== 'number') o.raw_score = o.raw || 0;
    if (typeof o.weighted !== 'number') o.weighted = 0;
    return o;
  };

  bd.skills = normalizeSub(bd.skills, { raw: 0, raw_score: 0, weighted: 0, found_count: 0, core_bonus: 0, penalty: 0, found: [], missing_critical: [], missing_important: [] });
  if (!Array.isArray(bd.skills.found))            bd.skills.found            = [];
  if (!Array.isArray(bd.skills.missing_critical)) bd.skills.missing_critical = [];
  if (!Array.isArray(bd.skills.missing_important))bd.skills.missing_important= [];

  // Back-populate missing_critical from result.missing.critical if empty
  if (bd.skills.missing_critical.length === 0 && result.missing?.critical?.length > 0) {
    bd.skills.missing_critical = result.missing.critical.map(m => typeof m === 'string' ? m : m.skill || '').filter(Boolean);
  }
  if (bd.skills.missing_important.length === 0 && result.missing?.high?.length > 0) {
    bd.skills.missing_important = result.missing.high.map(m => typeof m === 'string' ? m : m.skill || '').filter(Boolean);
  }

  bd.experience = normalizeSub(bd.experience, { raw: 0, raw_score: 0, weighted: 0, total_tech_months: 0, total_weighted_months: 0, tier_breakdown: [] });
  if (!Array.isArray(bd.experience.tier_breakdown)) bd.experience.tier_breakdown = [];

  bd.education = normalizeSub(bd.education, { raw: 0, raw_score: 0, weighted: 0, degree: '', cgpa_bonus: 0, research_bonus: 0, details: '' });

  bd.completeness = normalizeSub(bd.completeness, { raw: 0, raw_score: 0, weighted: 0, checks: {}, missing_sections: [] });
  if (!Array.isArray(bd.completeness.missing_sections)) bd.completeness.missing_sections = [];
  if (!bd.completeness.checks || typeof bd.completeness.checks !== 'object') bd.completeness.checks = {};

  bd.keywords = normalizeSub(bd.keywords, { raw: 0, raw_score: 0, weighted: 0, found: [], found_tier_a: [], found_tier_b: [], found_tier_c: [], missing_high_value: [] });
  if (!Array.isArray(bd.keywords.found))              bd.keywords.found              = [];
  if (!Array.isArray(bd.keywords.found_tier_a))       bd.keywords.found_tier_a       = [];
  if (!Array.isArray(bd.keywords.found_tier_b))       bd.keywords.found_tier_b       = [];
  if (!Array.isArray(bd.keywords.found_tier_c))       bd.keywords.found_tier_c       = [];
  if (!Array.isArray(bd.keywords.missing_high_value)) bd.keywords.missing_high_value = [];

  if (typeof bd.cert_bonus !== 'number') bd.cert_bonus = 0;

  // ── missing (v4 schema) ───────────────────────────────
  if (!result.missing || typeof result.missing !== 'object') result.missing = {};
  if (!Array.isArray(result.missing.critical)) result.missing.critical = [];
  if (!Array.isArray(result.missing.high))     result.missing.high     = [];
  if (!Array.isArray(result.missing.medium))   result.missing.medium   = [];

  // ── job_match ─────────────────────────────────────────
  if (!result.job_match || typeof result.job_match !== 'object') {
    result.job_match = { enabled: false, score: 0, verdict: 'N/A', apply_recommended: false, required_matched: [], required_missing: [], preferred_matched: [], preferred_missing: [], breakdown: {} };
  }
  const jm = result.job_match;
  if (!Array.isArray(jm.required_matched))  jm.required_matched  = [];
  if (!Array.isArray(jm.required_missing))  jm.required_missing  = [];
  if (!Array.isArray(jm.preferred_matched)) jm.preferred_matched = [];
  if (!Array.isArray(jm.preferred_missing)) jm.preferred_missing = [];
  if (!jm.breakdown || typeof jm.breakdown !== 'object') jm.breakdown = {};

  // ── Arrays ────────────────────────────────────────────
  if (!Array.isArray(result.strengths))     result.strengths     = [];
  if (!Array.isArray(result.weaknesses))    result.weaknesses    = [];
  if (!Array.isArray(result.top_actions))   result.top_actions   = [];
  if (!Array.isArray(result.skill_roadmap)) result.skill_roadmap = [];

  // ── salary — normalize both v3 and v4 field names ────
  if (!result.salary || typeof result.salary !== 'object') result.salary = {};
  const s = result.salary;
  s.current_band      = s.current_band      || 'N/A';
  s.after_rewrite     = s.after_rewrite     || s.after_resume_fix    || 'N/A';
  s.after_resume_fix  = s.after_resume_fix  || s.after_rewrite       || 'N/A';
  s.after_3months     = s.after_3months     || s.after_3months_upskill || 'N/A';
  s.after_6months     = s.after_6months     || s.after_6months_upskill || 'N/A';

  // ── rewritten_bullets ─────────────────────────────────
  if (!result.rewritten_bullets || typeof result.rewritten_bullets !== 'object') {
    result.rewritten_bullets = { summary: '', experience_improvements: [], project_improvements: [] };
  }
  const rb = result.rewritten_bullets;
  if (!rb.summary) rb.summary = '';
  if (!Array.isArray(rb.experience_improvements)) rb.experience_improvements = [];
  if (!Array.isArray(rb.project_improvements))    rb.project_improvements    = [];

  // ── meta ──────────────────────────────────────────────
  if (!result.meta || typeof result.meta !== 'object') {
    result.meta = { resume_type: 'unknown', experience_level: 'unknown', primary_domain: 'unknown', target_roles: [], analysis_confidence: 70 };
  }
  if (!Array.isArray(result.meta.target_roles)) result.meta.target_roles = [];

  return result;
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
