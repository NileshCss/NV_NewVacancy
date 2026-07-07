'use strict';

/**
 * fakeJobDetector.service.js
 * Uses Ollama (or Groq fallback) to flag suspicious job postings.
 *
 * NEVER auto-deletes. Always sets status = 'flagged_review' for admin to check.
 * Returns: { isFake, confidence, reasons[] }
 */

const { callOllama, checkHealth } = require('./ollamaClient');
const { callGroq }                = require('../config/groq');

const AI_PROVIDER = process.env.AI_PROVIDER || 'auto';

const FAKE_JOB_SYSTEM_PROMPT = `You are a fraud detection engine for an Indian job portal specializing in fresher jobs.

TASK: Analyze the job details provided and determine if this job posting shows signs of being fake, fraudulent, or misleading.

OUTPUT SCHEMA — return ONLY this JSON object, no other text:
{
  "isFake": false,
  "confidence": 85,
  "riskLevel": "low | medium | high | critical",
  "reasons": ["list of specific red flags found"],
  "legitimacyIndicators": ["list of things that suggest it IS legitimate"]
}

KNOWN FAKE JOB RED FLAGS (check each carefully):
1. Requires upfront payment / registration fee / training fee / security deposit
2. Salary too good to be true for experience level (e.g. 50 LPA for freshers)
3. Vague company name or "work from home" with no company details
4. Personal Gmail/Yahoo contact instead of official company email
5. Promises of guaranteed income / no experience needed for high-paying role
6. Requests for personal bank details, Aadhaar, PAN during application
7. No official company website or verifiable address
8. Typographical errors, broken grammar throughout
9. Apply URL goes to a suspicious domain (not company official site)
10. No job description — just salary and WhatsApp number

LEGITIMACY INDICATORS:
- Official company website apply link
- Company has verifiable public presence
- Realistic salary for the role and experience
- Clear job description with responsibilities
- Named HR contact with company email domain
- Registered company name (Ltd, Pvt Ltd, Inc, LLP)

IMPORTANT: Be conservative. Only mark as fake if you see CLEAR red flags. Being a job aggregator listing is NOT a red flag. Return ONLY the JSON.`;

async function callAI(jobText) {
  const health = await checkHealth();
  const useOllama = AI_PROVIDER === 'ollama' || (AI_PROVIDER === 'auto' && health.ok);

  if (useOllama) {
    try {
      return await callOllama(FAKE_JOB_SYSTEM_PROMPT, jobText);
    } catch (err) {
      console.warn('[FakeJobDetector] Ollama failed, trying Groq:', err.message);
    }
  }

  return await callGroq(FAKE_JOB_SYSTEM_PROMPT, jobText, 800);
}

/**
 * Detect fake/fraudulent job signals.
 *
 * @param {object} jobData - Extracted job data (from extractJob.service.js)
 * @returns {Promise<{isFake:boolean, confidence:number, riskLevel:string, reasons:string[], legitimacyIndicators:string[]}>}
 */
async function detectFakeJob(jobData) {
  // Quick rule-based pre-check (no AI needed)
  const ruleFlags = [];

  if (jobData.applyLink) {
    const domain = (() => { try { return new URL(jobData.applyLink).hostname; } catch { return ''; } })();
    if (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail')) {
      ruleFlags.push('Apply link goes to personal email provider');
    }
    if (/wa\.me|whatsapp/i.test(jobData.applyLink)) {
      ruleFlags.push('Apply via WhatsApp only — no official portal');
    }
  }

  if (jobData.fakeJobSignals?.length > 0) {
    ruleFlags.push(...jobData.fakeJobSignals);
  }

  // If already highly suspicious, skip AI to save tokens
  if (ruleFlags.length >= 3) {
    return {
      isFake:              true,
      confidence:          90,
      riskLevel:           'high',
      reasons:             ruleFlags,
      legitimacyIndicators: [],
    };
  }

  // AI analysis
  const jobText = `
Job Title: ${jobData.jobTitle}
Company: ${jobData.company}
Location: ${jobData.location}
Salary: ${jobData.salary}
Experience: ${jobData.experience}
Apply Link: ${jobData.applyLink}
Description: ${(jobData.description || '').slice(0, 500)}
Pre-detected signals: ${ruleFlags.join(', ') || 'none'}
`.trim();

  try {
    const result = await callAI(jobText);

    return {
      isFake:              Boolean(result.isFake),
      confidence:          Math.min(100, Math.max(0, Number(result.confidence) || 0)),
      riskLevel:           result.riskLevel || 'low',
      reasons:             [...ruleFlags, ...(Array.isArray(result.reasons) ? result.reasons : [])],
      legitimacyIndicators: Array.isArray(result.legitimacyIndicators) ? result.legitimacyIndicators : [],
    };
  } catch (err) {
    console.error('[FakeJobDetector] AI detection failed (returning safe default):', err.message);
    return {
      isFake:              ruleFlags.length >= 2,
      confidence:          ruleFlags.length >= 2 ? 60 : 0,
      riskLevel:           ruleFlags.length >= 2 ? 'medium' : 'low',
      reasons:             ruleFlags,
      legitimacyIndicators: [],
    };
  }
}

module.exports = { detectFakeJob };
