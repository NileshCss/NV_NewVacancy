'use strict';

// Always load backend/.env regardless of invocation directory
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');

const smartmatchRoutes = require('./routes/smartmatch.routes');
const adminRoutes      = require('./routes/admin.routes');
const whatsappRoutes   = require('./routes/whatsapp.routes');
const whatsappService  = require('./services/whatsappService');
const logger           = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ── Request logging ──────────────────────────────────────────────────────────
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/smartmatch', smartmatchRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/whatsapp',   whatsappRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:   'ok',
    service:  'NewVacancy Backend',
    version:  '2.1.0',
    time:     new Date().toISOString(),
    whatsapp: whatsappService.getStatus(),
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('[Server] Unhandled error', { error: err.message });
  res.status(500).json({
    success: false,
    error:   'Internal server error',
    code:    'SERVER_ERROR',
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
async function startServer() {
  // WhatsApp init is non-blocking — HTTP server starts regardless
  if (process.env.WHATSAPP_ENABLED === 'true') {
    whatsappService.initialize().catch(err =>
      logger.error('[Server] WhatsApp init error (non-fatal)', { error: err.message })
    );
  }

  app.listen(PORT, () => {
    logger.info(`[Server] NewVacancy Backend running on port ${PORT}`);
    logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[Server] WhatsApp:    ${process.env.WHATSAPP_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
    console.log(`\n🚀  NewVacancy API  →  http://localhost:${PORT}`);
    console.log(`📱  WhatsApp: ${process.env.WHATSAPP_ENABLED === 'true' ? 'initialising…' : 'disabled'}\n`);
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`[Server] ${signal} — shutting down gracefully…`);
  await whatsappService.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

startServer();

module.exports = app;
