'use strict';

/**
 * googleJobs.scraper.js
 * Extracts JSON-LD JobPosting structured data from employer career pages.
 *
 * Many company career pages embed Google-indexable JSON-LD JobPosting schema.
 * This scraper targets those — no robots.txt issues since we're following Google's indexing.
 *
 * SOURCES: curated list of startup/mid-size company career pages that use JSON-LD.
 */

const cheerio     = require('cheerio');
const BaseScraper = require('../base/BaseScraper');

const JSONLD_CAREER_PAGES = [
  'https://boards.greenhouse.io/search#.json?q=fresher&country_codes%5B%5D=IN',
  'https://jobs.lever.co/search?location=India',
  'https://wellfound.com/jobs?role=software-engineer&location=India',
  'https://www.linkedin.com/jobs/search/?keywords=fresher&location=India&f_E=1',
];

class GoogleJobsScraper extends BaseScraper {
  getSourceName() { return 'google-jobs-jsonld'; }

  async fetchListingPages() {
    // We fetch individual pages that are known to have JSON-LD
    // This plugin primarily processes pages with structured data
    return JSONLD_CAREER_PAGES;
  }

  async fetchJobDetail(url) {
    return this.fetchHtml(url);
  }

  async parse(html, url) {
    const $ = cheerio.load(html);

    // Extract JSON-LD blocks
    const jsonLdBlocks = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw  = $(el).html();
        const data = JSON.parse(raw);

        // Handle arrays and single objects
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'JobPosting') {
            jsonLdBlocks.push(item);
          }
        }
      } catch { /* invalid JSON-LD */ }
    });

    if (jsonLdBlocks.length === 0) return null;

    // Convert first JobPosting to our raw text format for AI processing
    const job = jsonLdBlocks[0];
    const text = [
      `Job Title: ${job.title || ''}`,
      `Company: ${job.hiringOrganization?.name || ''}`,
      `Location: ${job.jobLocation?.address?.addressLocality || ''}, ${job.jobLocation?.address?.addressCountry || 'India'}`,
      `Description: ${(job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 2000)}`,
      `Salary: ${job.baseSalary?.value?.value || job.baseSalary?.value || 'Not specified'}`,
      `Type: ${job.employmentType || 'Full-time'}`,
      `Date Posted: ${job.datePosted || ''}`,
      `Valid Through: ${job.validThrough || ''}`,
      `Apply: ${job.url || url}`,
    ].join('\n');

    return {
      rawText:    text,
      url:        job.url || url,
      sourceType: 'google-jobs-jsonld',
      structured: true,
      jsonLd:     job,
    };
  }

  // Override run() to handle multiple JSON-LD jobs per page
  async run() {
    const sourceName = this.getSourceName();
    const rawJobs    = [];
    let errors       = 0;

    for (const url of JSONLD_CAREER_PAGES) {
      try {
        const allowed = await this.isAllowedByRobots(url);
        if (!allowed) continue;

        const html    = await this.fetchHtml(url);
        const $       = cheerio.load(html);

        // Collect all JobPosting JSON-LD on the page
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const raw  = $(el).html();
            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];

            for (const item of items) {
              if (item['@type'] === 'JobPosting') {
                const jobUrl = item.url || url;
                const text = [
                  `Job Title: ${item.title || ''}`,
                  `Company: ${item.hiringOrganization?.name || ''}`,
                  `Location: ${item.jobLocation?.address?.addressLocality || ''}, India`,
                  `Description: ${(item.description || '').replace(/<[^>]+>/g, ' ').slice(0, 2000)}`,
                  `Type: ${item.employmentType || 'Full-time'}`,
                  `Apply: ${jobUrl}`,
                ].join('\n');

                rawJobs.push({ rawText: text, sourceUrl: jobUrl, sourceName, structured: true });
              }
            }
          } catch { /* skip invalid */ }
        });

        await this.politeDelay();
      } catch (err) {
        console.error(`[GoogleJobs] ${url}: ${err.message}`);
        errors++;
      }
    }

    return { source: sourceName, urls: [], rawJobs, errors };
  }
}

module.exports = GoogleJobsScraper;
