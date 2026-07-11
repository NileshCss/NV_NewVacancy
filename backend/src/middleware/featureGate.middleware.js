'use strict';

const usageEnforcement = require('../services/subscription/usageEnforcement.service');

/**
 * Gate route access based on feature permissions in the active plan.
 * Bypasses checks for admins and super_admins.
 */
function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Admins bypass subscription feature checks
      if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        return next();
      }

      const hasPermission = await usageEnforcement.checkFeaturePermission(req.user.id, featureKey);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Upgrade required: ${featureKey} feature is not available on your plan.`,
          code: 'UPGRADE_REQUIRED',
          feature: featureKey
        });
      }

      next();
    } catch (err) {
      console.error('[FeatureGate] Error checking permission:', err);
      res.status(500).json({ success: false, error: 'Internal server error during authorization check' });
    }
  };
}

/**
 * Checks if the student has remaining free/plan questions.
 * If yes, it proceeds. If not, it blocks.
 */
async function checkQuestionUsage(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }

    const usageLimits = await usageEnforcement.getStudentUsageAndLimits(req.user.id);
    const limit = usageLimits.limits.questionsLimit;
    const used = usageLimits.usage.questionsUsed;

    if (limit !== null && used >= limit) {
      return res.status(403).json({
        success: false,
        error: 'Question limit reached. Please upgrade your plan to unlock more questions.',
        code: 'LIMIT_REACHED',
        limitType: 'questions',
        limit,
        used
      });
    }

    next();
  } catch (err) {
    console.error('[FeatureGate] Error checking question usage:', err);
    res.status(500).json({ success: false, error: 'Internal server error during usage check' });
  }
}

/**
 * Checks if the student has remaining mock tests.
 */
async function checkMockTestUsage(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }

    const usageLimits = await usageEnforcement.getStudentUsageAndLimits(req.user.id);
    const limit = usageLimits.limits.mockTestsLimit;
    const used = usageLimits.usage.mockTestsUsed;

    if (limit !== null && used >= limit) {
      return res.status(403).json({
        success: false,
        error: 'Mock test limit reached. Please upgrade your plan to unlock more mock tests.',
        code: 'LIMIT_REACHED',
        limitType: 'mock_tests',
        limit,
        used
      });
    }

    next();
  } catch (err) {
    console.error('[FeatureGate] Error checking mock test usage:', err);
    res.status(500).json({ success: false, error: 'Internal server error during usage check' });
  }
}

module.exports = {
  requireFeature,
  checkQuestionUsage,
  checkMockTestUsage
};
