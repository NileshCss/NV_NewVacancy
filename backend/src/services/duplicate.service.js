'use strict';

/**
 * duplicate.service.js
 * Thin pipeline wrapper over duplicateDetector.service.js.
 * Called in the publish pipeline before DB insert.
 */

const { checkDuplicate, isUrlAlreadySaved } = require('../ai/duplicateDetector.service');

/**
 * Full duplicate check pipeline.
 * Runs URL check first (cheap), then fuzzy match (DB-intensive).
 *
 * @param {object} jobData          - Extracted job data
 * @param {string} [sourceUrl]      - Original URL of the job
 * @returns {Promise<{isDuplicate:boolean, reason:string, matches:Array}>}
 */
async function runDuplicateCheck(jobData, sourceUrl = '') {
  // Step 1: Exact URL match (cheapest check)
  if (sourceUrl) {
    const urlExists = await isUrlAlreadySaved(sourceUrl);
    if (urlExists) {
      return {
        isDuplicate: true,
        reason:      'Exact source URL already in database',
        matches:     [],
      };
    }
  }

  // Step 2: Fuzzy match by title + company + location
  const { isDuplicate, matches, bestScore } = await checkDuplicate({
    jobTitle:  jobData.jobTitle,
    company:   jobData.company,
    location:  jobData.location,
  });

  if (isDuplicate) {
    return {
      isDuplicate: true,
      reason:      `Similar job found (similarity: ${Math.round(bestScore * 100)}%)`,
      matches,
    };
  }

  return { isDuplicate: false, reason: null, matches: [] };
}

module.exports = { runDuplicateCheck };
