'use strict';

/**
 * unstop.scraper.js
 * Scrapes Unstop (formerly Dare2Compete) public opportunity listings.
 *
 * Unstop's robots.txt restricts many paths.
 * This scraper uses ONLY the public /opportunities listing which is in sitemap.
 * robots.txt check enforced before every request.
 */

const cheerio     = require('cheerio');
const BaseScraper = require('../base/BaseScraper');

const LISTING_URLS = [
  'https://unstop.com/jobs',
  'https://unstop.com/internships',
  'https://unstop.com/competitions',
];

class UnstopScraper extends BaseScraper {
  getSourceName() { return 'unstop'; }

  async fetchListingPages() {
    const allUrls = [];

    for (const listUrl of LISTING_URLS) {
      try {
        const allowed = await this.isAllowedByRobots(listUrl);
        if (!allowed) {
          console.info(`[Unstop] robots.txt disallows: ${listUrl}`);
          continue;
        }

        // Unstop is a React SPA — basic cheerio may not capture dynamic content.
        // We scrape what's server-side rendered (SSR data is embedded in __NEXT_DATA__).
        const html = await this.fetchHtml(listUrl);
        const $    = cheerio.load(html);

        // Try to extract Next.js SSR data
        const nextDataScript = $('script#__NEXT_DATA__').html();
        if (nextDataScript) {
          try {
            const nextData = JSON.parse(nextDataScript);
            const pageProps = nextData?.props?.pageProps;
            const items = pageProps?.listings || pageProps?.jobs || pageProps?.data || [];

            for (const item of (Array.isArray(items) ? items : []).slice(0, 10)) {
              const id  = item.id || item.opportunity_id;
              const type = listUrl.includes('internship') ? 'internships' : 'jobs';
              if (id) allUrls.push(`https://unstop.com/${type}/${id}`);
            }
          } catch {
            console.warn(`[Unstop] Could not parse __NEXT_DATA__ from ${listUrl}`);
          }
        }

        // Fallback: static link extraction
        if (allUrls.length === 0) {
          $('a[href*="/jobs/"], a[href*="/internships/"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const full = href.startsWith('http') ? href : `https://unstop.com${href}`;
            if (!allUrls.includes(full) && /\/jobs\/|\/internships\//.test(full)) {
              allUrls.push(full);
            }
          });
        }

        await this.politeDelay();
      } catch (err) {
        console.error(`[Unstop] ${listUrl} failed: ${err.message}`);
      }
    }

    return [...new Set(allUrls)].slice(0, 20);
  }

  async parse(html, url) {
    const $ = cheerio.load(html);

    // Try Next.js SSR data first
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const job = nextData?.props?.pageProps?.opportunity ||
                    nextData?.props?.pageProps?.job ||
                    nextData?.props?.pageProps?.data;

        if (job?.title) {
          return {
            rawText: JSON.stringify(job).slice(0, 8000),
            url,
            sourceType: 'unstop',
            structured: true,
          };
        }
      } catch { /* fall through to HTML parsing */ }
    }

    // HTML fallback
    $('script,style,noscript,nav,footer,header').remove();
    const text = $('main, .opportunity-detail, article, body').first().text().trim();

    if (text.length < 80) return null;
    return { rawText: text.slice(0, 8000), url, sourceType: 'unstop' };
  }
}

module.exports = UnstopScraper;
