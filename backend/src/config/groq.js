'use strict';

/**
 * groq.js — Groq API config + callGroq() helper
 * Drop-in replacement for anthropic.js callClaude() signature.
 *
 * Used by: aiExtractorService.js (job URL auto-fill + expiry detection)
 * SmartMatch continues to use anthropic.js — untouched.
 *
 * Groq models available (fast + free tier):
 *   llama-3.3-70b-versatile  ← best quality, recommended
 *   llama3-8b-8192           ← fastest, lower quality
 *   mixtral-8x7b-32768       ← good middle ground
 */

const Groq = require('groq-sdk');

if (!process.env.GROQ_API_KEY) {
  console.warn('[Config] GROQ_API_KEY is not set — job URL auto-fill will not work');
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Best model for structured JSON extraction
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/**
 * Call Groq with a system prompt + user content.
 * Returns parsed JSON — same interface as callClaude() in anthropic.js.
 *
 * @param {string} systemPrompt
 * @param {string} userContent
 * @param {number} maxTokens    Default 2000
 * @returns {Promise<object>}   Parsed JSON from the model
 */
async function callGroq(systemPrompt, userContent, maxTokens = 2000) {
  const start = Date.now();

  try {
    const response = await groq.chat.completions.create({
      model:      DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature: 0.1,   // low temp for consistent structured output
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || '';

    // Strip markdown fences before parsing (same as anthropic.js)
    const clean = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // Find JSON boundaries in case model adds prose
    const jsonStart = clean.indexOf('{');
    const jsonEnd   = clean.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No JSON object found in Groq response');
    }
    const jsonStr = clean.substring(jsonStart, jsonEnd + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fix common trailing-comma issues and retry
      const fixed = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      parsed = JSON.parse(fixed);
    }

    console.log(`[Groq] Response in ${Date.now() - start}ms | model: ${DEFAULT_MODEL}`);
    return parsed;

  } catch (err) {
    console.error('[Groq][callGroq]', err.message);
    if (err instanceof SyntaxError) {
      throw new Error('Groq returned invalid JSON. Please try again.');
    }
    throw new Error(`Groq service error: ${err.message}`);
  }
}

module.exports = { groq, callGroq, DEFAULT_MODEL };
