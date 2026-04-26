'use strict';
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');

const smartmatchRoutes = require('./routes/smartmatch.routes');
const adminRoutes      = require('./routes/admin.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ──────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ── Request logging ──────────────────────────────────
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));

// ── Body parsers ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────
app.use('/api/smartmatch', smartmatchRoutes);
app.use('/api/admin',      adminRoutes);

// ── Health check ──────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'SmartMatch™ Engine',
    version: '2.0.0',
    time:    new Date().toISOString(),
  });
});

// ── 404 handler ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
  });
});

// ── Global error handler ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error:   'Internal server error',
    code:    'SERVER_ERROR',
  });
});

// ── Start server ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] SmartMatch™ Engine running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
