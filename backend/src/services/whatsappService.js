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
 *  • QR tracking — current QR string stored in memory, cleared on connect.
 *  • Event logging — every connect/disconnect/logout event written to
 *    whatsapp_logs Supabase table (non-blocking, best-effort).
 *
 * Public API:
 *   initialize()           — connect and boot session (safe to call multiple times)
 *   destroy()              — clean shutdown
 *   logout(triggeredBy)    — log out session + clear auth files
 *   sendMessage(id, msg)   — send to any chat JID
 *   sendToGroup(msg)       — send to configured WHATSAPP_GROUP_ID
 *   sendToChannel(msg)     — send to configured WHATSAPP_CHANNEL_ID
 *   getAllChats()           — list groups (for JID discovery)
 *   getStatus()            — basic status object (existing callers)
 *   getDetailedStatus()    — full status with phone, timestamps, reason
 *   getQR()                — current QR string, null if connected/no QR
 */

const path      = require('path');
const fs        = require('fs');
const qrcode    = require('qrcode-terminal');
const QRCode    = require('qrcode');
const logger    = require('../utils/logger');
const config    = require('../config/whatsapp.config');

// ── Supabase service-role client for writing logs ─────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const _supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// ── Constants ─────────────────────────────────────────────────────────────────
const DEDUP_WINDOW_MS    = 5000;
const MIN_SEND_DELAY_MS  = 3000;
const MAX_SEND_DELAY_MS  = 8000;

// ── State enum ────────────────────────────────────────────────────────────────
const STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  NEEDS_REAUTH: 'needs_reauth',
};

function randomDelay() {
  const ms = MIN_SEND_DELAY_MS + Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS);
  return new Promise(r => setTimeout(r, Math.round(ms)));
}

// ── Lazy-load Baileys (ESM-only package) ─────────────────────────────────────
let _baileys = null;
async function getBaileys() {
  if (!_baileys) _baileys = await import('@whiskeysockets/baileys');
  return _baileys;
}

// ── Write a log entry to Supabase (non-blocking, best-effort) ─────────────────
async function _writeLog(eventType, { reason = null, phoneNumber = null, triggeredBy = 'system' } = {}) {
  try {
    await _supabase.from('whatsapp_logs').insert({
      event_type:   eventType,
      reason,
      phone_number: phoneNumber,
      triggered_by: triggeredBy,
    });
  } catch (err) {
    logger.warn('[WhatsApp] Failed to write log entry', { error: err.message });
  }
}

// ── Service class ─────────────────────────────────────────────────────────────

class WhatsAppService {
  constructor() {
    /** @type {import('@whiskeysockets/baileys').WASocket|null} */
    this.sock              = null;
    this.state             = STATE.DISCONNECTED;
    this.isInitialized     = false;
    this.reconnectAttempts = 0;

    // Status tracking
    this._phoneNumber        = null;
    this._lastConnectedAt    = null;
    this._lastDisconnectedAt = null;
    this._disconnectReason   = null;
    this._currentQR          = null;  // raw QR string from Baileys
    this._currentQRPng       = null;  // base64 PNG for the API

    // In-memory queue
    this._queue        = [];
    this._queueRunning = false;

    // Rate-limit
    this._rlCounter = 0;
    this._rlResetAt = Date.now() + config.rateLimit.windowMs;

    // Dedup
    this._dedupMap = new Map();

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

  // ── PUBLIC: logout ───────────────────────────────────────────────────────────

  async logout(triggeredBy = 'system') {
    logger.info('[WhatsApp] Logout requested', { triggeredBy });

    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (err) {
      logger.warn('[WhatsApp] Baileys logout error (continuing)', { error: err.message });
    }

    // Clear session files so next connect shows a fresh QR
    const authPath = path.resolve(config.authDataPath || './.baileys_auth_info');
    try {
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        logger.info('[WhatsApp] Auth files cleared');
      }
    } catch (err) {
      logger.warn('[WhatsApp] Could not clear auth files', { error: err.message });
    }

    // Update state
    this.sock              = null;
    this.state             = STATE.NEEDS_REAUTH;
    this.isInitialized     = false;
    this._currentQR        = null;
    this._currentQRPng     = null;
    this._disconnectReason = 'manual_logout';
    this._lastDisconnectedAt = new Date().toISOString();

    await _writeLog('logged_out', { triggeredBy, phoneNumber: this._phoneNumber });
    this._phoneNumber = null;

    // Restart immediately so a new QR code is generated for the admin panel
    this.initialize();
  }

