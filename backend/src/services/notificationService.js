'use strict';

/**
 * notificationService.js
 * Formats job data from Supabase into WhatsApp messages and dispatches them.
 *
 * Integration model (matches this project's Supabase architecture):
 *   Admin creates / updates job → Supabase → frontend calls POST /api/whatsapp/notify-job
 *   → notificationService.notifyJob(jobData) → whatsappService.sendMessage()
 *
 * notifyJob() NEVER throws — it logs and returns {success,results} so a
 * WhatsApp failure can never break the admin job-creation flow.
 */

const whatsapp = require('./whatsappService');
const logger   = require('../utils/logger');
const config   = require('../config/whatsapp.config');

class NotificationService {

  // ── PUBLIC: notifyJob ──────────────────────────────────────────────────────

  /**
   * Send a formatted job notification to all configured WhatsApp targets.
   *
   * @param {object} job    – Job record (fields mirror the Supabase jobs table)
   * @param {'new'|'updated'} action
   * @returns {Promise<{success:boolean, skipped?:boolean, results?:Array, error?:string}>}
   */
  async notifyJob(job, action = 'new') {
    if (!config.enabled) {
      logger.info('[Notification] WhatsApp disabled — notification skipped');
      return { success: true, skipped: true, reason: 'disabled' };
    }

    try {
      logger.info('[Notification] Preparing job notification', {
        jobId:  job.id || job._id,
        action,
        title:  job.title,
      });

      const message = this._formatJobMessage(job, action);
      const targets = this._resolveTargets();

      if (targets.length === 0) {
        logger.warn('[Notification] No WhatsApp targets configured (set WHATSAPP_GROUP_ID or WHATSAPP_CHANNEL_ID)');
        return { success: false, reason: 'No targets configured' };
      }

      const results = [];

      for (const target of targets) {
        try {
          logger.info(`[Notification] Sending to ${target.type}: ${target.id}`);
          const res = await whatsapp.sendMessage(target.id, message);
          results.push({ target: target.type, ...res });
        } catch (err) {
          logger.error(`[Notification] Failed sending to ${target.type}`, { error: err.message });
          results.push({ target: target.type, success: false, error: err.message });
        }

        // Small gap between targets to avoid simultaneous sends
        if (targets.indexOf(target) < targets.length - 1) {
          await _sleep(600);
        }
      }

      const anySuccess = results.some(r => r.success);
      logger.info('[Notification] Dispatch complete', { anySuccess, results });

      return { success: anySuccess, results };

    } catch (err) {
      // Non-fatal — log and return failure without throwing
      logger.error('[Notification] Unexpected error', {
        error: err.message,
        jobId: job.id || job._id,
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Convenience wrapper for update events.
   * Only posts if at least one "significant" field was changed.
   *
   * @param {object} job       – Updated job record
   * @param {object} [changed] – Map of changed field names (optional)
   */
  async notifyJobUpdate(job, changed = {}) {
    const SIGNIFICANT = ['title', 'organization', 'location', 'salary_range', 'last_date', 'apply_url'];
    const hasSignificant = Object.keys(changed).some(f => SIGNIFICANT.includes(f));

    if (Object.keys(changed).length > 0 && !hasSignificant) {
      logger.info('[Notification] Minor update — skipping WhatsApp notification', { changed });
      return { success: true, skipped: true, reason: 'Minor update' };
    }

    return this.notifyJob(job, 'updated');
  }

  /**
   * Daily digest — sends a summary of multiple jobs.
   * @param {Array} jobs
   */
  async notifyBulkDigest(jobs = []) {
    if (!config.enabled) return { success: true, skipped: true };
    if (!jobs.length)    return { success: false, reason: 'No jobs provided' };

    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    let msg = `📢 *DAILY JOB DIGEST* 📢\n`;
    msg    += `📅 ${dateStr}\n`;
    msg    += `🎯 *${jobs.length} New Vacancies Today*\n\n`;
    msg    += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    jobs.slice(0, 5).forEach((job, i) => {
      msg += `${i + 1}. *${job.title}*\n`;
      msg += `   🏢 ${job.organization || 'N/A'}\n`;
      msg += `   📍 ${job.location     || 'N/A'}\n`;
      msg += `   🔗 ${job.apply_url    || process.env.FRONTEND_URL || 'https://newvacancy.live'}\n\n`;
    });

    if (jobs.length > 5) {
      msg += `\n… and *${jobs.length - 5} more* vacancies!\n\n`;
    }

    msg += `🌐 *View all:* ${process.env.FRONTEND_URL || 'https://newvacancy.live'}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━`;

    return whatsapp.sendToGroup(msg);
  }

  // ── PRIVATE: format ────────────────────────────────────────────────────────

  /**
   * Build the WhatsApp message string from a job record.
   * Fields mirror the Supabase `jobs` table used in this project.
   */
  _formatJobMessage(job, action = 'new') {
    const {
      title,
      organization,
      category,
      location,
      state,
      qualification,
      vacancies,
      salary_range,
      last_date,
      apply_url,
      tags,
      description,
    } = job;

    const isUpdate = action === 'updated';
    const emoji    = isUpdate ? '🔄' : '🔥';
    const header   = isUpdate ? 'JOB UPDATED' : 'NEW JOB VACANCY';

    const lastDateStr = last_date
      ? new Date(last_date).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      : 'Not specified';

    let msg = `${emoji} *${header}* ${emoji}\n\n`;

    if (organization) msg += `🏢 *Company:*       ${organization}\n`;
    if (title)        msg += `📌 *Role:*          ${title}\n`;
    if (category)     msg += `📂 *Category:*      ${category}\n`;

    const loc = [location, state].filter(Boolean).join(', ');
    if (loc)          msg += `📍 *Location:*      ${loc}\n`;
    if (qualification) msg += `🎓 *Qualification:* ${qualification}\n`;
    if (vacancies)    msg += `👥 *Vacancies:*     ${vacancies}\n`;
    if (salary_range) msg += `💰 *Salary:*        ${salary_range}\n`;

    msg += `⏳ *Last Date:*     ${lastDateStr}\n`;

    if (Array.isArray(tags) && tags.length > 0) {
      msg += `\n🏷️ *Tags:* ${tags.slice(0, 6).join(' • ')}\n`;
    }

    if (description) {
      const excerpt = description.length > 160
        ? description.substring(0, 157) + '…'
        : description;
      msg += `\n📄 *Details:*\n${excerpt}\n`;
    }

    const applyLink = apply_url || process.env.FRONTEND_URL || 'https://newvacancy.live';
    msg += `\n👉 *Apply Now:* ${applyLink}\n`;
    msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🌐 ${process.env.FRONTEND_URL || 'https://newvacancy.live'}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━`;

    return msg;
  }

  /**
   * Build the list of WhatsApp targets from config.
   * @returns {{type:string, id:string}[]}
   */
  _resolveTargets() {
    const targets = [];
    if (config.groupId)   targets.push({ type: 'group',   id: config.groupId });
    if (config.channelId) targets.push({ type: 'channel', id: config.channelId });
    return targets;
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Singleton export ──────────────────────────────────────────────────────────

module.exports = new NotificationService();
