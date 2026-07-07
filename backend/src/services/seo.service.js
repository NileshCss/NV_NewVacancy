'use strict';

/**
 * seo.service.js
 * Generates all SEO metadata for a job posting at publish time.
 *
 * Generates:
 *  - meta_title
 *  - meta_description
 *  - keywords (array)
 *  - canonical_url
 *  - json_ld (JSON-LD JobPosting schema)
 *  - og_tags object (for admin reference)
 */

const SITE_URL  = process.env.SITE_URL  || 'https://www.newvacancy.live';
const SITE_NAME = 'NewVacancy';

/**
 * Generate all SEO metadata for a job.
 *
 * @param {object} jobData  - Extracted + merged job data
 * @param {string} slug     - Generated unique slug
 * @returns {object}        - SEO fields ready to merge into DB payload
 */
function generateSeoFields(jobData, slug) {
  const {
    jobTitle     = 'Job Opening',
    company      = 'Top Company',
    location     = 'India',
    salary       = null,
    qualification = null,
    batch         = null,
    skills        = [],
    description   = '',
    employmentType = 'Full-time',
    deadline      = null,
  } = jobData;

  const canonicalUrl = `${SITE_URL}/jobs/${slug}`;

  // ── Meta Title (max 60 chars) ─────────────────────────────────────────────
  const titleParts = [jobTitle, company, location].filter(Boolean);
  let metaTitle = titleParts.join(' | ');
  if (metaTitle.length > 60) {
    metaTitle = `${jobTitle} at ${company} | ${SITE_NAME}`;
  }
  if (metaTitle.length > 60) {
    metaTitle = `${jobTitle} | ${SITE_NAME}`;
  }

  // ── Meta Description (max 160 chars) ──────────────────────────────────────
  const descParts = [`Apply for ${jobTitle} at ${company} in ${location}.`];
  if (salary) descParts.push(`Salary: ${salary}.`);
  if (qualification) descParts.push(`Qualification: ${qualification}.`);
  if (batch) descParts.push(`Batch: ${batch}.`);
  descParts.push(`Apply now on ${SITE_NAME}!`);

  let metaDescription = descParts.join(' ');
  if (metaDescription.length > 160) {
    metaDescription = metaDescription.slice(0, 157) + '…';
  }

  // ── Keywords ──────────────────────────────────────────────────────────────
  const keywordSet = new Set([
    jobTitle.toLowerCase(),
    company.toLowerCase(),
    location.toLowerCase(),
    'fresher jobs',
    'fresher vacancy',
    'job vacancy 2024',
    `${jobTitle.toLowerCase()} jobs`,
    `${company.toLowerCase()} careers`,
    `jobs in ${location.toLowerCase()}`,
  ]);

  // Add skills as keywords
  skills.slice(0, 8).forEach(s => keywordSet.add(s.toLowerCase()));
  if (qualification) keywordSet.add(qualification.toLowerCase());

  const keywords = Array.from(keywordSet).slice(0, 15);

  // ── JSON-LD JobPosting Schema ─────────────────────────────────────────────
  const jsonLd = {
    '@context':       'https://schema.org',
    '@type':          'JobPosting',
    'title':          jobTitle,
    'description':    description || `${jobTitle} opening at ${company}. Apply now.`,
    'datePosted':     new Date().toISOString().split('T')[0],
    'employmentType': mapEmploymentType(employmentType),
    'hiringOrganization': {
      '@type': 'Organization',
      'name':  company,
    },
    'jobLocation': {
      '@type':   'Place',
      'address': {
        '@type':          'PostalAddress',
        'addressLocality': location,
        'addressCountry':  'IN',
      },
    },
    'url': canonicalUrl,
  };

  if (salary) jsonLd['baseSalary'] = { '@type': 'MonetaryAmount', 'currency': 'INR', 'value': salary };
  if (deadline) jsonLd['validThrough'] = new Date(deadline).toISOString();
  if (qualification) jsonLd['qualifications'] = qualification;

  return {
    meta_title:       metaTitle,
    meta_description: metaDescription,
    keywords,
    canonical_url:    canonicalUrl,
    json_ld:          jsonLd,
  };
}

/**
 * Map internal employment type to Schema.org vocabulary.
 */
function mapEmploymentType(type) {
  const map = {
    'Full-time':  'FULL_TIME',
    'Part-time':  'PART_TIME',
    'Contract':   'CONTRACTOR',
    'Internship': 'INTERN',
    'Freelance':  'OTHER',
    'Walk-in':    'FULL_TIME',
  };
  return map[type] || 'FULL_TIME';
}

/**
 * Generate dynamic sitemap entry for a single job.
 */
function generateSitemapEntry(slug, updatedAt) {
  return `
  <url>
    <loc>${SITE_URL}/jobs/${slug}</loc>
    <lastmod>${new Date(updatedAt || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`.trim();
}

module.exports = { generateSeoFields, generateSitemapEntry, SITE_URL };
