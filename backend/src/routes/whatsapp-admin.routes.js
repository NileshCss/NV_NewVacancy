'use strict';

/**
 * whatsapp-admin.routes.js
 * Admin-only API endpoints for the WhatsApp connection management page.
 *
 * All routes require admin or super_admin role (enforced by requireAdmin middleware).
 *
 * Endpoints:
 *   GET  /api/admin/whatsapp/status  — full connection status
 *   GET  /api/admin/whatsapp/qr      — current QR code as base64 PNG
 *   GET  /api/admin/whatsapp/logs    — paginated event log
 *   POST /api/admin/whatsapp/logout  — manually log out the session
 */

const express         = require('express');
const router          = express.Router();
const whatsapp        = require('../services/whatsappService');
const { requireAdmin } = require('../middleware/rbac');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// ── GET /api/admin/whatsapp/status ────────────────────────────────────────────
router.get('/status', requireAdmin, (req, res) => {
  try {
    const status = whatsapp.getDetailedStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/whatsapp/qr ────────────────────────────────────────────────
// Returns { qr: "data:image/png;base64,..." } when a QR is active.
// Returns { qr: null } when connected or no QR pending.
router.get('/qr', requireAdmin, (req, res) => {
  try {
    const qr = whatsapp.getQR();
    res.json({ success: true, qr });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/whatsapp/logs ──────────────────────────────────────────────
// Query params: ?page=1&limit=20
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const from  = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('whatsapp_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      meta: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/admin/whatsapp/logout ───────────────────────────────────────────
// Triggers a manual session logout from the admin dashboard.
router.post('/logout', requireAdmin, async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?.email || 'admin';
    await whatsapp.logout(triggeredBy);
    res.json({ success: true, message: 'WhatsApp session logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
