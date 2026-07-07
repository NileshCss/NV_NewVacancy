'use strict';

/**
 * assistant.service.js
 * Ollama-backed conversational job search.
 *
 * Flow:
 *   User query (natural language)
 *     → Ollama: translate to structured filters JSON
 *     → Supabase: execute filtered job query
 *     → Ollama: generate natural-language response summary
 *     → Return { reply, jobs, filters }
 */

const { callOllama, checkHealth } = require('./ollamaClient');
const { callGroq }                = require('../config/groq');
const supabase                    = require('../config/supabase');

const AI_PROVIDER = process.env.AI_PROVIDER || 'auto';

// ── Query translator prompt ───────────────────────────────────────────────────

const QUERY_TRANSLATOR_PROMPT = `You are a job search query interpreter for an Indian fresher job portal.

TASK: Convert the user's natural-language job search query into a structured JSON filter object.

OUTPUT SCHEMA — return ONLY this JSON, no other text:
{
  "searchText": "key role/skill terms for full-text search",
  "category": "govt | private | null",
  "city": "city name or null",
  "isRemote": true | false | null,
  "isWalkin": true | false | null,
  "isInternship": true | false | null,
  "salaryMin": null,
  "salaryMax": null,
  "experience": "0-2 | null",
  "limit": 10,
  "intent": "one-line description of what user wants"
}

EXAMPLES:
- "Find Java jobs in Bangalore" → {"searchText":"Java developer","city":"Bangalore","category":"private","isRemote":null,"isWalkin":null,"isInternship":null,"intent":"Java developer jobs in Bangalore"}
- "Show walk-in drives tomorrow" → {"searchText":"","isWalkin":true,"intent":"Tomorrow's walk-in drives"}
- "Government jobs for MCA freshers" → {"searchText":"MCA","category":"govt","isInternship":null,"intent":"Government jobs for MCA graduates"}
- "Remote IT jobs above 5 LPA" → {"searchText":"IT software","isRemote":true,"salaryMin":500000,"intent":"Remote IT jobs with salary above 5 LPA"}

Return ONLY the JSON object.`;

// ── Response generator prompt ─────────────────────────────────────────────────

const RESPONSE_GENERATOR_PROMPT = `You are a friendly career advisor assistant on an Indian fresher job portal called NewVacancy.

Given the user's query and the job search results, write a helpful, concise response (2-3 sentences max).
Mention the number of results found, highlight any key details, and encourage the user to apply.
Keep it conversational and friendly. No markdown, plain text only.`;

// ── AI call helper ────────────────────────────────────────────────────────────

async function callAI(systemPrompt, userContent, maxTokens = 500) {
  const health = await checkHealth();
  const useOllama = AI_PROVIDER === 'ollama' || (AI_PROVIDER === 'auto' && health.ok);

  if (useOllama) {
    try {
      return await callOllama(systemPrompt, userContent);
    } catch (err) {
      console.warn('[Assistant] Ollama failed, trying Groq:', err.message);
    }
  }

  return await callGroq(systemPrompt, userContent, maxTokens);
}

// ── Main chat handler ─────────────────────────────────────────────────────────

/**
 * Process a user's conversational job search query.
 *
 * @param {string} userQuery     - Natural language query
 * @param {Array}  [history]     - Previous messages [{role, content}] for context
 * @returns {Promise<{reply:string, jobs:Array, filters:object, error?:string}>}
 */
async function chat(userQuery, history = []) {
  if (!userQuery?.trim()) {
    return { reply: 'Please ask me something! Try "Find Java jobs in Bangalore" or "Show walk-in drives today".', jobs: [], filters: {} };
  }

  // Step 1: Translate query to filters
  let filters = {};
  try {
    const contextQuery = history.length > 0
      ? `Previous: ${history.slice(-2).map(h => h.content).join(' | ')}\nCurrent: ${userQuery}`
      : userQuery;

    filters = await callAI(QUERY_TRANSLATOR_PROMPT, contextQuery);
    console.log('[Assistant] Filters extracted:', filters);
  } catch (err) {
    console.error('[Assistant] Filter extraction failed:', err.message);
    filters = { searchText: userQuery, limit: 10 };
  }

  // Step 2: Query Supabase
  let jobs = [];
  try {
    const limit = Math.min(filters.limit || 10, 20);

    const { data, error } = await supabase.rpc('search_jobs', {
      query_text:   filters.searchText || '',
      p_category:   filters.category   || null,
      p_city:       filters.city       || null,
      p_remote:     filters.isRemote   ?? null,
      p_walkin:     filters.isWalkin   ?? null,
      p_internship: filters.isInternship ?? null,
      p_limit:      limit,
      p_offset:     0,
    });

    if (error) {
      console.error('[Assistant] Supabase query error:', error.message);
    } else {
      jobs = data || [];
    }
  } catch (err) {
    console.error('[Assistant] DB query failed:', err.message);
  }

  // Step 3: Generate natural-language response
  let reply = '';
  try {
    const jobSummary = jobs.length > 0
      ? jobs.slice(0, 5).map((j, i) => `${i + 1}. ${j.title} at ${j.organization} (${j.location})`).join('\n')
      : 'No matching jobs found.';

    const responseContext = `User asked: "${userQuery}"\nSearch intent: ${filters.intent || userQuery}\nResults found: ${jobs.length}\nTop results:\n${jobSummary}`;

    const rawReply = await callAI(RESPONSE_GENERATOR_PROMPT, responseContext, 200);

    // If AI returns an object instead of string (shouldn't happen but be safe)
    reply = typeof rawReply === 'string' ? rawReply : (rawReply?.reply || rawReply?.message || `Found ${jobs.length} matching jobs for you!`);
  } catch (err) {
    console.warn('[Assistant] Response generation failed:', err.message);
    reply = jobs.length > 0
      ? `I found ${jobs.length} jobs matching your search. Browse them below!`
      : `I couldn't find jobs matching "${userQuery}". Try different keywords or check back later.`;
  }

  return { reply, jobs, filters };
}

module.exports = { chat };
