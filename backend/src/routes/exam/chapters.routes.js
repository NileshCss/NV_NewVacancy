'use strict';

const express = require('express');
const router = express.Router();
const chaptersController = require('../../controllers/exam/chapters.controller');
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

router.get('/', softAuth, chaptersController.listChapters);

router.post('/', requireAdmin, chaptersController.createChapter);
router.patch('/reorder', requireAdmin, chaptersController.reorderChapters);
router.patch('/:id', requireAdmin, chaptersController.updateChapter);
router.delete('/:id', requireAdmin, chaptersController.deleteChapter);

module.exports = router;
