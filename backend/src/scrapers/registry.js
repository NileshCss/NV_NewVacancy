'use strict';

/**
 * registry.js
 * Auto-discovers and loads all scraper plugins from plugins/ directory.
 *
 * Usage:
 *   const registry = require('./registry');
 *   const scrapers = registry.getAll();          // returns all enabled scrapers
 *   const scraper  = registry.get('freshersworld');
 */

const fs   = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, 'plugins');

// Plugin registry: { sourceName: scraperInstance }
const _registry = new Map();
let _loaded = false;

function _load() {
  if (_loaded) return;
  _loaded = true;

  if (!fs.existsSync(PLUGINS_DIR)) {
    console.warn('[ScraperRegistry] plugins/ directory not found');
    return;
  }

  const files = fs.readdirSync(PLUGINS_DIR)
    .filter(f => f.endsWith('.scraper.js'));

  for (const file of files) {
    try {
      const PluginClass = require(path.join(PLUGINS_DIR, file));
      const instance    = new PluginClass();
      const sourceName  = instance.getSourceName();
      _registry.set(sourceName, instance);
      console.log(`[ScraperRegistry] Loaded: ${sourceName} (${file})`);
    } catch (err) {
      console.error(`[ScraperRegistry] Failed to load ${file}: ${err.message}`);
    }
  }

  console.log(`[ScraperRegistry] ${_registry.size} plugins loaded.`);
}

const registry = {
  /** Get a specific scraper by source name */
  get(sourceName) {
    _load();
    return _registry.get(sourceName) || null;
  },

  /** Get all registered scrapers */
  getAll() {
    _load();
    return Array.from(_registry.values());
  },

  /** Get all source names */
  getNames() {
    _load();
    return Array.from(_registry.keys());
  },

  /** Check if a source is registered */
  has(sourceName) {
    _load();
    return _registry.has(sourceName);
  },
};

module.exports = registry;
