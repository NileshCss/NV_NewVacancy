'use strict';

/**
 * whatsappService.js
 * Singleton WhatsApp Web client built on whatsapp-web.js.
 *
 * Key design decisions:
 *  • LocalAuth  — session persists across restarts (no QR re-scan).
 *  • In-memory queue — messages sent while client is booting are buffered
 *    and flushed automatically once the client is ready.
 *  • Linear back-off reconnect — avoids thundering-herd on flaky networks.
 *  • Rate-limit window — rolling 1-hour counter, excess messages are queued.
 *  • idempotency guard — deduplicates identical (chatId + message) pairs
 *    within a 5-second window so a double-fire never posts twice.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode  = require('qrcode-terminal');
const logger  = require('../utils/logger');
const config  = require('../config/whatsapp.config');

// ── Dedup window (ms) ─────────────────────────────────────────────────────────
const DEDUP_WINDOW_MS = 5000;

class WhatsAppService {
  constructor() {
    /** @type {Client|null} */
    this.client            = null;
    this.isReady           = false;
    this.isInitialized     = false;
    this.reconnectAttempts = 0;

    // In-memory queue: [{ chatId, message, resolve, reject }]
    this._queue = [];

    // Rolling rate-limit counter
    this._rlCounter   = 0;
    this._rlResetAt   = Date.now() + config.rateLimit.windowMs;

    // Dedup map: key → expiry timestamp
    this._dedupMap = new Map();

    // Flag so _processQueue doesn't run twice concurrently
    this._queueRunning = false;

    // Reconnect timer reference (so we can clear it on destroy)
    this._reconnectTimer = null;
  }

  // ── PUBLIC: initialize ───────────────────────────────────────────────────────

  /**
   * Boot the WhatsApp Web client.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async initialize() {
    if (this.isInitialized) {
      logger.debug('[WhatsApp] Already initialised — skipping');
      return;
    }
    if (!config.enabled) {
      logger.info('[WhatsApp] Disabled via WHATSAPP_ENABLED env — skipping init');
      return;
    }

    logger.info('[WhatsApp] Initialising WhatsApp Web client…');

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: config.clientId,
          dataPath:  config.authDataPath,
        }),
        puppeteer: config.puppeteer,
      });

      this._attachEventHandlers();
      this.isInitialized = true;

      // initialize() is async but fires events; we kick it off and let events drive state
      await this.client.initialize();
    } catch (err) {
      logger.error('[WhatsApp] Initialisation error', { error: err.message });
      this.isInitialized = false;
      this._scheduleReconnect();
    }
  }

  // ── PUBLIC: sendMessage ──────────────────────────────────────────────────────

  /**
   * Send a message to any chat by ID.
   * If the client isn't ready yet, the message is queued.
   *
   * @param {string} chatId  – e.g. "120363027XXXXX@g.us"
   * @param {string} message – plain text (supports WhatsApp markdown: *bold*, _italic_)
   * @returns {Promise<{success:boolean, messageId?:string, reason?:string}>}
   */
  async sendMessage(chatId, message) {
    if (!config.enabled) {
      return { success: false, reason: 'WhatsApp disabled' };
    }
    if (!chatId || !message) {
      throw new Error('[WhatsApp] sendMessage: chatId and message are required');
    }

    // ── Deduplication ────────────────────────────────────────────────────────
    const dedupKey = `${chatId}::${message.substring(0, 80)}`;
    const dedupExp = this._dedupMap.get(dedupKey);
    if (dedupExp && Date.now() < dedupExp) {
      logger.warn('[WhatsApp] Duplicate message suppressed within dedup window', { chatId });
      return { success: false, reason: 'Duplicate suppressed' };
    }
    this._dedupMap.set(dedupKey, Date.now() + DEDUP_WINDOW_MS);

    // ── Rate-limit check ─────────────────────────────────────────────────────
    if (!this._checkRateLimit()) {
      logger.warn('[WhatsApp] Rate limit reached — queueing message', { chatId });
      return this._enqueue(chatId, message);
    }

    // ── Client readiness ─────────────────────────────────────────────────────
    if (!this.isReady) {
      logger.warn('[WhatsApp] Client not ready — queueing message', { chatId });
      return this._enqueue(chatId, message);
    }

    return this._sendWithRetry(chatId, message);
  }

  /** Convenience: send to configured group */
  async sendToGroup(message) {
    if (!config.groupId) {
      logger.warn('[WhatsApp] No WHATSAPP_GROUP_ID set');
      return { success: false, reason: 'No group ID configured' };
    }
    return this.sendMessage(config.groupId, message);
  }

  /** Convenience: send to configured channel */
  async sendToChannel(message) {
    if (!config.channelId) {
      logger.warn('[WhatsApp] No WHATSAPP_CHANNEL_ID set');
      return { success: false, reason: 'No channel ID configured' };
    }
    return this.sendMessage(config.channelId, message);
  }

  // ── PUBLIC: getAllChats ──────────────────────────────────────────────────────

  /**
   * Retrieve all chats the connected number is part of.
   * Useful for discovering the group/channel ID at setup time.
   * @returns {Promise<Array>}
   */
  async getAllChats() {
    if (!this.isReady) {
      throw new Error('[WhatsApp] Client is not ready — cannot fetch chats');
    }
    const chats = await this.client.getChats();
    const list = chats.map(c => ({
      id:         c.id._serialized,
      name:       c.name,
      isGroup:    c.isGroup,
      isReadOnly: c.isReadOnly,
      unread:     c.unreadCount,
    }));
    logger.info(`[WhatsApp] Retrieved ${list.length} chats`);
    return list;
  }

  // ── PUBLIC: getStatus ────────────────────────────────────────────────────────

  getStatus() {
    return {
      enabled:           config.enabled,
      initialized:       this.isInitialized,
      ready:             this.isReady,
      queueLength:       this._queue.length,
      rateLimitCounter:  this._rlCounter,
      rateLimitResetsIn: Math.max(0, this._rlResetAt - Date.now()),
      reconnectAttempts: this.reconnectAttempts,
      groupConfigured:   !!config.groupId,
      channelConfigured: !!config.channelId,
    };
  }

  // ── PUBLIC: destroy ──────────────────────────────────────────────────────────

  async destroy() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.client) {
      logger.info('[WhatsApp] Shutting down client…');
      try { await this.client.destroy(); } catch { /* best-effort */ }
      this.isReady       = false;
      this.isInitialized = false;
      this.client        = null;
      logger.info('[WhatsApp] Client destroyed');
    }
  }

  // ── PRIVATE: event handlers ──────────────────────────────────────────────────

  _attachEventHandlers() {
    const c = this.client;

    c.on('qr', (qr) => {
      logger.info('[WhatsApp] QR received — scan with your phone');
      console.log('\n' + '═'.repeat(56));
      console.log('  📱  SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE  ');
      console.log('═'.repeat(56) + '\n');
      qrcode.generate(qr, { small: true });
      console.log('\n' + '═'.repeat(56));
      console.log('  ⏳  Waiting for authentication…');
      console.log('═'.repeat(56) + '\n');
    });

    c.on('authenticated', () => {
      logger.info('[WhatsApp] ✅ Authenticated — session saved');
      console.log('\n✅  WhatsApp authenticated successfully!\n');
    });

    c.on('auth_failure', (msg) => {
      logger.error('[WhatsApp] ❌ Auth failure', { msg });
      console.log('\n❌  WhatsApp auth failed. Delete .wwebjs_auth/ and restart.\n');
      this._scheduleReconnect();
    });

    c.on('ready', async () => {
      this.isReady           = true;
      this.reconnectAttempts = 0;
      logger.info('[WhatsApp] 🚀 Client ready');

      try {
        const info = this.client.info;
        if (info) {
          logger.info('[WhatsApp] Connected', {
            number: info.wid.user,
            name:   info.pushname,
          });
          console.log(`\n🚀  WhatsApp ready — ${info.pushname} (${info.wid.user})\n`);
        }
      } catch { /* info may be unavailable on some versions */ }

      // Flush any messages that arrived before the client was ready
      await this._processQueue();
    });

    c.on('disconnected', (reason) => {
      this.isReady = false;
      logger.warn('[WhatsApp] Disconnected', { reason });
      console.log(`\n⚠️   WhatsApp disconnected: ${reason}\n`);
      if (config.autoReconnect) {
        this._scheduleReconnect();
      }
    });

    // Handle Puppeteer page crash — triggers on 'detached Frame' scenario
    // pupPage is a Promise, use .then() since this method is not async
    Promise.resolve(c.pupPage).then(page => {
      if (page) {
        page.on('crash', () => {
          logger.error('[WhatsApp] Puppeteer page crashed — scheduling heal');
          this._healClient();
        });
      }
    }).catch(() => { /* pupPage unavailable at attach time — harmless */ });
  }

  // ── PRIVATE: heal client after detached Frame / page crash ────────────────

  async _healClient() {
    if (this._healing) return;          // prevent concurrent heals
    this._healing = true;
    logger.warn('[WhatsApp] 🔧 Healing client (detached Frame detected)…');
    this.isReady       = false;
    this.isInitialized = false;
    try {
      if (this.client) {
        try { await this.client.destroy(); } catch { /* best-effort */ }
        this.client = null;
      }
    } finally {
      this._healing = false;
      this._scheduleReconnect();
    }
  }

  // ── PRIVATE: reconnect ───────────────────────────────────────────────────────

  _scheduleReconnect() {
    if (this.reconnectAttempts >= config.maxReconnectAttempts) {
      logger.error('[WhatsApp] Max reconnect attempts reached — giving up');
      return;
    }
    this.reconnectAttempts++;
    // Reset so initialize() will run again
    this.isInitialized = false;

    const delay = config.reconnectDelay * this.reconnectAttempts;
    logger.info(`[WhatsApp] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${config.maxReconnectAttempts})`);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.initialize();
    }, delay);
  }

  // ── PRIVATE: rate-limit ──────────────────────────────────────────────────────

  _checkRateLimit() {
    const now = Date.now();
    if (now >= this._rlResetAt) {
      this._rlCounter = 0;
      this._rlResetAt = now + config.rateLimit.windowMs;
    }
    return this._rlCounter < config.rateLimit.maxPerHour;
  }

  // ── PRIVATE: queue ───────────────────────────────────────────────────────────

  _enqueue(chatId, message) {
    return new Promise((resolve, reject) => {
      if (this._queue.length >= config.queue.maxSize) {
        // Drop the oldest entry to make room
        const dropped = this._queue.shift();
        dropped?.reject(new Error('Queue overflow — message dropped'));
        logger.warn('[WhatsApp] Queue overflow — oldest message dropped');
      }
      this._queue.push({ chatId, message, resolve, reject });
      logger.debug(`[WhatsApp] Queued (${this._queue.length} pending)`);
    });
  }

  async _processQueue() {
    if (this._queueRunning || this._queue.length === 0) return;
    this._queueRunning = true;

    logger.info(`[WhatsApp] Processing ${this._queue.length} queued message(s)…`);

    while (this._queue.length > 0 && this.isReady) {
      const { chatId, message, resolve, reject } = this._queue.shift();
      try {
        const result = await this._sendWithRetry(chatId, message);
        resolve(result);
      } catch (err) {
        reject(err);
      }
      // Throttle between queued sends
      await _sleep(config.queue.interMessageMs);
    }

    this._queueRunning = false;
  }

  // ── PRIVATE: send with retry ─────────────────────────────────────────────────

  async _sendWithRetry(chatId, message) {
    const max = config.retry.enabled ? config.retry.maxAttempts : 1;

    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        logger.info(`[WhatsApp] Sending (attempt ${attempt}/${max})`, {
          chatId,
          preview: message.substring(0, 60).replace(/\n/g, ' ') + '…',
        });

        const sent = await this.client.sendMessage(chatId, message);
        this._rlCounter++;

        logger.info('[WhatsApp] ✅ Sent', {
          chatId,
          messageId: sent.id._serialized,
        });

        return { success: true, messageId: sent.id._serialized, timestamp: sent.timestamp };

      } catch (err) {
        const isDetachedFrame = err.message && (
          err.message.includes('detached Frame') ||
          err.message.includes('detached frame') ||
          err.message.includes('Target closed') ||
          err.message.includes('Session closed')
        );

        logger.error(`[WhatsApp] Send error (attempt ${attempt}/${max})`, {
          error:  err.message,
          chatId,
          isDetachedFrame,
        });

        // ── Detached Frame: heal client immediately, then re-queue message ──
        if (isDetachedFrame) {
          logger.warn('[WhatsApp] Detached Frame detected — healing client and re-queuing message');
          this._healClient();  // async, non-blocking
          // Re-queue the message so it sends once client recovers
          return this._enqueue(chatId, message);
        }

        if (attempt < max) {
          await _sleep(config.retry.delayMs);
        } else {
          throw err;
        }
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Export singleton ──────────────────────────────────────────────────────────

module.exports = new WhatsAppService();
