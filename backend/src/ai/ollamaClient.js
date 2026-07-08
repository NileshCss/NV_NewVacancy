'use strict';

/**
 * ollamaClient.js
 * HTTP client for the Ollama inference server (local or VPS).
 *
 * Supports both /api/generate (raw) and /api/chat (messages) endpoints.
 * Falls back gracefully — callers get a structured error they can act on.
 *
 * Config (backend/.env):
 *   OLLAMA_BASE_URL  = http://localhost:11434       (local dev)
 *                      https://ollama.newvacancy.live  (VPS via Nginx)
 *   OLLAMA_API_KEY   = <random secret>              (required when using VPS Nginx gate)
 *                      leave unset for local dev (no auth needed on localhost)
 *   OLLAMA_MODEL     = llama3.1                     (or gemma2, mistral, qwen2.5, phi3)
 *   OLLAMA_TIMEOUT   = 60000                        (ms — LLMs are slow without GPU)
 */

const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || 'llama3.1';
const OLLAMA_TIMEOUT  = parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10);
const OLLAMA_API_KEY  = process.env.OLLAMA_API_KEY  || '';

// Build shared auth headers — only include x-api-key when the env var is set.
// This keeps local dev zero-config while the VPS path is authenticated.
function buildHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (OLLAMA_API_KEY) headers['x-api-key'] = OLLAMA_API_KEY;
  return headers;
}

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Check if Ollama is running and the target model is available.
 * @returns {Promise<{ok: boolean, model: string, error?: string}>}
 */
async function checkHealth() {
  try {
    const res = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
      headers: buildHeaders(),
    });
    const models = (res.data?.models || []).map(m => m.name);
    const modelAvailable = models.some(m => m.startsWith(OLLAMA_MODEL.split(':')[0]));
    return {
      ok:    modelAvailable,
      model: OLLAMA_MODEL,
      available: models,
      error: modelAvailable ? undefined : `Model '${OLLAMA_MODEL}' not found. Pull it with: ollama pull ${OLLAMA_MODEL}`,
    };
  } catch (err) {
    // 401 means the VPS is up but the API key is wrong/missing
    const hint = err.response?.status === 401
      ? 'Check OLLAMA_API_KEY — the VPS returned 401 Unauthorized'
      : err.message;
    return {
      ok:    false,
      model: OLLAMA_MODEL,
      error: `Ollama unreachable at ${OLLAMA_BASE_URL}: ${hint}`,
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
      headers: buildHeaders(),
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
