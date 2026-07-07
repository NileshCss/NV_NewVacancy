'use strict';

/**
 * freshersworld.scraper.js
 * Scrapes Freshersworld public job listings.
 *
 * NOTE: Freshersworld's robots.txt restricts many paths.
 * This scraper checks robots.txt and only scrapes allowed URLs.
 * Uses the sitemap-listed category pages which are generally allowed.
 */

const cheerio     = require('cheerio');
const BaseScraper = require('../base/BaseScraper');

// Public category URLs that appear in the sitemap
const LISTING_URLS = [
  'https://www.freshersworld.com/jobs/fresher-jobs',
  'https://www.freshersworld.com/jobs/it-fresher-jobs',
  'https://www.freshersworld.com/jobs/bca-fresher-jobs',
  'https://www.freshersworld.com/jobs/mca-fresher-jobs',
  'https://www.freshersworld.com/jobs/btech-fresher-jobs',
  'https://www.freshersworld.com/jobs/off-campus-drives',
];

class FreshersworldScraper extends BaseScraper {
  getSourceName() { return 'freshersworld'; }

  async fetchListingPages() {
    const allUrls = [];

    for (const listUrl of LISTING_URLS) {
      try {
        const allowed = await this.isAllowedByRobots(listUrl);
        if (!allowed) {
          console.info(`[Freshersworld] robots.txt disallows: ${listUrl}`);
          continue;
        }

        const html = await this.fetchHtml(listUrl);
        const $    = cheerio.load(html);

        // Freshersworld job cards typically have links in this pattern
        const links = [];
        $('a[href*="/jobs/jobdetail/"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const full = href.startsWith('http')
            ? href
            : `https://www.freshersworld.com${href}`;
          if (!links.includes(full)) links.push(full);
        });

        console.log(`[Freshersworld] ${listUrl}: ${links.length} job links`);
        allUrls.push(...links.slice(0, 8));

        await this.politeDelay();
      } catch (err) {
        console.error(`[Freshersworld] ${listUrl} failed: ${err.message}`);
      }
    }

    return [...new Set(allUrls)];
  }

  async parse(html, url) {
    const $ = cheerio.load(html);
    $('script,style,noscript,nav,footer,header,[class*="ad"],[id*="ad"]').remove();

    // Freshersworld job detail containers
    const selectors = [
      '.job-description', '.jobview-description', '#jobDetails',
      '.job-detail-content', 'main', 'article',
    ];

    let text = '';
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 100) {
        text = el.text().trim();
        break;
      }
    }

    if (!text) text = $('body').text().replace(/\s+/g, ' ').trim();
    if (text.length < 80) return null;

    return { rawText: text.slice(0, 8000), url, sourceType: 'freshersworld' };
  }
}

module.exports = FreshersworldScraper;
