'use strict';

/**
 * whatsapp.config.js
 * Central configuration for all WhatsApp-related settings.
 * All values are read from environment variables so no secret
 * ever lives in source code.
 */

module.exports = {
  // ── Global toggle ──────────────────────────────────────────────────────────
  enabled: process.env.WHATSAPP_ENABLED === 'true',

  // ── Targets ────────────────────────────────────────────────────────────────
  // Format: 120363XXXXXXXXXX@g.us   (group)
  //         120363XXXXXXXXXX@newsletter  (channel/newsletter)
  groupId:   process.env.WHATSAPP_GROUP_ID   || '',
  channelId: process.env.WHATSAPP_CHANNEL_ID || '',

  // ── Puppeteer / Client options ─────────────────────────────────────────────
  puppeteer: {
    headless:        true,
    // Explicit Chromium path — auto-detected from puppeteer cache
    executablePath: (() => {
      try { return require('puppeteer').executablePath(); } catch { return undefined; }
    })(),
    protocolTimeout: 120000,  // 2 min — fixes "Runtime.callFunctionOn timed out"
    timeout:         120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--disable-background-networking',
    ],
  },

  // ── Auth timeout ───────────────────────────────────────────────────────────
  authTimeoutMs: 120000,


  // ── Auth ───────────────────────────────────────────────────────────────────
  authDataPath: process.env.WHATSAPP_AUTH_PATH || './.wwebjs_auth',
  clientId:     'newvacancy-bot',

  // ── Auto-reconnect ─────────────────────────────────────────────────────────
  autoReconnect:       process.env.WHATSAPP_AUTO_RECONNECT !== 'false', // default true
  reconnectDelay:      5000,   // ms — multiplied by attempt number (linear backoff)
  maxReconnectAttempts: 10,

  // ── Rate-limit (messages per rolling hour) ─────────────────────────────────
  rateLimit: {
    maxPerHour: parseInt(process.env.MAX_MESSAGES_PER_HOUR || '20', 10),
    windowMs:   60 * 60 * 1000,
  },

  // ── Retry on send failure ──────────────────────────────────────────────────
  retry: {
    enabled:     true,
    maxAttempts: 3,
    delayMs:     2000,
  },

  // ── In-flight queue settings ───────────────────────────────────────────────
  queue: {
    maxSize:         100,   // drop oldest if queue exceeds this
    interMessageMs:  1200,  // delay between queued sends
  },
};
