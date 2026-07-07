'use strict';

/**
 * extractJob.service.js
 * Full AI extraction pipeline:
 *   1. Try Ollama (local, free)
 *   2. Fall back to Groq (cloud) if Ollama unavailable
 *   3. Validate against schema
 *   4. Log to ai_logs table
 *   5. Return validated JobPosting object
 *
 * Controlled by AI_PROVIDER env var: 'ollama' | 'groq' | 'auto' (default)
 */

const { callOllama, checkHealth } = require('./ollamaClient');
const { callGroq }                = require('../config/groq');
const { JOB_EXTRACTOR_SYSTEM_PROMPT } = require('./extractJob.prompt');
const supabase                    = require('../config/supabase');
const crypto                      = require('crypto');

const AI_PROVIDER = process.env.AI_PROVIDER || 'auto';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  jobTitle:         'Not specified',
  company:          'Not disclosed',
  location:         'All India',
  state:            null,
  salary:           'Not disclosed',
  experience:       'Freshers',
  experienceMin:    0,
  experienceMax:    2,
  qualification:    'Any Graduate',
  batch:            null,
  skills:           [],
  description:      'Visit the apply link for full job details.',
  benefits:         null,
  employmentType:   'Full-time',
  workMode:         'Office',
  isWalkin:         false,
  walkinDate:       null,
  walkinTime:       null,
  walkinVenue:      null,
  walkinAddress:    null,
  mapUrl:           null,
  registrationLink: null,
  applyLink:        '',
  deadline:         null,
  vacancies:        null,
  category:         'Other',
  isInternship:     false,
  isExpired:        false,
  confidence:       0,
  fakeJobSignals:   [],
};

// ── Validation ────────────────────────────────────────────────────────────────

function validateAndMerge(extracted, fallbackUrl) {
  const result = { ...DEFAULTS };

  for (const key of Object.keys(DEFAULTS)) {
    const val = extracted[key];
    if (val !== undefined && val !== null && val !== '') result[key] = val;
  }

  // Enforce types
  if (!result.applyLink)               result.applyLink       = fallbackUrl;
  if (!Array.isArray(result.skills))   result.skills          = [];
  if (!Array.isArray(result.fakeJobSignals)) result.fakeJobSignals = [];
  result.confidence    = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  result.isExpired     = Boolean(result.isExpired);
  result.isWalkin      = Boolean(result.isWalkin);
  result.isInternship  = Boolean(result.isInternship);
  result.experienceMin = parseInt(result.experienceMin, 10) || 0;
  result.experienceMax = parseInt(result.experienceMax, 10) || 2;

  // Auto-detect walk-in from employment type
  if (result.employmentType === 'Walk-in') result.isWalkin = true;
  if (result.employmentType === 'Internship') result.isInternship = true;

  return result;
}

// ── AI Provider Router ────────────────────────────────────────────────────────

async function callAI(systemPrompt, userContent) {
  const provider = AI_PROVIDER;

  // Force Groq
  if (provider === 'groq') {
    return { result: await callGroq(systemPrompt, userContent, 2000), provider: 'groq' };
  }

  // Force Ollama
  if (provider === 'ollama') {
    return { result: await callOllama(systemPrompt, userContent), provider: 'ollama' };
  }

  // Auto: try Ollama first, fall back to Groq
  const health = await checkHealth();
  if (health.ok) {
    try {
      const result = await callOllama(systemPrompt, userContent);
      return { result, provider: 'ollama' };
    } catch (err) {
      console.warn('[ExtractJob] Ollama call failed, falling back to Groq:', err.message);
    }
  } else {
    console.info(`[ExtractJob] Ollama unavailable (${health.error}), using Groq`);
  }

  return { result: await callGroq(systemPrompt, userContent, 2000), provider: 'groq' };
}

// ── Logging ───────────────────────────────────────────────────────────────────

async function logToAiLogs({ promptHash, model, provider, inputLength, outputLength, rawOutput, parsedOk, validationError, jobId, durationMs }) {
  try {
    await supabase.from('ai_logs').insert({
      prompt_hash:      promptHash,
      model,
      provider,
      input_length:     inputLength,
      output_length:    outputLength,
      raw_output:       rawOutput?.slice(0, 4000), // cap at 4k chars
      parsed_ok:        parsedOk,
      validation_error: validationError,
      job_id:           jobId || null,
      duration_ms:      durationMs,
    });
  } catch (err) {
    // Non-fatal
    console.warn('[ExtractJob] ai_logs insert failed (non-fatal):', err.message);
  }
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Extract structured job data from scraped text.
 *
 * @param {string} cleanedText  - Cleaned plain text from scraperService
 * @param {string} jobUrl       - Original job URL (fallback for applyLink)
 * @param {string} [jobId]      - DB job id if already created (for ai_logs FK)
 * @returns {Promise<object>}   - Validated JobPosting object (DEFAULTS schema)
 */
async function extractJobData(cleanedText, jobUrl, jobId = null) {
  if (!cleanedText || cleanedText.trim().length < 50) {
    console.warn('[ExtractJob] Content too short — returning defaults');
    return validateAndMerge({}, jobUrl);
  }

  const userMessage   = `INPUT URL:\n${jobUrl}\n\nINPUT CONTENT (SCRAPED FROM JOB PAGE):\n${cleanedText.slice(0, 8000)}`;
  const promptHash    = crypto.createHash('md5').update(userMessage).digest('hex');
  const inputLength   = userMessage.length;
  const start         = Date.now();

  // Attempt 1
  try {
    const { result: extracted, provider } = await callAI(JOB_EXTRACTOR_SYSTEM_PROMPT, userMessage);
    const validated = validateAndMerge(extracted, jobUrl);
    const duration  = Date.now() - start;

    await logToAiLogs({
      promptHash,
      model:           process.env.OLLAMA_MODEL || 'llama3.1',
      provider,
      inputLength,
      outputLength:    JSON.stringify(extracted).length,
      rawOutput:       JSON.stringify(extracted),
      parsedOk:        true,
      validationError: null,
      jobId,
      durationMs:      duration,
    });

    return validated;

  } catch (err) {
    console.error('[ExtractJob] Attempt 1 failed:', err.message);

    // Attempt 2 — retry after 1.5s with stricter JSON instruction
    await new Promise(r => setTimeout(r, 1500));
    const strictMessage = userMessage + '\n\nCRITICAL: Return ONLY a JSON object. No text, no markdown, no code fences.';

    try {
      const { result: extracted2, provider: p2 } = await callAI(JOB_EXTRACTOR_SYSTEM_PROMPT, strictMessage);
      const validated2 = validateAndMerge(extracted2, jobUrl);

      await logToAiLogs({
        promptHash,
        model:    process.env.OLLAMA_MODEL || 'llama3.1',
        provider: p2,
        inputLength,
        outputLength:    JSON.stringify(extracted2).length,
        rawOutput:       JSON.stringify(extracted2),
        parsedOk:        true,
        validationError: 'retry_succeeded',
        jobId,
        durationMs: Date.now() - start,
      });

      return validated2;

    } catch (err2) {
      console.error('[ExtractJob] Both attempts failed:', err2.message);

      await logToAiLogs({
        promptHash,
        model:           process.env.OLLAMA_MODEL || 'llama3.1',
        provider:        'unknown',
        inputLength,
        outputLength:    0,
        rawOutput:       err2.message,
        parsedOk:        false,
        validationError: err2.message,
        jobId,
        durationMs: Date.now() - start,
      });

      return validateAndMerge({}, jobUrl);
    }
  }
}

module.exports = { extractJobData, validateAndMerge, DEFAULTS };
