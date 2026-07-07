'use strict';

/**
 * telegram.service.js
 * Sends messages to a Telegram channel via Bot API.
 *
 * Config (.env):
 *   TELEGRAM_BOT_TOKEN  = bot token from @BotFather
 *   TELEGRAM_CHANNEL_ID = @channelusername or -100xxxxxxxxx (chat_id)
 *
 * Non-blocking — never throws. Logs failures to console.
 */

const axios = require('axios');

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const SITE_URL   = process.env.SITE_URL || 'https://www.newvacancy.live';

function isConfigured() {
  return Boolean(BOT_TOKEN && CHANNEL_ID);
}

/**
 * Send a Telegram message.
 * @param {string} text         Message text (HTML or Markdown)
 * @param {object} [opts]       Extra options (parse_mode, disable_web_page_preview, etc.)
 * @param {string} [chatId]     Override channel (default: TELEGRAM_CHANNEL_ID)
 * @returns {Promise<boolean>}  true if sent, false if failed
 */
async function sendTelegramMessage(text, opts = {}, chatId = null) {
  if (!isConfigured()) {
    console.info('[Telegram] Not configured — skipping (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID)');
    return false;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id:    chatId || CHANNEL_ID,
      text:       text.slice(0, 4096), // Telegram max message length
      parse_mode: opts.parse_mode || 'HTML',
      disable_web_page_preview: opts.disable_web_page_preview ?? false,
      ...opts,
    }, { timeout: 10000 });

    return true;

  } catch (err) {
    const detail = err.response?.data?.description || err.message;
    console.error('[Telegram] Failed to send message:', detail);
    return false;
  }
}

/**
 * Format and send a job notification to the Telegram channel.
 * @param {object} job  - Job record from DB
 * @param {'new'|'updated'} [action]
 * @returns {Promise<boolean>}
 */
async function notifyJobTelegram(job, action = 'new') {
  if (!isConfigured()) return false;

  const {
    title, organization, location, salary_range,
    qualification, employment_type, work_mode,
    apply_url, slug, last_date,
  } = job;

  const jobUrl    = slug ? `${SITE_URL}/jobs/${slug}` : apply_url || SITE_URL;
  const isUpdate  = action === 'updated';
  const emoji     = isUpdate ? '🔄' : '🔥';
  const header    = isUpdate ? 'JOB UPDATED' : 'NEW JOB VACANCY';

  const lastDate  = last_date
    ? new Date(last_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Open';

  let msg = `${emoji} <b>${header}</b> ${emoji}\n\n`;
  if (title)          msg += `📌 <b>${title}</b>\n`;
  if (organization)   msg += `🏢 ${organization}\n`;
  if (location)       msg += `📍 ${location}\n`;
  if (salary_range)   msg += `💰 ${salary_range}\n`;
  if (qualification)  msg += `🎓 ${qualification}\n`;
  if (employment_type) msg += `💼 ${employment_type}`;
  if (work_mode && work_mode !== 'Office') msg += ` (${work_mode})`;
  msg += `\n`;
  msg += `⏳ Last Date: <b>${lastDate}</b>\n\n`;
  msg += `👉 <a href="${jobUrl}">Apply Now</a>\n`;
  msg += `🌐 <a href="${SITE_URL}">${SITE_URL}</a>`;

  return sendTelegramMessage(msg, { parse_mode: 'HTML' });
}

module.exports = { sendTelegramMessage, notifyJobTelegram, isConfigured };