  // ── PRIVATE: connect ─────────────────────────────────────────────────────────

  async _connect() {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      Browsers,
    } = await getBaileys();

    const { Boom } = await import('@hapi/boom');

    const authPath = path.resolve(config.authDataPath || './.baileys_auth_info');
    const { state: authState, saveCreds } = await useMultiFileAuthState(authPath);

    const { default: pino } = await import('pino');
    const silentLogger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      auth:                  authState,
      logger:                silentLogger,
      browser:               Browsers.ubuntu('Chrome'),
      connectTimeoutMs:      60000,
      defaultQueryTimeoutMs: 30000,
      keepAliveIntervalMs:   15000,
      printQRInTerminal:     false,
    });

    // ── Events ────────────────────────────────────────────────────────────────

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this._currentQR = qr;
        // Pre-render QR to base64 PNG for the API endpoint
        try {
          this._currentQRPng = await QRCode.toDataURL(qr, {
            width: 280, margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        } catch (e) {
          this._currentQRPng = null;
        }

        // Print to terminal (fallback for SSH access)
        console.log('\n' + '═'.repeat(60));
        console.log('  📱  SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE');
        console.log('═'.repeat(60) + '\n');
        qrcode.generate(qr, { small: true });
        console.log('\n' + '═'.repeat(60));
        console.log('  ⏳  Waiting for scan… (also visible in Admin Dashboard)');
        console.log('═'.repeat(60) + '\n');

        logger.info('[WhatsApp] QR code generated');
        await _writeLog('qr_generated');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : null;

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const reason = shouldReconnect ? `connection_lost (code: ${statusCode})` : 'logged_out_by_phone';

        logger.warn('[WhatsApp] Connection closed', { statusCode, shouldReconnect, reason });

        this.state               = shouldReconnect ? STATE.DISCONNECTED : STATE.NEEDS_REAUTH;
        this._disconnectReason   = reason;
        this._lastDisconnectedAt = new Date().toISOString();
        this._currentQR          = null;
        this._currentQRPng       = null;
        this.sock                = null;

        const eventType = statusCode === DisconnectReason.loggedOut ? 'logged_out' : 'disconnected';
        await _writeLog(eventType, { reason, phoneNumber: this._phoneNumber });

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('\n🔴  WhatsApp logged out from phone — admin must re-scan QR in dashboard.\n');
          this._phoneNumber = null;
          
          // Clear session files
          const authPath = path.resolve(config.authDataPath || './.baileys_auth_info');
          try {
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          } catch (err) {}

          this.isInitialized = false;
          // Restart socket to generate a new QR code immediately
          this.initialize();
          return;
        }

        if (config.autoReconnect) {
          this._scheduleReconnect();
        }
      }

      if (connection === 'open') {
        this.state             = STATE.CONNECTED;
        this.reconnectAttempts = 0;
        this._currentQR        = null;
        this._currentQRPng     = null;
        this._disconnectReason = null;
        this._lastConnectedAt  = new Date().toISOString();

        // Parse phone number from Baileys sock.user.id
        // Format: "919812345678:10@s.whatsapp.net" → "+919812345678"
        try {
          const rawId = this.sock?.user?.id || '';
          const digits = rawId.split(':')[0].split('@')[0];
          this._phoneNumber = digits ? `+${digits}` : null;
        } catch { this._phoneNumber = null; }

        logger.info('[WhatsApp] 🚀 Connected', { phone: this._phoneNumber });
        console.log(`\n✅  WhatsApp connected! Phone: ${this._phoneNumber || 'unknown'}\n`);

        await _writeLog('connected', { phoneNumber: this._phoneNumber });

        // Flush queued messages
        await this._processQueue();
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
  }

  // ── PUBLIC: sendMessage ──────────────────────────────────────────────────────

  async sendMessage(chatId, message) {
    if (!config.enabled) return { success: false, reason: 'WhatsApp disabled' };
    if (!chatId || !message) throw new Error('[WhatsApp] sendMessage: chatId and message are required');

    const dedupKey = `${chatId}::${message.substring(0, 80)}`;
    const dedupExp = this._dedupMap.get(dedupKey);
    if (dedupExp && Date.now() < dedupExp) {
      logger.warn('[WhatsApp] Duplicate suppressed', { chatId });
      return { success: false, reason: 'Duplicate suppressed' };
    }
    this._dedupMap.set(dedupKey, Date.now() + DEDUP_WINDOW_MS);

    if (!this._checkRateLimit()) return this._enqueue(chatId, message);
    if (this.state !== STATE.CONNECTED || !this.sock) return this._enqueue(chatId, message);

    return this._sendWithRetry(chatId, message);
  }

  async sendToGroup(message) {
    if (!config.groupId) {
      logger.warn('[WhatsApp] No WHATSAPP_GROUP_ID set');
      return { success: false, reason: 'No group ID configured' };
    }
    return this.sendMessage(config.groupId, message);
  }

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
    const groups = await this.sock.groupFetchAllParticipating();
    return Object.values(groups).map(g => ({
      id:          g.id,
      name:        g.subject || g.id,
      isGroup:     true,
      memberCount: g.participants?.length || 0,
    }));
  }

  // ── PUBLIC: getStatus (basic — keeps existing callers working) ───────────────

  getStatus() {
    return {
      enabled:           config.enabled,
      initialized:       this.isInitialized,
      ready:             this.state === STATE.CONNECTED,
      state:             this.state,
      queueLength:       this._queue.length,
      rateLimitCounter:  this._rlCounter,
      rateLimitResetsIn: Math.max(0, this._rlResetAt - Date.now()),
      reconnectAttempts: this.reconnectAttempts,
      groupConfigured:   !!config.groupId,
      channelConfigured: !!config.channelId,
    };
  }

  // ── PUBLIC: getDetailedStatus ────────────────────────────────────────────────

  getDetailedStatus() {
    const masked = this._maskPhone(this._phoneNumber);
    return {
      ...this.getStatus(),
      phoneNumber:         masked,
      lastConnectedAt:     this._lastConnectedAt,
      lastDisconnectedAt:  this._lastDisconnectedAt,
      disconnectReason:    this._disconnectReason,
      hasQR:               !!this._currentQR,
    };
  }

  // ── PUBLIC: getQR (returns base64 PNG or null) ────────────────────────────────

  getQR() {
    return this._currentQRPng || null;
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

  // ── PRIVATE: helpers ─────────────────────────────────────────────────────────

  _maskPhone(phone) {
    if (!phone) return null;
    // "+919812345678" → "+91 98XXXXXX78"
    try {
      const digits = phone.replace(/^\+/, '');
      if (digits.length < 6) return phone;
      const prefix  = digits.slice(0, 2);   // country code (approx)
      const last2   = digits.slice(-2);
      const masked  = 'X'.repeat(digits.length - 4);
      return `+${prefix} ${masked}${last2}`;
    } catch { return phone; }
  }

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

    _writeLog('reconnect_attempt', { reason: `attempt ${this.reconnectAttempts}` });

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.initialize();
    }, delay);
  }

  _checkRateLimit() {
    const now = Date.now();
    if (now >= this._rlResetAt) {
      this._rlCounter = 0;
      this._rlResetAt = now + config.rateLimit.windowMs;
    }
    return this._rlCounter < config.rateLimit.maxPerHour;
  }

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
        logger.error(`[WhatsApp] Send error (attempt ${attempt}/${max})`, { error: err.message, chatId });
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
