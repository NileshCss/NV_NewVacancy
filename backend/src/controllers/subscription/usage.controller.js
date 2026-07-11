'use strict';

const usageEnforcement = require('../../services/subscription/usageEnforcement.service');
const logger = require('../../utils/logger');

// GET /api/subscription/usage - Get student usage and limits
exports.getUsage = async (req, res) => {
  try {
    const studentId = req.user.id;
    const usage = await usageEnforcement.getStudentUsageAndLimits(studentId);
    res.json({ success: true, data: usage });
  } catch (err) {
    logger.error('[UsageController] Error fetching usage:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/usage/increment-questions - Increment question count
exports.incrementQuestions = async (req, res) => {
  try {
    const studentId = req.user.id;
    const success = await usageEnforcement.incrementQuestionUsage(studentId);
    
    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Limit reached: Cannot answer more questions on your current plan.',
        code: 'LIMIT_REACHED'
      });
    }

    const updatedUsage = await usageEnforcement.getStudentUsageAndLimits(studentId);
    res.json({ success: true, message: 'Question usage incremented', data: updatedUsage });
  } catch (err) {
    logger.error('[UsageController] Error incrementing questions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/subscription/usage/increment-mock-tests - Increment mock test count
exports.incrementMockTests = async (req, res) => {
  try {
    const studentId = req.user.id;
    const success = await usageEnforcement.incrementMockTestUsage(studentId);

    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Limit reached: Cannot start more mock tests on your current plan.',
        code: 'LIMIT_REACHED'
      });
    }

    const updatedUsage = await usageEnforcement.getStudentUsageAndLimits(studentId);
    res.json({ success: true, message: 'Mock test usage incremented', data: updatedUsage });
  } catch (err) {
    logger.error('[UsageController] Error incrementing mock tests:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
