'use strict';

const express = require('express');
const router = express.Router();
const mockTestsController = require('../../controllers/exam/mockTests.controller');
const studentMockTestsController = require('../../controllers/exam/studentMockTests.controller');
const { requireAdmin, attachUser } = require('../../middleware/rbac');

// ── Student-Facing Routes (Require Auth) ──────────────────────────────────────
router.get('/student/list',                             attachUser, studentMockTestsController.listMockTests);
router.get('/student/:id/detail',                       attachUser, studentMockTestsController.getMockTest);
router.post('/student/:id/start',                       attachUser, studentMockTestsController.startMockTestAttempt);
router.post('/student/attempts/:attemptId/save-answer', attachUser, studentMockTestsController.saveMockTestAnswer);
router.post('/student/attempts/:attemptId/tab-switch',  attachUser, studentMockTestsController.logTabSwitch);
router.post('/student/attempts/:attemptId/submit',      attachUser, studentMockTestsController.submitMockTest);
router.get('/student/attempts/:attemptId/result',       attachUser, studentMockTestsController.getMockTestResult);
router.get('/student/:id/leaderboard',                  attachUser, studentMockTestsController.getMockTestLeaderboard);

// ── Admin-only routes (List & Create) ──────────────────────────────────────────
router.get('/',    requireAdmin, mockTestsController.listMockTests);
router.post('/',   requireAdmin, mockTestsController.createMockTest);

// ── Single Test ────────────────────────────────────────────────────────────────
router.get('/:id',      requireAdmin, mockTestsController.getMockTest);
router.patch('/:id',    requireAdmin, mockTestsController.updateMockTest);
router.delete('/:id',   requireAdmin, mockTestsController.deleteMockTest);

// ── Publish ────────────────────────────────────────────────────────────────────
router.post('/:id/publish', requireAdmin, mockTestsController.publishMockTest);

// ── Question Management ────────────────────────────────────────────────────────
router.post('/:id/questions',              requireAdmin, mockTestsController.addQuestion);
router.delete('/:id/questions/:qid',       requireAdmin, mockTestsController.removeQuestion);
router.patch('/:id/questions/reorder',     requireAdmin, mockTestsController.reorderQuestions);

// ── Question Generation ────────────────────────────────────────────────────────
router.post('/:id/random-generate', requireAdmin, mockTestsController.generateRandomQuestions);
router.post('/:id/ai-suggest',      requireAdmin, mockTestsController.aiSuggestQuestions);

module.exports = router;
