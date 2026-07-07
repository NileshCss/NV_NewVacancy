'use strict';

/**
 * companyCareerPages.scraper.js
 * Scrapes curated company career pages for fresher/entry-level job listings.
 *
 * All listed URLs permit indexing (verified via robots.txt).
 * Uses plain axios + cheerio — no Playwright needed for these sites.
 */

const cheerio    = require('cheerio');
const BaseScraper = require('../base/BaseScraper');

// Curated list of company career page listing URLs
// These pages list multiple jobs — we extract individual job links from each
const CAREER_SOURCES = [
  { company: 'Infosys',  url: 'https://career.infosys.com/jobdesc?reqId=', listUrl: 'https://career.infosys.com/jobs/search?tags=fresher', linkSelector: 'a[href*="jobdesc"]' },
  { company: 'Wipro',    url: 'https://careers.wipro.com/careers-home/', listUrl: 'https://careers.wipro.com/careers-home/jobs?stretch=10&stretchUnit=PERCENTAGE&location=India&timeType=Full_time', linkSelector: 'a[href*="/jobs/"]' },
  { company: 'TCS',      url: 'https://www.tcs.com/careers', listUrl: 'https://www.tcs.com/careers/tcs-freshers', linkSelector: 'a[href*="tcs.com/careers"]' },
  { company: 'HCL',      url: 'https://www.hcltech.com/careers', listUrl: 'https://www.hcltech.com/careers/fresh-talent', linkSelector: 'a.job-link, a[href*="careers"]' },
  { company: 'Cognizant', url: 'https://careers.cognizant.com/global/en', listUrl: 'https://careers.cognizant.com/global/en/search-results?keywords=fresher', linkSelector: 'a[data-ph-at-id="job-link"]' },
];

class CompanyCareerPagesScraper extends BaseScraper {
  getSourceName() { return 'company-career-pages'; }

  async fetchListingPages() {
    const allUrls = [];

    for (const source of CAREER_SOURCES) {
      try {
        const allowed = await this.isAllowedByRobots(source.listUrl);
        if (!allowed) {
          console.info(`[CompanyCareerPages] robots.txt disallows: ${source.listUrl}`);
          continue;
        }

        const html = await this.fetchHtml(source.listUrl);
        const $    = cheerio.load(html);
        const links = [];

        $(source.linkSelector).each((_, el) => {
          let href = $(el).attr('href') || '';
          if (href && !href.startsWith('http')) {
            const base = new URL(source.listUrl);
            href = `${base.protocol}//${base.host}${href.startsWith('/') ? '' : '/'}${href}`;
          }
          if (href && !links.includes(href)) links.push(href);
        });

        console.log(`[CompanyCareerPages] ${source.company}: ${links.length} job URLs found`);
        allUrls.push(...links.slice(0, 10)); // max 10 per company

        await this.politeDelay();
      } catch (err) {
        console.error(`[CompanyCareerPages] ${source.company} listing failed: ${err.message}`);
      }
    }

    return [...new Set(allUrls)]; // deduplicate
  }

  async parse(html, url) {
    const $ = cheerio.load(html);

    // Remove noise
    $('script,style,noscript,nav,footer,header,[class*="cookie"],[class*="banner"]').remove();

    // Try to extract text from common job detail containers
    const selectors = [
      '[class*="job-detail"]', '[class*="job-description"]', '[class*="vacancy"]',
      'main', 'article', '.content', '#content', '[role="main"]',
    ];

    let text = '';
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 150) {
        text = el.text().trim();
        break;
      }
    }

    if (!text) text = $('body').text().trim();
    if (text.length < 80) return null;

    return {
      rawText: text.slice(0, 8000),
      url,
      sourceType: 'company-career-page',
    };
  }
}

module.exports = CompanyCareerPagesScraper;
