'use strict';

const express = require('express');
const router = express.Router();
const topicsController = require('../../controllers/exam/topics.controller');
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

router.get('/', softAuth, topicsController.listTopics);
router.get('/:id', softAuth, topicsController.getTopic);

router.post('/', requireAdmin, topicsController.createTopic);
router.patch('/reorder', requireAdmin, topicsController.reorderTopics);
router.patch('/:id', requireAdmin, topicsController.updateTopic);
router.delete('/:id', requireAdmin, topicsController.deleteTopic);

module.exports = router;
