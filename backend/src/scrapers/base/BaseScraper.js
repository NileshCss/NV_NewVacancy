'use strict';

/**
 * BaseScraper.js
 * Abstract base class for all job scraper plugins.
 *
 * Every plugin must extend this class and implement:
 *   - getSourceName()       → string
 *   - fetchListingPages()   → Promise<string[]>  (list of job-detail URLs)
 *   - fetchJobDetail(url)   → Promise<string>    (raw HTML of job page)
 *   - parse(html, url)      → Promise<object>    (raw job object before AI extraction)
 *
 * Provides shared utilities:
 *   - robots.txt checking
 *   - HTTP fetch with random user-agent + retry + exponential backoff
 *   - Checkpoint tracking (last processed URL per source)
 */

const axios = require('axios');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
];

// Cache of robots.txt rules: { domain → { allowed: string[], disallowed: string[] } }
const robotsCache = new Map();

class BaseScraper {
  constructor() {
    if (new.target === BaseScraper) {
      throw new Error('BaseScraper is abstract — extend it in a plugin');
    }
    this.respectRobots = process.env.SCRAPER_RESPECT_ROBOTS !== 'false';
    this.maxJobsPerRun = parseInt(process.env.SCRAPER_MAX_JOBS_PER_RUN || '50', 10);
    this.requestDelayMs = 1500; // polite delay between requests
  }

  // ── Abstract methods (must be implemented by plugins) ─────────────────────

  /** @returns {string} Unique source identifier, e.g. 'freshersworld' */
  getSourceName() { throw new Error(`${this.constructor.name}.getSourceName() not implemented`); }

  /** @returns {Promise<string[]>} Array of job-detail URLs to scrape */
  async fetchListingPages() { throw new Error(`${this.constructor.name}.fetchListingPages() not implemented`); }

  /** @returns {Promise<string>} Raw HTML of a single job detail page */
  async fetchJobDetail(url) { return this.fetchHtml(url); }

  /**
   * Parse raw HTML into a pre-extraction job object.
   * Optional — if not overridden, the raw HTML is passed to AI directly.
   * @returns {Promise<object|null>} Pre-extracted fields (or null to skip)
   */
  async parse(html, url) { return { rawHtml: html, url }; }

  // ── Shared utilities ──────────────────────────────────────────────────────

  /** Random User-Agent header */
  randomAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Fetch a URL with retries + exponential backoff.
   * @param {string} url
   * @param {object} [opts]
   * @param {number} [opts.maxRetries]  Default 3
   * @param {number} [opts.timeout]     Default 15000ms
   * @returns {Promise<string>}         HTML body
   */
  async fetchHtml(url, opts = {}) {
    const maxRetries = opts.maxRetries ?? 3;
    const timeout    = opts.timeout    ?? 15000;
    let lastErr;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await axios.get(url, {
          headers: {
            'User-Agent':      this.randomAgent(),
            'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
            'Connection':      'keep-alive',
            'Cache-Control':   'no-cache',
          },
          timeout,
          maxRedirects: 5,
          maxContentLength: 5 * 1024 * 1024,
        });

        return res.data;

      } catch (err) {
        lastErr = err;
        if (err.response?.status === 404 || err.response?.status === 410) {
          throw new Error(`Page not found: ${url} (${err.response.status})`);
        }
        if (err.response?.status === 403 || err.response?.status === 429) {
          throw new Error(`Access blocked: ${url} (${err.response.status})`);
        }
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(`[${this.getSourceName()}] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms for ${url}`);
          await this._sleep(delay);
        }
      }
    }

    throw lastErr || new Error(`Failed to fetch: ${url}`);
  }

  /**
   * Check robots.txt before scraping a URL.
   * Returns true if allowed to scrape, false if disallowed.
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  async isAllowedByRobots(url) {
    if (!this.respectRobots) return true;

    try {
      const parsed = new URL(url);
      const domain = `${parsed.protocol}//${parsed.host}`;
      const path   = parsed.pathname;

      if (!robotsCache.has(domain)) {
        const robotsUrl = `${domain}/robots.txt`;
        try {
          const res = await axios.get(robotsUrl, {
            timeout: 5000,
            headers: { 'User-Agent': this.randomAgent() },
          });
          robotsCache.set(domain, this._parseRobots(res.data));
        } catch {
          // Can't fetch robots.txt → assume allowed
          robotsCache.set(domain, { disallowed: [] });
        }
      }

      const rules = robotsCache.get(domain);
      const isDisallowed = rules.disallowed.some(rule => path.startsWith(rule));
      return !isDisallowed;

    } catch {
      return true; // malformed URL → allow
    }
  }

  /**
   * Parse robots.txt content into structured rules.
   * Simplified: reads the first user-agent block that applies to all bots.
   */
  _parseRobots(robotsText) {
    const disallowed = [];
    let applicable = false;

    for (const line of (robotsText || '').split('\n')) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.replace('user-agent:', '').trim();
        applicable = agent === '*' || agent === 'googlebot';
      } else if (applicable && trimmed.startsWith('disallow:')) {
        const path = line.replace(/disallow:/i, '').trim();
        if (path) disallowed.push(path);
      }
    }

    return { disallowed };
  }

  /** Polite delay between requests */
  async politeDelay() {
    await this._sleep(this.requestDelayMs + Math.random() * 500);
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Run the full scrape for this source.
   * Called by scrapeScheduler.js.
   *
   * @returns {Promise<{source:string, urls:string[], rawJobs:object[], errors:number}>}
   */
  async run() {
    const sourceName = this.getSourceName();
    console.log(`[${sourceName}] Starting scrape run...`);

    const urls    = [];
    const rawJobs = [];
    let errors    = 0;

    try {
      const listingUrls = await this.fetchListingPages();
      console.log(`[${sourceName}] Found ${listingUrls.length} job URLs`);

      const toProcess = listingUrls.slice(0, this.maxJobsPerRun);

      for (const url of toProcess) {
        try {
          // robots.txt check
          if (!(await this.isAllowedByRobots(url))) {
            console.info(`[${sourceName}] Skipping (robots.txt): ${url}`);
            continue;
          }

          const html    = await this.fetchJobDetail(url);
          const parsed  = await this.parse(html, url);

          if (parsed) {
            urls.push(url);
            rawJobs.push({ ...parsed, sourceUrl: url, sourceName });
          }

          await this.politeDelay();

        } catch (err) {
          console.error(`[${sourceName}] Error on ${url}: ${err.message}`);
          errors++;
        }
      }

    } catch (err) {
      console.error(`[${sourceName}] Listing fetch failed: ${err.message}`);
      errors++;
    }

    console.log(`[${sourceName}] Run complete. ${rawJobs.length} jobs, ${errors} errors.`);
    return { source: sourceName, urls, rawJobs, errors };
  }
}

module.exports = BaseScraper;
