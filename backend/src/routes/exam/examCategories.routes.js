'use strict';

const express = require('express');
const router = express.Router();
const examCategoriesController = require('../../controllers/exam/examCategories.controller');
const { requireAdmin } = require('../../middleware/rbac');

// Public
router.get('/', examCategoriesController.listCategories);
router.get('/:slug', examCategoriesController.getCategory);

// Admin only
router.post('/', requireAdmin, examCategoriesController.createCategory);
router.patch('/:id', requireAdmin, examCategoriesController.updateCategory);
router.delete('/:id', requireAdmin, examCategoriesController.deleteCategory);

module.exports = router;
