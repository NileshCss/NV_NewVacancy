'use strict';

const express = require('express');
const router = express.Router();
const examsController = require('../../controllers/exam/exams.controller');
const { requireAdmin, attachUser } = require('../../middleware/rbac');

// Public (with optional admin token extraction via attachUser if we want admin to see draft)
// If we attachUser here but don't requireAdmin, we can check req.user in the controller.
// Currently attachUser throws if no token, so we need a soft auth for public routes.
// Let's create a wrapper or just use the controller's internal check if we had a soft token parse.
// Since attachUser blocks if no token, we either bypass it or create an optional token parser.
// Actually, `attachUser` returns 401 if NO token. For a public route, we don't want that.
// Let's just use the controller without auth for public list, and let it return published only.
// If an admin wants to see all exams in the admin panel, we can use a separate route or a soft auth.
// But the RLS lets admin see all. If the admin calls this endpoint without token, they see published.
// For the admin panel to see drafts, we'll create a specific admin route.

// --- Soft Auth Helper inline for public routes ---
const { supabaseRegular, supabaseAdmin, getEffectiveRole, isSuperAdminEmail } = require('../../middleware/rbac');
const softAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return next();
  try {
    const { data: { user } } = await supabaseRegular.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
      req.user = { id: user.id, email: user.email, role: getEffectiveRole(profile, user.email) };
    }
  } catch (err) {}
  next();
};

// Public
router.get('/', softAuth, examsController.listExams);
router.get('/:slug', softAuth, examsController.getExam);

// Admin only
router.post('/', requireAdmin, examsController.createExam);
router.patch('/:id', requireAdmin, examsController.updateExam);
router.delete('/:id', requireAdmin, examsController.deleteExam);
router.patch('/:id/publish', requireAdmin, examsController.publishExam);
router.patch('/:id/archive', requireAdmin, examsController.archiveExam);

module.exports = router;
