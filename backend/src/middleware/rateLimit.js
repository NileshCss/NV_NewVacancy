'use strict';
const { cacheIncr } = require('../config/redis');

const LIMIT = parseInt(process.env.RATE_LIMIT_ANALYSES_PER_HOUR || '10', 10);

/**
 * Rate limiter for resume analysis endpoint
 * Allows LIMIT analyses per user per hour
 */
async function analysisRateLimit(req, res, next) {
  try {
    const userId = req.user?.id || req.ip;
    const key    = `rl:analysis:${userId}`;
    const count  = await cacheIncr(key, 3600);

    res.setHeader('X-RateLimit-Limit',     LIMIT);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, LIMIT - count));

    if (count > LIMIT) {
      return res.status(429).json({
        success: false,
        error:   `Rate limit exceeded. Max ${LIMIT} analyses per hour.`,
        code:    'RATE_LIMIT_EXCEEDED',
        retryAfter: '1 hour',
      });
    }
    next();
  } catch (err) {
    // If Redis is down, allow the request through
    console.warn('[RateLimit] Check failed, allowing through:', err.message);
    next();
  }
}

module.exports = { analysisRateLimit };
