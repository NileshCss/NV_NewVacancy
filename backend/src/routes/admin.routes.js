'use strict';

/**
 * admin.routes.js
 * Admin-only API endpoints.
 *
 * SECURITY: These routes use the SUPABASE_SERVICE_KEY (service_role).
 * That key MUST only ever live on the backend — never expose it to the frontend.
 *
 * Mount in server.js:
 *   const adminRoutes = require('./routes/admin.routes');
 *   app.use('/api/admin', adminRoutes);
 */

const express    = require('express');
const { createClient } = require('@supabase/supabase-js');
const router     = express.Router();

// ── Service-role client (can delete auth.users) ────────────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role key — NEVER expose on frontend
);

// ── Regular client (to verify caller's JWT) ────────────────────────────────
const supabaseRegular = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Middleware: Verify caller is an authenticated admin ──────────────────────
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  try {
    // Validate the JWT against Supabase
    const { data: { user }, error: authErr } = await supabaseRegular.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Confirm caller has admin role in profiles table
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    console.error('[AdminRoute] requireAdmin error:', err.message);
    res.status(500).json({ error: 'Auth verification failed' });
  }
}

/**
 * DELETE /api/admin/delete-user
 *
 * Deletes a user from auth.users.
 * The ON DELETE CASCADE on profiles.id → auth.users(id) ensures:
 *   - profiles row deleted
 *   - applications rows deleted
 *   - resume_analyses rows deleted
 *   - saved_jobs rows deleted
 *
 * Body: { userId: string (UUID) }
 */
router.delete('/delete-user', requireAdmin, async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required in request body' });
  }

  // Prevent admin from deleting themselves
  if (userId === req.adminUser.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account' });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    console.log(`[AdminRoute] ✅ User deleted: ${userId} by admin: ${req.adminUser.id}`);
    res.json({
      success: true,
      message: 'User and all related data permanently deleted (CASCADE)',
    });
  } catch (err) {
    console.error('[AdminRoute] deleteUser error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/users
 * List all users from auth.users with profile data
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[AdminRoute] listUsers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
