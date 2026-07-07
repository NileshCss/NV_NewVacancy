'use strict';

/**
 * sitemap.js
 * Dynamic sitemap.xml + robots.txt routes.
 * Mounted at root: app.use('/', sitemapRoutes)
 */

const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { generateSitemapEntry, SITE_URL } = require('../services/seo.service');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// Cache sitemap for 1 hour
let sitemapCache = null;
let sitemapCachedAt = 0;
const CACHE_TTL = 60 * 60 * 1000;

// GET /sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Return cached if fresh
    if (sitemapCache && Date.now() - sitemapCachedAt < CACHE_TTL) {
      res.set('Content-Type', 'application/xml');
      return res.send(sitemapCache);
    }

    // Fetch all published job slugs
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('slug, updated_at')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10000);

    if (error) throw error;

    const staticPages = [
      `\n  <url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `\n  <url><loc>${SITE_URL}/jobs</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>`,
      `\n  <url><loc>${SITE_URL}/govt-jobs</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
      `\n  <url><loc>${SITE_URL}/walk-ins</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`,
      `\n  <url><loc>${SITE_URL}/internships</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    ].join('');

    const jobUrls = (jobs || [])
      .map(j => `\n  ${generateSitemapEntry(j.slug, j.updated_at)}`)
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages}
${jobUrls}
</urlset>`;

    sitemapCache    = xml;
    sitemapCachedAt = Date.now();

    res.set('Content-Type', 'application/xml');
    res.send(xml);

  } catch (err) {
    console.error('[Sitemap] error:', err.message);
    res.status(500).send('<!-- sitemap generation failed -->');
  }
});

// GET /robots.txt
router.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

module.exports = router;
