'use strict';

const express = require('express');
const router = express.Router();

const { attachUser, requireAdmin } = require('../middleware/rbac');

const plansController = require('../controllers/subscription/plans.controller');
const usageController = require('../controllers/subscription/usage.controller');
const sponsoredAccessController = require('../controllers/subscription/sponsoredAccess.controller');
const subscriptionsController = require('../controllers/subscription/subscriptions.controller');

// ── Plans Routes ─────────────────────────────────────────────────────────────
// Public / authenticated read
const softAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return next();
  // attachUser middleware handles user decoding
  attachUser(req, res, next).catch(() => next());
};

router.get('/plans', softAuth, plansController.listPlans);
router.post('/plans', requireAdmin, plansController.createPlan);
router.patch('/plans/:id', requireAdmin, plansController.updatePlan);
router.delete('/plans/:id', requireAdmin, plansController.deletePlan);

// ── Usage Routes ─────────────────────────────────────────────────────────────
router.get('/usage', attachUser, usageController.getUsage);
router.post('/usage/increment-questions', attachUser, usageController.incrementQuestions);
router.post('/usage/increment-mock-tests', attachUser, usageController.incrementMockTests);

// ── Sponsored Access Routes ──────────────────────────────────────────────────
router.post('/sponsored/grant', requireAdmin, sponsoredAccessController.grantAccess);
router.post('/sponsored/revoke/:id', requireAdmin, sponsoredAccessController.revokeAccess);

// ── Student Subscription Override & Reset ────────────────────────────────────
router.get('/admin/students', requireAdmin, subscriptionsController.listStudentSubscriptions);
router.post('/admin/student/override', requireAdmin, subscriptionsController.updateStudentSubscription);
router.post('/admin/student/reset-usage', requireAdmin, subscriptionsController.resetStudentUsage);
router.get('/student/current', attachUser, subscriptionsController.getCurrentSubscription);

module.exports = router;
