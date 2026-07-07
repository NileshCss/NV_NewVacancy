'use strict';

const express = require('express');
const router  = express.Router();
const { listJobs, getJobBySlug, getSimilar, trackApply } = require('../controllers/jobs.controller');

router.get('/',           listJobs);
router.get('/:slug',      getJobBySlug);
router.get('/:id/similar', getSimilar);
router.post('/:id/apply', trackApply);

module.exports = router;
