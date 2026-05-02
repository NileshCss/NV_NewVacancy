'use strict';

/**
 * whatsapp.routes.js
 * All WhatsApp notification API endpoints.
 *
 * Mounted in server.js as:
 *   app.use('/api/whatsapp', whatsappRoutes);
 *
 * Integration model for this project (Supabase + React frontend):
 *   The admin panel creates/updates jobs directly in Supabase.
 *   After each successful save the frontend calls:
 *     POST /api/whatsapp/notify-job   { job: {...}, action: 'new'|'updated' }
 *   The backend then formats and posts to WhatsApp group/channel.
 *
 * Auth: all mutation routes require admin or super_admin role (RBAC from rbac.js).
 *       status and test routes require at least admin.
 */

const express             = require('express');
const router              = express.Router();
const notificationService = require('../services/notificationService');
const whatsappService     = require('../services/whatsappService');
const logger              = require('../utils/logger');
const { requireAdmin, requireSuperAdmin } = require('../middleware/rbac');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/notify-job
// Send a WhatsApp notification for a newly created or updated job.
// Called by the admin frontend immediately after a Supabase job upsert.
//
// Body: {
//   job:     { title, organization, location, ... }  (required)
//   action:  'new' | 'updated'                       (default 'new')
//   changed: { [fieldName]: true }                   (optional, for update filter)
// }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/notify-job', requireAdmin, async (req, res) => {
  const { job, action = 'new', changed = {} } = req.body;

  if (!job || typeof job !== 'object') {
    return res.status(400).json({
      success: false,
      error:   'Request body must include a `job` object',
      code:    'INVALID_BODY',
    });
  }

  if (!job.title) {
    return res.status(400).json({
      success: false,
      error:   '`job.title` is required',
      code:    'MISSING_TITLE',
    });
  }

  try {
    let result;

    if (action === 'updated') {
      result = await notificationService.notifyJobUpdate(job, changed);
    } else {
      result = await notificationService.notifyJob(job, 'new');
    }

    logger.info('[WhatsAppRoute] Notification dispatched', {
      jobTitle: job.title,
      action,
      result,
    });

    return res.status(200).json({
      success: true,
      data:    result,
    });

  } catch (err) {
    // notifyJob/notifyJobUpdate are non-throwing but catch defensively anyway
    logger.error('[WhatsAppRoute] notify-job error', { error: err.message });
    return res.status(500).json({
      success: false,
      error:   err.message,
      code:    'NOTIFY_FAILED',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/notify-bulk
// Send a daily digest of multiple jobs.
// Body: { jobs: [...] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/notify-bulk', requireAdmin, async (req, res) => {
  const { jobs } = req.body;

  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({
      success: false,
      error:   '`jobs` must be a non-empty array',
      code:    'INVALID_BODY',
    });
  }

  try {
    const result = await notificationService.notifyBulkDigest(jobs);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error('[WhatsAppRoute] notify-bulk error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/status
// Returns current WhatsApp client status.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', requireAdmin, (req, res) => {
  res.json({
    success: true,
    data:    whatsappService.getStatus(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/chats
// Lists all WhatsApp chats — use this to discover your group/channel ID.
// Super-admin only so it can't be abused.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/chats', requireSuperAdmin, async (req, res) => {
  try {
    const chats = await whatsappService.getAllChats();
    return res.json({
      success: true,
      data:    chats,
      tip:     'Filter by isGroup:true to find your group ID, then set WHATSAPP_GROUP_ID in .env',
    });
  } catch (err) {
    logger.error('[WhatsAppRoute] /chats error', { error: err.message });
    return res.status(500).json({
      success: false,
      error:   err.message,
      code:    'CHATS_FAILED',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/test
// Send a quick test message to the configured group (super-admin only).
// Body: { message?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test', requireSuperAdmin, async (req, res) => {
  const text = req.body?.message
    || `✅ *NewVacancy WhatsApp Bot* is live!\nTest sent at ${new Date().toLocaleString('en-IN')}.`;

  try {
    const result = await whatsappService.sendToGroup(text);
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[WhatsAppRoute] /test error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
