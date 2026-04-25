'use strict';
const Redis = require('ioredis');

let redis = null;

/**
 * Get Redis client (singleton, lazy init)
 * Falls back gracefully if Redis is unavailable
 * @returns {Redis|null}
 */
function getRedis() {
  if (redis) return redis;

  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      password:           process.env.REDIS_PASSWORD || undefined,
      retryStrategy:      (times) => Math.min(times * 200, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect:        true,
      enableOfflineQueue: false,
    });

    redis.on('connect',  () => console.log('[Redis] Connected'));
    redis.on('error',    (e) => console.warn('[Redis] Error:', e.message));
    redis.on('close',    () => console.warn('[Redis] Connection closed'));

    return redis;
  } catch (err) {
    console.warn('[Redis] Init failed:', err.message);
    return null;
  }
}

/**
 * Get cached value safely
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function cacheGet(key) {
  try {
    const r = getRedis();
    if (!r) return null;
    return await r.get(key);
  } catch { return null; }
}

/**
 * Set cached value safely
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds
 */
async function cacheSet(key, value, ttlSeconds = 3600) {
  try {
    const r = getRedis();
    if (!r) return;
    await r.set(key, value, 'EX', ttlSeconds);
  } catch (err) {
    console.warn('[Redis][cacheSet]', err.message);
  }
}

/**
 * Increment counter with expiry (for rate limiting)
 * @param {string} key
 * @param {number} ttlSeconds
 * @returns {Promise<number>}
 */
async function cacheIncr(key, ttlSeconds = 3600) {
  try {
    const r = getRedis();
    if (!r) return 0;
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, ttlSeconds);
    return count;
  } catch { return 0; }
}

module.exports = { getRedis, cacheGet, cacheSet, cacheIncr };
