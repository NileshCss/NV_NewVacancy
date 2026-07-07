'use strict';

/**
 * assistant.routes.js
 * AI conversational job search assistant.
 *
 * POST /api/assistant/chat  — natural-language query → jobs + reply
 * GET  /api/assistant/health — check Ollama status
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const { chat }   = require('../ai/assistant.service');
const { checkHealth } = require('../ai/ollamaClient');

// 20 requests per minute per IP
const assistantLimit = rateLimit({
  windowMs:  60 * 1000,
  max:        20,
  message:   { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// POST /api/assistant/chat
router.post('/chat', assistantLimit, async (req, res) => {
  const { query, history = [] } = req.body;

  if (!query?.trim()) {
    return res.status(400).json({ success: false, error: 'query is required' });
  }

  try {
    const result = await chat(query.trim(), history);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[AssistantRoute] chat error:', err.message);
    res.status(500).json({ success: false, error: 'Assistant is temporarily unavailable' });
  }
});

// GET /api/assistant/health
router.get('/health', async (req, res) => {
  try {
    const health = await checkHealth();
    res.json({ success: true, ...health });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

module.exports = router;
