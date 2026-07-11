'use strict';

const express = require('express');
const router = express.Router();
const subjectsController = require('../../controllers/exam/subjects.controller');
const { requireAdmin } = require('../../middleware/rbac');

const { supabaseRegular, supabaseAdmin, getEffectiveRole } = require('../../middleware/rbac');
const softAuth = async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
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
router.get('/', softAuth, subjectsController.listSubjects);

// Admin only
router.post('/', requireAdmin, subjectsController.createSubject);
router.patch('/reorder', requireAdmin, subjectsController.reorderSubjects);
router.patch('/:id', requireAdmin, subjectsController.updateSubject);
router.delete('/:id', requireAdmin, subjectsController.deleteSubject);

module.exports = router;
