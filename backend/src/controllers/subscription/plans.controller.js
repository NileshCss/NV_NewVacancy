'use strict';

const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

// GET /api/subscription/plans - List Plans
exports.listPlans = async (req, res) => {
  try {
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
    
    let query = supabase
      .from('subscription_plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (!isAdmin) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[PlansController] Error listing plans:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/plans - Create Plan (Admin only)
exports.createPlan = async (req, res) => {
  try {
    const { name, price, validity_days, question_limit, mock_test_limit, features, is_active, display_order } = req.body;
    
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    const payload = {
      name,
      price: parseFloat(price),
      validity_days: validity_days !== undefined ? parseInt(validity_days) : null,
      question_limit: question_limit !== undefined ? parseInt(question_limit) : null,
      mock_test_limit: mock_test_limit !== undefined ? parseInt(mock_test_limit) : null,
      features: features || {},
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      display_order: display_order !== undefined ? parseInt(display_order) : 0
    };

    const { data, error } = await supabase
      .from('subscription_plans')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    // Create feature_permissions records
    const featureKeys = Object.keys(payload.features);
    if (featureKeys.length > 0) {
      const perms = featureKeys.map(key => ({
        plan_id: data.id,
        feature_key: key,
        is_enabled: Boolean(payload.features[key])
      }));
      await supabase.from('feature_permissions').insert(perms);
    }

    // Log admin action
    await supabase.from('subscription_audit_log').insert([{
      admin_id: req.user.id,
      action: 'create_plan',
      reason: `Created plan ${name}`,
      metadata: { plan_id: data.id, plan_name: name }
    }]);

    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('[PlansController] Error creating plan:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/subscription/plans/:id - Update Plan (Admin only)
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, validity_days, question_limit, mock_test_limit, features, is_active, display_order } = req.body;

    const payload = {};
    if (name !== undefined) payload.name = name;
    if (price !== undefined) payload.price = parseFloat(price);
    if (validity_days !== undefined) payload.validity_days = validity_days !== null ? parseInt(validity_days) : null;
    if (question_limit !== undefined) payload.question_limit = question_limit !== null ? parseInt(question_limit) : null;
    if (mock_test_limit !== undefined) payload.mock_test_limit = mock_test_limit !== null ? parseInt(mock_test_limit) : null;
    if (features !== undefined) payload.features = features;
    if (is_active !== undefined) payload.is_active = Boolean(is_active);
    if (display_order !== undefined) payload.display_order = parseInt(display_order);

    const { data, error } = await supabase
      .from('subscription_plans')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update feature permissions
    if (features !== undefined) {
      // Clear old permissions first
      await supabase.from('feature_permissions').delete().eq('plan_id', id);
      // Insert new permissions
      const featureKeys = Object.keys(features);
      if (featureKeys.length > 0) {
        const perms = featureKeys.map(key => ({
          plan_id: id,
          feature_key: key,
          is_enabled: Boolean(features[key])
        }));
        await supabase.from('feature_permissions').insert(perms);
      }
    }

    // Log admin action
    await supabase.from('subscription_audit_log').insert([{
      admin_id: req.user.id,
      action: 'update_plan',
      reason: `Updated plan ${data.name}`,
      metadata: { plan_id: id, updates: payload }
    }]);

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[PlansController] Error updating plan:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/subscription/plans/:id - Delete Plan (Admin only)
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: plan, error: fetchErr } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log admin action
    await supabase.from('subscription_audit_log').insert([{
      admin_id: req.user.id,
      action: 'delete_plan',
      reason: `Deleted plan ${plan.name}`,
      metadata: { plan_id: id, plan_name: plan.name }
    }]);

    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    logger.error('[PlansController] Error deleting plan:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
