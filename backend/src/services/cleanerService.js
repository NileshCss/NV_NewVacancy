'use strict';

/**
 * cleanerService.js
 * Strips raw scraped HTML into clean plain text for AI processing.
 * No external dependencies — pure string manipulation.
 */

function stripHtml(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function removeNoise(text) {
  const patterns = [
    /cookie[s]?\s*(policy|notice|consent)[^\n]*/gi,
    /accept\s*(all\s*)?(cookies?|terms)[^\n]*/gi,
    /privacy\s*policy[^\n]*/gi,
    /follow\s*us\s*(on\s*)?(facebook|twitter|instagram|linkedin)[^\n]*/gi,
    /share\s*(this\s*)?(job|post)[^\n]*/gi,
    /©\s*\d{4}[^\n]*/gi,
    /all\s*rights\s*reserved[^\n]*/gi,
    /skip\s*to\s*(main\s*)?content[^\n]*/gi,
    /loading\.\.\.[^\n]*/gi,
    /please\s*enable\s*javascript[^\n]*/gi,
  ];
  let cleaned = text;
  for (const p of patterns) cleaned = cleaned.replace(p, ' ');
  return cleaned;
}

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1)
    .join('\n')
    .trim();
}

function truncateForAI(text, maxChars = 12000) {
  if (text.length <= maxChars) return text;
  const head = text.substring(0, 8000);
  const tail = text.substring(text.length - 2000);
  return head + '\n\n[...content truncated...]\n\n' + tail;
}

/**
 * Clean raw scraped HTML/text into a compact plain-text string for AI.
 * @param {string} rawContent
 * @returns {string}
 */
function cleanScrapedContent(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return '';
  let text = rawContent;
  text = stripHtml(text);
  text = removeNoise(text);
  text = normalizeWhitespace(text);
  text = truncateForAI(text);
  return text;
}

/**
 * Quick sanity check — returns isValid + list of issues.
 * @param {string} cleanedText
 * @returns {{ isValid: boolean, issues: string[], contentLength: number }}
 */
function validateContent(cleanedText) {
  const issues = [];
  if (cleanedText.length < 100) issues.push('Content too short');
  const loginWords = ['please log in', 'please sign in', 'login required'];
  if (loginWords.some(w => cleanedText.toLowerCase().includes(w)))
    issues.push('Page requires login');
  const errorWords = ['404', 'page not found'];
  if (errorWords.some(w => cleanedText.toLowerCase().includes(w)))
    issues.push('404 page');
  return { isValid: issues.length === 0, issues, contentLength: cleanedText.length };
}

module.exports = { cleanScrapedContent, validateContent };
