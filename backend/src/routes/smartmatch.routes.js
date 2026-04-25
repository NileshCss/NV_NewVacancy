'use strict';
const express       = require('express');
const router        = express.Router();
const supabase      = require('../config/supabase');
const { runSmartMatch }      = require('../engines/smartmatch');
const { handleUpload }       = require('../middleware/upload');
const { optionalAuth }       = require('../middleware/auth');
const { analysisRateLimit }  = require('../middleware/rateLimit');

/**
 * POST /api/smartmatch/analyze
 * Full resume analysis — works for ANY resume type
 * Supports authenticated + guest users
 */
router.post(
  '/analyze',
  handleUpload,
  optionalAuth,
  analysisRateLimit,
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { file }    = req;
      const userId      = req.user?.id || 'guest';
      const jobDesc     = req.body.job_description || null;
      const mode        = req.body.mode || 'full';

      // Validate mode
      const validModes = ['full','ats_only','job_match','skill_gap','rewrite'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          success: false,
          error:   `Invalid mode. Choose: ${validModes.join(', ')}`,
          code:    'INVALID_MODE',
        });
      }

      // Run SmartMatch™ engine
      const result = await runSmartMatch(
        file.buffer,
        file.mimetype,
        file.originalname,
        jobDesc,
        userId,
        mode
      );

      // Save to Supabase if user is authenticated
      if (req.user?.id && result.ats?.score) {
        try {
          await supabase.from('resume_analyses').insert({
            user_id:           req.user.id,
            file_name:         file.originalname,
            file_hash:         result._meta?.fileHash,
            ats_score:         result.ats.score,
            grade:             result.ats.grade,
            full_result:       result,
            processing_time_ms: Date.now() - startTime,
          });
        } catch (dbErr) {
          // Non-fatal — log but don't fail the response
          console.warn('[SmartMatch] DB save failed:', dbErr.message);
        }
      }

      return res.json({
        success: true,
        data:    result,
      });

    } catch (err) {
      console.error('[SmartMatch][/analyze]', err.message);

      // User-friendly error messages
      const userMessage =
        err.message.includes('API') || err.message.includes('AI')
          ? 'Analysis service temporarily unavailable. Please try again.'
          : err.message.includes('PDF') || err.message.includes('DOCX')
          ? err.message
          : err.message.includes('resume')
          ? err.message
          : 'Analysis failed. Please try again.';

      return res.status(500).json({
        success: false,
        error:   userMessage,
        code:    'ANALYSIS_FAILED',
      });
    }
  }
);

/**
 * GET /api/smartmatch/history
 * Get user's past analyses (auth required)
 */
router.get('/history', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('resume_analyses')
      .select('id, file_name, ats_score, grade, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.json({ success: true, data: data || [] });

  } catch (err) {
    console.error('[SmartMatch][/history]', err.message);
    return res.status(500).json({
      success: false, error: 'Failed to fetch history'
    });
  }
});

/**
 * GET /api/smartmatch/result/:id
 * Get a specific analysis result
 */
router.get('/result/:id', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('resume_analyses')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user?.id || '')
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false, error: 'Analysis not found'
      });
    }

    return res.json({ success: true, data: data.full_result });

  } catch (err) {
    console.error('[SmartMatch][/result/:id]', err.message);
    return res.status(500).json({ success: false, error: 'Fetch failed' });
  }
});

module.exports = router;
