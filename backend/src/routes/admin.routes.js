'use strict';

/**
 * admin.routes.js
 * All admin & super-admin API routes.
 *
 * Role matrix:
 *   super_admin → full access (only rajputnileshsingh3@gmail.com, hardcoded)
 *   admin       → read users, block/unblock, delete regular users
 *   user        → no access
 *
 * Mounted in server.js:
 *   app.use('/api/admin', adminRoutes);
 */

const express = require('express');
const router  = express.Router();

const {
  requireAdmin,
  requireSuperAdmin,
  isSuperAdminEmail,
  supabaseAdmin,
  SUPER_ADMIN_EMAIL,
} = require('../middleware/rbac');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write an audit log entry.
 * Fire-and-forget — never block the response.
 */
async function logAudit({ action, performedByEmail, targetEmail, targetUserId, meta = {} }) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action,
      performed_by: performedByEmail,
      target_user:  targetEmail || targetUserId,
      meta,
    });
  } catch (err) {
    // Non-fatal — log and continue
    console.warn('[Audit] Failed to write audit log:', err.message);
  }
}

/**
 * Guard: reject any attempt to modify the super admin.
 * Call this before any role/block/delete operation.
 */
function rejectIfSuperAdmin(targetEmail, res) {
  if (isSuperAdminEmail(targetEmail)) {
    res.status(403).json({
      success: false,
      error:   'The super admin account is immutable and cannot be modified.',
      code:    'SUPER_ADMIN_IMMUTABLE',
    });
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN ONLY: Promote a user to admin
// POST /api/admin/promote
// Body: { userId: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/promote', requireSuperAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

  try {
    // Fetch target profile
    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (fetchErr || !target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Hard guard — super admin is immutable
    if (rejectIfSuperAdmin(target.email, res)) return;

    // Cannot promote self (super admin is already super admin)
    if (target.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot change your own role' });
    }

    // Prevent promoting to super_admin via this endpoint — super_admin is email-locked
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    await logAudit({
      action:          'PROMOTE_TO_ADMIN',
      performedByEmail: req.user.email,
      targetEmail:      target.email,
      targetUserId:     userId,
    });

    console.log(`[RBAC] ✅ ${req.user.email} promoted ${target.email} to admin`);
    res.json({ success: true, message: `${target.email} is now an admin.` });

  } catch (err) {
    console.error('[RBAC] promote error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN ONLY: Demote an admin back to user
// POST /api/admin/demote
// Body: { userId: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/demote', requireSuperAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

  try {
    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (fetchErr || !target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Hard guard
    if (rejectIfSuperAdmin(target.email, res)) return;

    if (target.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot change your own role' });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'user', updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    await logAudit({
      action:          'DEMOTE_FROM_ADMIN',
      performedByEmail: req.user.email,
      targetEmail:      target.email,
      targetUserId:     userId,
    });

    console.log(`[RBAC] ✅ ${req.user.email} demoted ${target.email} to user`);
    res.json({ success: true, message: `${target.email} has been demoted to user.` });

  } catch (err) {
    console.error('[RBAC] demote error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN+: Block / Unblock a user
// POST /api/admin/block
// Body: { userId: string, isBlocked: boolean }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/block', requireAdmin, async (req, res) => {
  const { userId, isBlocked } = req.body;
  if (!userId || typeof isBlocked !== 'boolean') {
    return res.status(400).json({ success: false, error: 'userId and isBlocked (boolean) are required' });
  }

  try {
    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (fetchErr || !target) return res.status(404).json({ success: false, error: 'User not found' });

    // Hard guard — cannot block super admin
    if (rejectIfSuperAdmin(target.email, res)) return;

    // Regular admins cannot block other admins — only super_admin can
    if (target.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Only the super admin can block other admins' });
    }

    if (target.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot block yourself' });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ is_blocked: isBlocked, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    await logAudit({
      action:          isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
      performedByEmail: req.user.email,
      targetEmail:      target.email,
      targetUserId:     userId,
    });

    res.json({ success: true, message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully.` });

  } catch (err) {
    console.error('[RBAC] block error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN+: Delete user (cascade via auth.users → profiles)
// DELETE /api/admin/delete-user
// Body: { userId: string }
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/delete-user', requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

  try {
    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (fetchErr || !target) return res.status(404).json({ success: false, error: 'User not found' });

    // Hard guard — cannot delete super admin
    if (rejectIfSuperAdmin(target.email, res)) return;

    // Regular admins cannot delete other admins
    if (target.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Only the super admin can delete other admins' });
    }

    // Cannot delete self
    if (target.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    }

    await logAudit({
      action:          'DELETE_USER',
      performedByEmail: req.user.email,
      targetEmail:      target.email,
      targetUserId:     userId,
    });

    // service_role can delete auth.users — cascade removes profiles + related data
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteErr) throw deleteErr;

    console.log(`[RBAC] 🗑️ ${req.user.email} deleted user: ${target.email}`);
    res.json({ success: true, message: 'User permanently deleted.' });

  } catch (err) {
    console.error('[RBAC] deleteUser error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN+: List all users
// GET /api/admin/users
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Inject effective role — super admin always shows as super_admin
    const enriched = (data || []).map(p => ({
      ...p,
      role: isSuperAdminEmail(p.email) ? 'super_admin' : (p.role || 'user'),
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('[RBAC] listUsers error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN ONLY: View audit logs
// GET /api/admin/audit-logs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audit-logs', requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[RBAC] auditLogs error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
