'use strict';

/**
 * whatsappService.js
 * Singleton WhatsApp client built on Baileys (WebSocket, no headless browser).
 *
 * Key design decisions:
 *  • useMultiFileAuthState — session persists across restarts (no QR re-scan).
 *  • In-memory queue — messages sent while client is connecting are buffered
 *    and flushed automatically once the socket is open.
 *  • Randomised 3–8s inter-message delay for safety (reduces ban risk).
 *  • Rate-limit window — rolling 1-hour counter, excess messages are queued.
 *  • Idempotency guard — deduplicates identical (chatId + message) pairs
 *    within a 5-second window so a double-fire never posts twice.
 *
 * Public API (unchanged from previous whatsapp-web.js version):
 *   initialize()        — connect and boot session (safe to call multiple times)
 *   destroy()           — clean shutdown
 *   sendMessage(id, msg)— send to any chat JID
 *   sendToGroup(msg)    — send to configured WHATSAPP_GROUP_ID
 *   sendToChannel(msg)  — send to configured WHATSAPP_CHANNEL_ID
 *   getAllChats()        — list contacts/groups (for JID discovery)
 *   getStatus()         — return connection status object
 */

const path      = require('path');
const qrcode    = require('qrcode-terminal');
const logger    = require('../utils/logger');
const config    = require('../config/whatsapp.config');

// ── Dedup window (ms) ─────────────────────────────────────────────────────────
const DEDUP_WINDOW_MS    = 5000;
const MIN_SEND_DELAY_MS  = 3000;
const MAX_SEND_DELAY_MS  = 8000;

// ── Lazy-load Baileys (ESM module) ────────────────────────────────────────────
// Baileys is an ESM-only package. We use dynamic import() to use it from CJS.
let _baileys = null;
async function getBaileys() {
  if (!_baileys) {
    _baileys = await import('@whiskeysockets/baileys');
  }
  return _baileys;
}

function randomDelay() {
  const ms = MIN_SEND_DELAY_MS + Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS);
  return new Promise(r => setTimeout(r, Math.round(ms)));
}

// ── State enum ────────────────────────────────────────────────────────────────
const STATE = { DISCONNECTED: 'disconnected', CONNECTING: 'connecting', CONNECTED: 'connected', NEEDS_REAUTH: 'needs_reauth' };

class WhatsAppService {
  constructor() {
    /** @type {import('@whiskeysockets/baileys').WASocket|null} */
    this.sock              = null;
    this.state             = STATE.DISCONNECTED;
    this.isInitialized     = false;
    this.reconnectAttempts = 0;

    // In-memory queue: [{ chatId, message, resolve, reject }]
    this._queue       = [];
    this._queueRunning = false;

    // Rolling rate-limit counter
    this._rlCounter   = 0;
    this._rlResetAt   = Date.now() + config.rateLimit.windowMs;

    // Dedup map: key → expiry timestamp
    this._dedupMap    = new Map();

    // Reconnect timer
    this._reconnectTimer = null;
  }

  // ── PUBLIC: initialize ───────────────────────────────────────────────────────

  async initialize() {
    if (this.isInitialized) {
      logger.debug('[WhatsApp] Already initialised — skipping');
      return;
    }
    if (!config.enabled) {
      logger.info('[WhatsApp] Disabled via WHATSAPP_ENABLED env — skipping init');
      return;
    }

    logger.info('[WhatsApp] Initialising Baileys WhatsApp client…');
    this.state         = STATE.CONNECTING;
    this.isInitialized = true;

    try {
      await this._connect();
    } catch (err) {
      logger.error('[WhatsApp] Initialisation error', { error: err.message });
      this.isInitialized = false;
      this.state         = STATE.DISCONNECTED;
      this._scheduleReconnect();
    }
  }

  // ── PRIVATE: connect ─────────────────────────────────────────────────────────

  async _connect() {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      Browsers,
      makeInMemoryStore,
    } = await getBaileys();

    const { Boom }  = await import('@hapi/boom');

    const authPath  = path.resolve(config.authDataPath || './.baileys_auth_info');
    const { state: authState, saveCreds } = await useMultiFileAuthState(authPath);

