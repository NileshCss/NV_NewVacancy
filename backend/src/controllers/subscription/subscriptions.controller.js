'use strict';

const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

// ── Helper: write to audit log ─────────────────────────────────────────────────
async function auditLog(adminId, studentId, action, reason, metadata = {}) {
  await supabase.from('subscription_audit_log').insert([{
    admin_id: adminId,
    student_id: studentId,
    action,
    reason: reason || null,
    metadata,
  }]);
}

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

// GET /api/subscription/admin/student/:id - Full subscription detail for one student (Admin only)
exports.getStudentSubscriptionDetail = async (req, res) => {
  try {
    const { id: studentId } = req.params;

    // Active subscription
    const { data: sub } = await supabase
      .from('student_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('student_id', studentId)
      .in('status', ['active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Question usage
    const { data: questionUsage } = await supabase
      .from('question_usage')
      .select('questions_used, last_reset_at')
      .eq('student_id', studentId)
      .maybeSingle();

    // Mock test usage
    const { data: mockUsage } = await supabase
      .from('mock_test_usage')
      .select('mock_tests_used, last_reset_at')
      .eq('student_id', studentId)
      .maybeSingle();

    // Active sponsored access
    const { data: sponsored } = await supabase
      .from('sponsored_access')
      .select('*, subscription_plans(name), profiles:granted_by(full_name, email)')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .maybeSingle();

    // All plans (for dropdown)
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id, name, question_limit, mock_test_limit')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    // Recent audit log (last 10 actions for this student)
    const { data: auditHistory } = await supabase
      .from('subscription_audit_log')
      .select('action, reason, metadata, created_at, profiles:admin_id(full_name, email)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      data: {
        subscription: sub || null,
        questionUsage: questionUsage || { questions_used: 0 },
        mockUsage: mockUsage || { mock_tests_used: 0 },
        sponsoredAccess: sponsored || null,
        plans: plans || [],
        auditHistory: auditHistory || [],
      },
    });
  } catch (err) {
    logger.error('[SubscriptionsController] Error fetching student detail:', err);
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

    await auditLog(req.user.id, student_id, 'change_plan', reason || 'Manual plan change by admin', {
      subscription_id: newSub.id, plan_id, expires_at, status,
    });

    res.json({ success: true, message: 'Student subscription overridden successfully', data: newSub });
  } catch (err) {
    logger.error('[SubscriptionsController] Error overriding student subscription:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/admin/student/extend - Extend subscription by N days (Admin only)
exports.extendSubscription = async (req, res) => {
  try {
    const { student_id, days, reason } = req.body;

    if (!student_id || !days || isNaN(parseInt(days))) {
      return res.status(400).json({ success: false, error: 'Student ID and days (number) are required' });
    }

    const addDays = parseInt(days);

    // Fetch current active subscription
    const { data: sub, error: subErr } = await supabase
      .from('student_subscriptions')
      .select('id, expires_at, status')
      .eq('student_id', student_id)
      .in('status', ['active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) throw subErr;
    if (!sub) {
      return res.status(404).json({ success: false, error: 'No active subscription found for this student' });
    }

    // Calculate new expiry
    const baseDate = sub.expires_at ? new Date(sub.expires_at) : new Date();
    const newExpiry = new Date(baseDate.getTime() + addDays * 24 * 60 * 60 * 1000);

    const { data: updated, error: updateErr } = await supabase
      .from('student_subscriptions')
      .update({ expires_at: newExpiry.toISOString(), status: 'active' })
      .eq('id', sub.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await auditLog(req.user.id, student_id, 'extend_subscription', reason || `Extended by ${addDays} days`, {
      subscription_id: sub.id, added_days: addDays, new_expiry: newExpiry.toISOString(),
    });

    res.json({ success: true, message: `Subscription extended by ${addDays} days`, data: updated });
  } catch (err) {
    logger.error('[SubscriptionsController] Error extending subscription:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/admin/student/lifetime - Grant lifetime access (Admin only)
exports.grantLifetimeAccess = async (req, res) => {
  try {
    const { student_id, reason } = req.body;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'Student ID is required' });
    }

    const { data: sub, error: subErr } = await supabase
      .from('student_subscriptions')
      .select('id')
      .eq('student_id', student_id)
      .in('status', ['active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) throw subErr;
    if (!sub) {
      return res.status(404).json({ success: false, error: 'No active subscription found for this student' });
    }

    const { data: updated, error } = await supabase
      .from('student_subscriptions')
      .update({ expires_at: null, status: 'active' })
      .eq('id', sub.id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(req.user.id, student_id, 'grant_lifetime', reason || 'Lifetime access granted by admin', {
      subscription_id: sub.id,
    });

    res.json({ success: true, message: 'Lifetime access granted (expiry set to null)', data: updated });
  } catch (err) {
    logger.error('[SubscriptionsController] Error granting lifetime:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/admin/student/expiry - Set custom expiry date (Admin only)
exports.setCustomExpiry = async (req, res) => {
  try {
    const { student_id, expiry_date, reason } = req.body;

    if (!student_id || !expiry_date) {
      return res.status(400).json({ success: false, error: 'Student ID and expiry_date are required' });
    }

    const newExpiry = new Date(expiry_date);
    if (isNaN(newExpiry.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid expiry_date format' });
    }

    const { data: sub, error: subErr } = await supabase
      .from('student_subscriptions')
      .select('id')
      .eq('student_id', student_id)
      .in('status', ['active', 'grace_period', 'expired'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) throw subErr;
    if (!sub) {
      return res.status(404).json({ success: false, error: 'No subscription found for this student' });
    }

    const { data: updated, error } = await supabase
      .from('student_subscriptions')
      .update({ expires_at: newExpiry.toISOString(), status: 'active' })
      .eq('id', sub.id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(req.user.id, student_id, 'set_custom_expiry', reason || 'Custom expiry set by admin', {
      subscription_id: sub.id, new_expiry: newExpiry.toISOString(),
    });

    res.json({ success: true, message: `Expiry set to ${newExpiry.toDateString()}`, data: updated });
  } catch (err) {
    logger.error('[SubscriptionsController] Error setting custom expiry:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/admin/student/limit - Override per-student question/mock limit (Admin only)
exports.increaseLimit = async (req, res) => {
  try {
    const { student_id, type, new_limit, reason } = req.body;

    if (!student_id || !type || new_limit === undefined) {
      return res.status(400).json({ success: false, error: 'student_id, type (questions|mock_tests), and new_limit are required' });
    }

    if (!['questions', 'mock_tests'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be "questions" or "mock_tests"' });
    }

    const { data: sub, error: subErr } = await supabase
      .from('student_subscriptions')
      .select('id')
      .eq('student_id', student_id)
      .in('status', ['active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) throw subErr;
    if (!sub) {
      return res.status(404).json({ success: false, error: 'No active subscription found for this student' });
    }

    const updateField = type === 'questions' ? 'question_limit_override' : 'mock_test_limit_override';
    const parsedLimit = new_limit === null ? null : parseInt(new_limit);

    const { data: updated, error } = await supabase
      .from('student_subscriptions')
      .update({ [updateField]: parsedLimit })
      .eq('id', sub.id)
      .select()
      .single();

    if (error) throw error;

    await auditLog(req.user.id, student_id, 'override_limit', reason || `${type} limit overridden`, {
      subscription_id: sub.id, type, new_limit: parsedLimit,
    });

    res.json({ success: true, message: `${type} limit set to ${parsedLimit ?? 'unlimited'}`, data: updated });
  } catch (err) {
    logger.error('[SubscriptionsController] Error overriding limit:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/admin/student/toggle-premium - Quick toggle Premium/Free (Admin only)
exports.togglePremium = async (req, res) => {
  try {
    const { student_id, enable, reason } = req.body;

    if (!student_id || enable === undefined) {
      return res.status(400).json({ success: false, error: 'student_id and enable (boolean) are required' });
    }

    // Find Premium plan or Free plan
    const targetPlanName = enable ? 'Premium' : 'Free';
    const { data: plan, error: planErr } = await supabase
      .from('subscription_plans')
      .select('id, name')
      .ilike('name', targetPlanName)
      .limit(1)
      .maybeSingle();

    if (planErr || !plan) {
      return res.status(404).json({ success: false, error: `Could not find "${targetPlanName}" plan. Ensure it exists in subscription_plans.` });
    }

    // Deactivate existing subscriptions
    await supabase
      .from('student_subscriptions')
      .update({ status: 'expired' })
      .eq('student_id', student_id)
      .eq('status', 'active');

    // Create new one
    const { data: newSub, error } = await supabase
      .from('student_subscriptions')
      .insert([{
        student_id,
        plan_id: plan.id,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: enable ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    await auditLog(req.user.id, student_id, enable ? 'activate_premium' : 'deactivate_premium',
      reason || `${targetPlanName} toggled by admin`,
      { subscription_id: newSub.id, plan_id: plan.id, plan_name: plan.name });

    res.json({ success: true, message: `${targetPlanName} access ${enable ? 'activated' : 'deactivated'}`, data: newSub });
  } catch (err) {
    logger.error('[SubscriptionsController] Error toggling premium:', err);
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

    await auditLog(req.user.id, student_id, 'reset_usage', `Reset usage of type: ${type}`, resetMetadata);

    res.json({ success: true, message: 'Student usage reset successfully', metadata: resetMetadata });
  } catch (err) {
    logger.error('[SubscriptionsController] Error resetting student usage:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
