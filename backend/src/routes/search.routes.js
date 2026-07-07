'use strict';

const express = require('express');
const router  = express.Router();
const { search, trending } = require('../controllers/search.controller');

router.get('/',          search);
router.get('/trending',  trending);

module.exports = router;
