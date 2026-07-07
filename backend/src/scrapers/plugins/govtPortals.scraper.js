'use strict';

/**
 * govtPortals.scraper.js
 * Scrapes NIC-hosted government job portals.
 * Government portals are generally permissive with public data indexing.
 *
 * Sources:
 *  - ncs.gov.in (National Career Service)
 *  - employment.gov.in
 *  - sarkariresult.com (aggregator with public data)
 *  - indgovtjobs.in
 */

const cheerio     = require('cheerio');
const BaseScraper = require('../base/BaseScraper');

const GOVT_SOURCES = [
  {
    name:     'ncs.gov.in',
    listUrl:  'https://www.ncs.gov.in/jobseeker/Pages/JobSearch.aspx',
    linkSel:  'a[href*="JobDetail"]',
    baseUrl:  'https://www.ncs.gov.in',
  },
  {
    name:     'employment.gov.in',
    listUrl:  'https://employment.gov.in/',
    linkSel:  'a[href*="vacancy"], a[href*="jobs"], a.job-link',
    baseUrl:  'https://employment.gov.in',
  },
  {
    // Sarkari result — public aggregator, CC-indexed
    name:    'sarkariresult',
    listUrl: 'https://www.sarkariresult.com/',
    linkSel: '.post-content a, .content a[href*="sarkariresult"]',
    baseUrl: 'https://www.sarkariresult.com',
  },
];

class GovtPortalsScraper extends BaseScraper {
  getSourceName() { return 'govt-portals'; }

  async fetchListingPages() {
    const allUrls = [];

    for (const source of GOVT_SOURCES) {
      try {
        const allowed = await this.isAllowedByRobots(source.listUrl);
        if (!allowed) {
          console.info(`[GovtPortals] robots.txt disallows: ${source.listUrl}`);
          continue;
        }

        const html = await this.fetchHtml(source.listUrl);
        const $    = cheerio.load(html);
        const links = [];

        $(source.linkSel).each((_, el) => {
          let href = $(el).attr('href') || '';
          if (!href || href === '#') return;

          // Resolve relative URLs
          if (href.startsWith('/')) href = source.baseUrl + href;
          if (!href.startsWith('http')) return;

          // Filter to job-related URLs only
          if (/vacancy|jobs?|recruitment|notification|result|apply/i.test(href)) {
            if (!links.includes(href)) links.push(href);
          }
        });

        console.log(`[GovtPortals] ${source.name}: ${links.length} links found`);
        allUrls.push(...links.slice(0, 15));

        await this.politeDelay();
      } catch (err) {
        console.error(`[GovtPortals] ${source.name} failed: ${err.message}`);
      }
    }

    return [...new Set(allUrls)];
  }

  async parse(html, url) {
    const $ = cheerio.load(html);
    $('script,style,noscript,nav,footer,header').remove();

    // Government sites often have structured notification text
    const selectors = [
      '.notification', '.vacancy-detail', '.job-detail',
      'main', 'article', '.content', '#content',
      'table',  // many govt sites use tables for job info
    ];

    let text = '';
    for (const sel of selectors) {
      const el = $(sel).first();
      const t = el.text?.().trim();
      if (t && t.length > 100) { text = t; break; }
    }

    if (!text) text = $('body').text().trim();
    if (text.length < 80) return null;

    return {
      rawText:    text.slice(0, 8000),
      url,
      sourceType: 'govt-portal',
      isGovt:     true,
    };
  }
}

module.exports = GovtPortalsScraper;
