'use strict';

const express  = require('express');
const router   = express.Router();
const { requireAdmin } = require('../middleware/rbac');
const { listWalkins, createWalkin, updateWalkin, deleteWalkin } = require('../controllers/walkins.controller');

// Public
router.get('/', listWalkins);

// Admin
router.post('/',    requireAdmin, createWalkin);
router.put('/:id',  requireAdmin, updateWalkin);
router.delete('/:id', requireAdmin, deleteWalkin);

module.exports = router;
