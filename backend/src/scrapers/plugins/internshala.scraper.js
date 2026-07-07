'use strict';

/**
 * internshala.scraper.js
 * Scrapes Internshala internship and fresher job listings.
 *
 * Internshala has public listing pages accessible to crawlers.
 * robots.txt checked before each request.
 */

const cheerio     = require('cheerio');
const BaseScraper = require('../base/BaseScraper');

const LISTING_URLS = [
  'https://internshala.com/internships/',
  'https://internshala.com/jobs/fresher-jobs/',
  'https://internshala.com/internships/work-from-home-internship/',
  'https://internshala.com/internships/computer-science-internship/',
  'https://internshala.com/internships/web-development-internship/',
];

class InternshalasScraper extends BaseScraper {
  getSourceName() { return 'internshala'; }

  async fetchListingPages() {
    const allUrls = [];

    for (const listUrl of LISTING_URLS) {
      try {
        const allowed = await this.isAllowedByRobots(listUrl);
        if (!allowed) {
          console.info(`[Internshala] robots.txt disallows: ${listUrl}`);
          continue;
        }

        const html = await this.fetchHtml(listUrl);
        const $    = cheerio.load(html);
        const links = [];

        // Internshala listing links
        $('a[href*="/internships/detail/"], a[href*="/jobs/detail/"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const full = href.startsWith('http')
            ? href
            : `https://internshala.com${href}`;
          if (!links.includes(full)) links.push(full);
        });

        console.log(`[Internshala] ${listUrl}: ${links.length} links`);
        allUrls.push(...links.slice(0, 8));

        await this.politeDelay();
      } catch (err) {
        console.error(`[Internshala] ${listUrl} failed: ${err.message}`);
      }
    }

    return [...new Set(allUrls)];
  }

  async parse(html, url) {
    const $ = cheerio.load(html);
    $('script,style,noscript,nav,footer,header,.modal').remove();

    const selectors = [
      '.internship_details', '#about_company', '.job-description',
      '.detail-section', 'main', 'article',
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

    return {
      rawText:       text.slice(0, 8000),
      url,
      sourceType:    'internshala',
      isInternship:  true,
    };
  }
}

module.exports = InternshalasScraper;
