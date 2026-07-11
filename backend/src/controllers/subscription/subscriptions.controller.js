'use strict';

const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

// GET /api/subscription/student/current - Get current user active subscription
exports.getCurrentSubscription = async (req, res) => {
  try {
    const studentId = req.user.id;

    const { data: sub, error } = await supabase
      .from('student_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .maybeSingle();

    if (error) throw error;

    res.json({ success: true, data: sub || null });
  } catch (err) {
    logger.error('[SubscriptionsController] Error fetching active sub:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/subscription/admin/students - List all student subscriptions with profiles (Admin only)
exports.listStudentSubscriptions = async (req, res) => {
  try {
    const { data: subs, error } = await supabase
      .from('student_subscriptions')
      .select('*, subscription_plans(*), profiles:student_id(email, full_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: subs });
  } catch (err) {
    logger.error('[SubscriptionsController] Error listing student subs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/admin/student/override - Admin overrides student subscription (Admin only)
exports.updateStudentSubscription = async (req, res) => {
  try {
    const { student_id, plan_id, status, expires_at, reason } = req.body;

    if (!student_id || !plan_id) {
      return res.status(400).json({ success: false, error: 'Student ID and Plan ID are required' });
    }

    // Verify student profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', student_id)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Deactivate any active subscriptions first
    await supabase
      .from('student_subscriptions')
      .update({ status: 'expired' })
      .eq('student_id', student_id)
      .eq('status', 'active');

    // Create new subscription entry (or override)
    const { data: newSub, error } = await supabase
      .from('student_subscriptions')
      .insert([{
        student_id,
        plan_id,
        status: status || 'active',
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        started_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Log admin action
    await supabase.from('subscription_audit_log').insert([{
      admin_id: req.user.id,
      student_id,
      action: 'override_subscription',
      reason: reason || 'Manual admin override',
      metadata: { subscription_id: newSub.id, plan_id, expires_at, status }
    }]);

    res.json({ success: true, message: 'Student subscription overridden successfully', data: newSub });
  } catch (err) {
    logger.error('[SubscriptionsController] Error overriding student subscription:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/admin/student/reset-usage - Reset student usage count (Admin only)
exports.resetStudentUsage = async (req, res) => {
  try {
    const { student_id, type } = req.body; // type = 'questions' | 'mock_tests' | 'both'

    if (!student_id || !type) {
      return res.status(400).json({ success: false, error: 'Student ID and reset type are required' });
    }

    const resetMetadata = {};

    if (type === 'questions' || type === 'both') {
      const { error: qErr } = await supabase
        .from('question_usage')
        .upsert({ student_id, questions_used: 0, last_reset_at: new Date().toISOString() });
      
      if (qErr) throw qErr;
      resetMetadata.questions_reset = true;
    }

    if (type === 'mock_tests' || type === 'both') {
      const { error: mErr } = await supabase
        .from('mock_test_usage')
        .upsert({ student_id, mock_tests_used: 0, last_reset_at: new Date().toISOString() });

      if (mErr) throw mErr;
      resetMetadata.mock_tests_reset = true;
    }

    // Log admin action
    await supabase.from('subscription_audit_log').insert([{
      admin_id: req.user.id,
      student_id,
      action: 'reset_usage',
      reason: `Reset usage of type: ${type}`,
      metadata: resetMetadata
    }]);

    res.json({ success: true, message: 'Student usage reset successfully', metadata: resetMetadata });
  } catch (err) {
    logger.error('[SubscriptionsController] Error resetting student usage:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
