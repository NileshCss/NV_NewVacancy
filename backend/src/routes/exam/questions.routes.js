'use strict';

const express = require('express');
const router = express.Router();
const questionsController = require('../../controllers/exam/questions.controller');
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

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Public/Admin list & view
router.get('/', softAuth, questionsController.listQuestions);
router.get('/:id', softAuth, questionsController.getQuestion);

// Admin-only management
router.post('/', requireAdmin, questionsController.createQuestion);
router.patch('/:id', requireAdmin, questionsController.updateQuestion);
router.patch('/:id/status', requireAdmin, questionsController.updateQuestionStatus);
router.delete('/:id', requireAdmin, questionsController.deleteQuestion);
router.post('/bulk-import', requireAdmin, questionsController.bulkImportCsv);
router.post('/extract-ai', requireAdmin, questionsController.extractQuestionsAI);
router.post('/import-file', requireAdmin, upload.single('file'), questionsController.importFile);

module.exports = router;
