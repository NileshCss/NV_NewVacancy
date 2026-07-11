'use strict';

const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

/**
 * Gets the active plan for a student.
 * Checks sponsored access first, then active subscription, and defaults to Free.
 */
async function getStudentActivePlan(studentId) {
  try {
    // 1. Check sponsored access
    const { data: sponsored, error: spErr } = await supabase
      .from('sponsored_access')
      .select('*, subscription_plans(*)')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString())
      .maybeSingle();

    if (spErr) {
      logger.warn('[UsageEnforcement] Error fetching sponsored access:', spErr.message);
    }

    if (sponsored && sponsored.subscription_plans) {
      return {
        plan: sponsored.subscription_plans,
        isSponsored: true,
        expiresAt: sponsored.valid_until
      };
    }

    // 2. Check active student subscription
    const { data: sub, error: subErr } = await supabase
      .from('student_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .maybeSingle();

    if (subErr) {
      logger.warn('[UsageEnforcement] Error fetching student subscription:', subErr.message);
    }

    if (sub && sub.subscription_plans) {
      return {
        plan: sub.subscription_plans,
        isSponsored: false,
        expiresAt: sub.expires_at
      };
    }

    // 3. Fallback to Free plan
    const { data: freePlan, error: freeErr } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', 'Free')
      .maybeSingle();

    if (freeErr || !freePlan) {
      throw new Error(freeErr?.message || 'Free subscription plan not found');
    }

    return {
      plan: freePlan,
      isSponsored: false,
      expiresAt: null
    };
  } catch (err) {
    logger.error('[UsageEnforcement] Error getting active plan:', err);
    throw err;
  }
}

/**
 * Fetches the student's current usage and limits.
 */
async function getStudentUsageAndLimits(studentId) {
  const { plan, isSponsored, expiresAt } = await getStudentActivePlan(studentId);

  // Fetch current question usage
  const { data: qUsage } = await supabase
    .from('question_usage')
    .select('questions_used')
    .eq('student_id', studentId)
    .maybeSingle();

  // Fetch current mock test usage
  const { data: mUsage } = await supabase
    .from('mock_test_usage')
    .select('mock_tests_used')
    .eq('student_id', studentId)
    .maybeSingle();

  const questionsUsed = qUsage?.questions_used || 0;
  const mockTestsUsed = mUsage?.mock_tests_used || 0;

  return {
    studentId,
    planId: plan.id,
    planName: plan.name,
    isSponsored,
    expiresAt,
    limits: {
      questionsLimit: plan.question_limit,
      mockTestsLimit: plan.mock_test_limit,
      features: plan.features || {}
    },
    usage: {
      questionsUsed,
      mockTestsUsed,
      questionsRemaining: plan.question_limit === null ? null : Math.max(0, plan.question_limit - questionsUsed),
      mockTestsRemaining: plan.mock_test_limit === null ? null : Math.max(0, plan.mock_test_limit - mockTestsUsed)
    }
  };
}

/**
 * Gating check for specific feature keys (e.g. previous_year_papers, ai_analytics)
 */
async function checkFeaturePermission(studentId, featureKey) {
  try {
    const { plan } = await getStudentActivePlan(studentId);
    
    // Check in features JSON
    if (plan.features && plan.features[featureKey] === true) {
      return true;
    }

    // Double check feature_permissions table
    const { data: perm } = await supabase
      .from('feature_permissions')
      .select('is_enabled')
      .eq('plan_id', plan.id)
      .eq('feature_key', featureKey)
      .maybeSingle();

    return perm?.is_enabled === true;
  } catch (err) {
    logger.error('[UsageEnforcement] Error checking feature permission:', err);
    return false;
  }
}

/**
 * Concurrency-safe atomic increment of question usage.
 * Returns true if incremented successfully, false if limit reached.
 */
async function incrementQuestionUsage(studentId) {
  try {
    const { plan } = await getStudentActivePlan(studentId);
    const limit = plan.question_limit; // could be null (unlimited)

    const { data: success, error } = await supabase
      .rpc('increment_question_usage', {
        p_student_id: studentId,
        p_limit: limit
      });

    if (error) throw error;
    return success;
  } catch (err) {
    logger.error('[UsageEnforcement] Error calling increment_question_usage RPC:', err);
    // fallback safe check in case RPC fails/doesn't exist
    return false;
  }
}

/**
 * Concurrency-safe atomic increment of mock test usage.
 * Returns true if incremented successfully, false if limit reached.
 */
async function incrementMockTestUsage(studentId) {
  try {
    const { plan } = await getStudentActivePlan(studentId);
    const limit = plan.mock_test_limit; // could be null (unlimited)

    const { data: success, error } = await supabase
      .rpc('increment_mock_test_usage', {
        p_student_id: studentId,
        p_limit: limit
      });

    if (error) throw error;
    return success;
  } catch (err) {
    logger.error('[UsageEnforcement] Error calling increment_mock_test_usage RPC:', err);
    return false;
  }
}

module.exports = {
  getStudentActivePlan,
  getStudentUsageAndLimits,
  checkFeaturePermission,
  incrementQuestionUsage,
  incrementMockTestUsage
};
