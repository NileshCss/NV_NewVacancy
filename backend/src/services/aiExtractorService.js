'use strict';

/**
 * aiExtractorService.js
 * Sends cleaned job page text to Claude AI and returns structured JSON.
 * Reuses the existing anthropic config (backend/src/config/anthropic.js).
 */

const { callGroq } = require('../config/groq');
const { JOB_EXTRACTOR_SYSTEM_PROMPT } = require('../prompts/jobExtractor.prompt');

const DEFAULTS = {
  jobTitle:      'Not specified',
  company:       'Not disclosed',
  location:      'All India',
  salary:        'Not specified',
  experience:    'Not specified',
  qualification: 'Not specified',
  positions:     'Not specified',
  lastDate:      'Not specified',
  applyLink:     '',
  description:   'Visit the apply link for full job details.',
  skills:        [],
  jobType:       'Full-time',
  category:      'Other',
  isExpired:     false,
  confidence:    0,
};

/**
 * Merge extracted fields with defaults; enforce types.
 * @param {object} extracted
 * @param {string} fallbackUrl
 * @returns {object}
 */
function applyDefaults(extracted, fallbackUrl) {
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    const val = extracted[key];
    if (val !== undefined && val !== null && val !== '') result[key] = val;
  }
  if (!result.applyLink) result.applyLink = fallbackUrl;
  if (!Array.isArray(result.skills)) result.skills = [];
  result.confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  result.isExpired  = Boolean(result.isExpired);
  return result;
}

/**
 * Extract structured job data using Claude AI.
 * @param {string} cleanedText  - Cleaned plain text from scraperService
 * @param {string} jobUrl       - The original job URL (fallback for applyLink)
 * @returns {Promise<object>}   - Structured job object matching DEFAULTS schema
 */
async function extractJobData(cleanedText, jobUrl) {
  if (!cleanedText || cleanedText.trim().length < 50) {
    console.warn('[AIExtractor] Content too short — returning defaults');
    return applyDefaults({}, jobUrl);
  }

  const userMessage = `INPUT URL:\n${jobUrl}\n\nINPUT CONTENT (SCRAPED FROM JOB LINK):\n${cleanedText}`;

  try {
    const extracted = await callGroq(JOB_EXTRACTOR_SYSTEM_PROMPT, userMessage, 1500);
    return applyDefaults(extracted, jobUrl);
  } catch (err) {
    console.error('[AIExtractor] Extraction failed:', err.message);
    // Second attempt after 1s delay
    try {
      await new Promise(r => setTimeout(r, 1000));
      const extracted = await callGroq(JOB_EXTRACTOR_SYSTEM_PROMPT, userMessage, 1500);
      return applyDefaults(extracted, jobUrl);
    } catch (err2) {
      console.error('[AIExtractor] Both attempts failed:', err2.message);
      return applyDefaults({}, jobUrl);
    }
  }
}

module.exports = { extractJobData };