    // Suppress verbose Baileys/pino logs — only let our own logger through
    const { default: pino } = await import('pino');
    const silentLogger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      auth:             authState,
      logger:           silentLogger,
      browser:          Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 30000,
      // Keep-alive pings
      keepAliveIntervalMs: 15000,
      // Print QR to terminal
      printQRInTerminal: false,
    });

    // ── Events ────────────────────────────────────────────────────────────────

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Show a human-friendly QR in the terminal
        console.log('\n' + '═'.repeat(60));
        console.log('  📱  SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE');
        console.log('═'.repeat(60) + '\n');
        qrcode.generate(qr, { small: true });
        console.log('\n' + '═'.repeat(60));
        console.log('  ⏳  Waiting for scan…');
        console.log('═'.repeat(60) + '\n');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : null;

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn('[WhatsApp] Connection closed', { statusCode, shouldReconnect });
        this.state = shouldReconnect ? STATE.DISCONNECTED : STATE.NEEDS_REAUTH;
        this.sock  = null;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('\n🔴  WhatsApp logged out — delete the auth folder and restart to re-scan QR.\n');
          logger.error('[WhatsApp] Logged out — manual re-auth required');
          return; // do NOT auto-reconnect after a logout
        }

        if (config.autoReconnect) {
          this._scheduleReconnect();
        }
      }

      if (connection === 'open') {
        this.state             = STATE.CONNECTED;
        this.reconnectAttempts = 0;
        logger.info('[WhatsApp] 🚀 Connected and ready');
        console.log('\n✅  WhatsApp connected!\n');
        // Flush any queued messages
        await this._processQueue();
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
  }

  // ── PUBLIC: sendMessage ──────────────────────────────────────────────────────

  async sendMessage(chatId, message) {
    if (!config.enabled) {
      return { success: false, reason: 'WhatsApp disabled' };
    }
    if (!chatId || !message) {
      throw new Error('[WhatsApp] sendMessage: chatId and message are required');
    }

    // Dedup
    const dedupKey = `${chatId}::${message.substring(0, 80)}`;
    const dedupExp = this._dedupMap.get(dedupKey);
    if (dedupExp && Date.now() < dedupExp) {
      logger.warn('[WhatsApp] Duplicate suppressed', { chatId });
      return { success: false, reason: 'Duplicate suppressed' };
    }
    this._dedupMap.set(dedupKey, Date.now() + DEDUP_WINDOW_MS);

    // Rate limit
    if (!this._checkRateLimit()) {
      return this._enqueue(chatId, message);
    }

    // Not ready — queue it
    if (this.state !== STATE.CONNECTED || !this.sock) {
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

  async getAllChats() {
    if (this.state !== STATE.CONNECTED || !this.sock) {
      throw new Error('[WhatsApp] Client is not connected — cannot fetch chats');
    }
    // Baileys doesn't have a direct "get all chats" — return contact/group roster
    const groups = await this.sock.groupFetchAllParticipating();
    return Object.values(groups).map(g => ({
      id:         g.id,
      name:       g.subject || g.id,
      isGroup:    true,
      memberCount: g.participants?.length || 0,
    }));
  }

  // ── PUBLIC: getStatus ────────────────────────────────────────────────────────

  getStatus() {
    return {
      enabled:           config.enabled,
      initialized:       this.isInitialized,
      state:             this.state,
      ready:             this.state === STATE.CONNECTED,
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
    if (this.sock) {
      logger.info('[WhatsApp] Shutting down Baileys socket…');
      try { this.sock.end(); } catch { /* best-effort */ }
      this.sock          = null;
      this.state         = STATE.DISCONNECTED;
      this.isInitialized = false;
      logger.info('[WhatsApp] Socket destroyed');
    }
  }

  // ── PRIVATE: reconnect ───────────────────────────────────────────────────────

  _scheduleReconnect() {
    if (this.reconnectAttempts >= config.maxReconnectAttempts) {
      logger.error('[WhatsApp] Max reconnect attempts reached — giving up');
      this.state = STATE.NEEDS_REAUTH;
      return;
    }
    this.reconnectAttempts++;
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

    logger.info(`[WhatsApp] Flushing ${this._queue.length} queued message(s)…`);

    while (this._queue.length > 0 && this.state === STATE.CONNECTED) {
      const { chatId, message, resolve, reject } = this._queue.shift();
      try {
        const result = await this._sendWithRetry(chatId, message);
        resolve(result);
      } catch (err) {
        reject(err);
      }
      await randomDelay();
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

        await this.sock.sendMessage(chatId, { text: message });
        this._rlCounter++;

        logger.info('[WhatsApp] ✅ Sent', { chatId });
        return { success: true, chatId, timestamp: Date.now() };

      } catch (err) {
        logger.error(`[WhatsApp] Send error (attempt ${attempt}/${max})`, {
          error: err.message, chatId,
        });

        if (attempt < max) {
          await new Promise(r => setTimeout(r, config.retry.delayMs));
        } else {
          throw err;
        }
      }
    }
  }
}

// ── Export singleton ──────────────────────────────────────────────────────────

module.exports = new WhatsAppService();
