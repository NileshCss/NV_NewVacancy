'use strict';

/**
 * ollamaClient.js
 * HTTP client for the local Ollama server.
 *
 * Supports both /api/generate (raw) and /api/chat (messages) endpoints.
 * Falls back gracefully — callers get a structured error they can act on.
 *
 * Config (backend/.env):
 *   OLLAMA_BASE_URL  = http://localhost:11434   (or remote host)
 *   OLLAMA_MODEL     = llama3.1                 (or gemma2, mistral, qwen2.5, phi3)
 *   OLLAMA_TIMEOUT   = 60000                    (ms — LLMs are slow without GPU)
 */

const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || 'llama3.1';
const OLLAMA_TIMEOUT  = parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10);

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Check if Ollama is running and the target model is available.
 * @returns {Promise<{ok: boolean, model: string, error?: string}>}
 */
async function checkHealth() {
  try {
    const res = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    const models = (res.data?.models || []).map(m => m.name);
    const modelAvailable = models.some(m => m.startsWith(OLLAMA_MODEL.split(':')[0]));
    return {
      ok:    modelAvailable,
      model: OLLAMA_MODEL,
      available: models,
      error: modelAvailable ? undefined : `Model '${OLLAMA_MODEL}' not found. Pull it with: ollama pull ${OLLAMA_MODEL}`,
    };
  } catch (err) {
    return {
      ok:    false,
      model: OLLAMA_MODEL,
      error: `Ollama unreachable at ${OLLAMA_BASE_URL}: ${err.message}`,
    };
  }
}

// ── Core generate (chat format) ───────────────────────────────────────────────

/**
 * Send a system+user message pair to Ollama /api/chat.
 * Returns the raw text response — callers must parse JSON themselves.
 *
 * @param {string} systemPrompt
 * @param {string} userContent
 * @param {object} [opts]
 * @param {string} [opts.model]       Override model for this call
 * @param {number} [opts.temperature] 0.0–1.0 (default 0.1 for structured output)
 * @returns {Promise<string>}         Raw text from model
 */
async function generate(systemPrompt, userContent, opts = {}) {
  const model       = opts.model       || OLLAMA_MODEL;
  const temperature = opts.temperature ?? 0.1;

  const payload = {
    model,
    stream: false,
    options: { temperature },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userContent  },
    ],
  };

  const response = await axios.post(
    `${OLLAMA_BASE_URL}/api/chat`,
    payload,
    {
      timeout: OLLAMA_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return response.data?.message?.content || '';
}

// ── JSON-specific wrapper ─────────────────────────────────────────────────────

/**
 * Call Ollama and parse the response as JSON.
 * Strips markdown fences, finds JSON boundaries, fixes trailing commas.
 *
 * @param {string} systemPrompt
 * @param {string} userContent
 * @param {object} [opts]
 * @returns {Promise<object>}   Parsed JSON object
 * @throws  {Error}             If Ollama is down or JSON parsing fails
 */
async function callOllama(systemPrompt, userContent, opts = {}) {
  const start = Date.now();

  const raw = await generate(systemPrompt, userContent, opts);

  // Strip markdown code fences
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i,     '')
    .replace(/```\s*$/i,     '')
    .trim();

  // Find outermost JSON object boundaries
  const jsonStart = clean.indexOf('{');
  const jsonEnd   = clean.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Ollama (${OLLAMA_MODEL}) returned no JSON. Raw: ${raw.slice(0, 200)}`);
  }

  let jsonStr = clean.substring(jsonStart, jsonEnd + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fix common trailing-comma issues and retry
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    parsed = JSON.parse(jsonStr);
  }

  console.log(`[Ollama] ✅ ${OLLAMA_MODEL} responded in ${Date.now() - start}ms`);
  return parsed;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  checkHealth,
  generate,
  callOllama,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
};
