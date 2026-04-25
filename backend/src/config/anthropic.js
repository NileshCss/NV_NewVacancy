'use strict';
const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('[Config] ANTHROPIC_API_KEY is not set in environment');
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Call Anthropic Claude with a system prompt and user content
 * @param {string} systemPrompt - The system instruction
 * @param {string} userContent  - The user message content
 * @param {number} maxTokens    - Max tokens (default 2000)
 * @returns {Promise<object>}   - Parsed JSON response from Claude
 */
async function callClaude(systemPrompt, userContent, maxTokens = 2000) {
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userContent }],
    });

    const raw = response.content
      .map(block => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('');

    // Strip markdown fences before parsing
    const clean = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(clean);
    console.log(
      `[Anthropic] Response received in ${Date.now() - start}ms`
    );
    return parsed;

  } catch (err) {
    console.error('[Anthropic][callClaude]', err.message);
    if (err instanceof SyntaxError) {
      throw new Error(
        'AI returned invalid JSON. Please try again.'
      );
    }
    throw new Error(`AI service error: ${err.message}`);
  }
}

module.exports = { client, callClaude };
