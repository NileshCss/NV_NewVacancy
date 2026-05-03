'use strict';

/**
 * scraperService.js
 * Fetches a job URL and returns cleaned text content.
 * Uses axios for HTTP and cheerio for HTML parsing.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { cleanScrapedContent, validateContent } = require('./cleanerService');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

function randomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function isValidUrl(url) {
  try {
    const p = new URL(url);
    return ['http:', 'https:'].includes(p.protocol);
  } catch { return false; }
}

function extractText(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,iframe,nav,footer,[class*="cookie"],[class*="ad-"],[class*="social"]').remove();

  const selectors = [
    'main', 'article', '[class*="job-detail"]', '[class*="vacancy"]',
    '[class*="job-content"]', '[id*="job-detail"]', '[role="main"]',
    '.content', '#content',
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) return el.text();
  }
  return $('body').text();
}

/**
 * Scrape a URL and return cleaned content.
 * @param {string} url
 * @returns {Promise<{ success: boolean, content: string, error?: string, isLikelyExpired: boolean, statusCode?: number, validation?: object }>}
 */
async function scrapeJobUrl(url) {
  if (!isValidUrl(url)) {
    return { success: false, content: '', error: 'Invalid URL format', isLikelyExpired: false };
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': randomAgent(),
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Connection': 'keep-alive',
      },
      timeout: 15000,
      maxRedirects: 5,
      maxContentLength: 5 * 1024 * 1024,
    });

    const rawText  = extractText(response.data);
    const content  = cleanScrapedContent(rawText);
    const validation = validateContent(content);

    // Quick expiry detection from HTTP layer
    const isLikelyExpired = response.status === 404 || response.status === 410;

    return { success: true, content, validation, isLikelyExpired, statusCode: response.status };

  } catch (err) {
    let error = 'Failed to fetch URL';
    let isLikelyExpired = false;

    if (err.response) {
      const s = err.response.status;
      if (s === 404 || s === 410) { error = `Job page not found (${s})`; isLikelyExpired = true; }
      else if (s === 403) error = 'Access forbidden — website blocking scraping';
      else if (s === 429) error = 'Rate limited by website';
      else error = `HTTP ${s} error`;
    } else if (err.code === 'ECONNABORTED') {
      error = 'Request timed out (15s limit)';
    } else if (err.code === 'ENOTFOUND') {
      error = 'Domain not found — check the URL';
    }

    console.error(`[Scraper] ${url}: ${error}`);
    return { success: false, content: '', error, isLikelyExpired };
  }
}

module.exports = { scrapeJobUrl };
