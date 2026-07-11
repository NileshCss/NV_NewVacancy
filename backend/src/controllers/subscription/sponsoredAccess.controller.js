'use strict';

const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

// POST /api/subscription/sponsored/grant - Grant sponsored access (Admin only)
exports.grantAccess = async (req, res) => {
  try {
    const { student_id, plan_id, reason, validity_days } = req.body;

    if (!student_id || !plan_id) {
      return res.status(400).json({ success: false, error: 'Student ID and Plan ID are required' });
    }

    // Verify student exists
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', student_id)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Verify plan exists
    const { data: plan, error: planErr } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('id', plan_id)
      .single();

    if (planErr || !plan) {
      return res.status(404).json({ success: false, error: 'Subscription plan not found' });
    }

    const validUntil = validity_days
      ? new Date(Date.now() + parseInt(validity_days) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Deactivate any existing active sponsored access for this user
    await supabase
      .from('sponsored_access')
      .update({ is_active: false })
      .eq('student_id', student_id)
      .eq('is_active', true);

    // Insert new sponsored access
    const { data, error } = await supabase
      .from('sponsored_access')
      .insert([{
        student_id,
        plan_id,
        reason: reason || 'Sponsored by Admin',
        granted_by: req.user.id,
        valid_until: validUntil,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;

    // Log admin audit action
    await supabase.from('subscription_audit_log').insert([{
      admin_id: req.user.id,
      student_id,
      action: 'grant_sponsored',
      reason: reason || 'Sponsored access',
      metadata: { sponsored_id: data.id, plan_name: plan.name, valid_until: validUntil }
    }]);

    res.status(201).json({
      success: true,
      message: `Sponsored ${plan.name} access successfully granted to ${profile.full_name || profile.email}`,
      data
    });
  } catch (err) {
    logger.error('[SponsoredAccessController] Error granting access:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/sponsored/revoke/:id - Revoke sponsored access (Admin only)
exports.revokeAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: record, error: fetchErr } = await supabase
      .from('sponsored_access')
      .select('student_id, plan_id, is_active')
      .eq('id', id)
      .single();

    if (fetchErr || !record) {
      return res.status(404).json({ success: false, error: 'Sponsored access record not found' });
    }

    if (!record.is_active) {
      return res.status(400).json({ success: false, error: 'Access already inactive/revoked' });
    }

    const { data, error } = await supabase
      .from('sponsored_access')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from('subscription_audit_log').insert([{
      admin_id: req.user.id,
      student_id: record.student_id,
      action: 'revoke_sponsored',
      reason: reason || 'Revoked by admin',
      metadata: { sponsored_id: id }
    }]);

    res.json({ success: true, message: 'Sponsored access successfully revoked', data });
  } catch (err) {
    logger.error('[SponsoredAccessController] Error revoking access:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
