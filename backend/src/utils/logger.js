'use strict';

/**
 * logger.js
 * Winston-based logger with console + rotating file transports.
 * Exported as a singleton — import anywhere with:
 *   const logger = require('../utils/logger');
 */

const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

// ── Ensure logs/ directory exists ─────────────────────────────────────────────
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ── Colour-aware console format ───────────────────────────────────────────────
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let line = `[${timestamp}] ${level}: ${message}`;
    const extra = Object.keys(meta).filter(k => k !== 'service');
    if (extra.length > 0) {
      // Pretty-print only small payloads inline; larger ones on next line
      const str = JSON.stringify(
        Object.fromEntries(extra.map(k => [k, meta[k]]))
      );
      line += str.length < 120 ? ` ${str}` : `\n  ${str}`;
    }
    return line;
  })
);

// ── JSON format for files ─────────────────────────────────────────────────────
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'newvacancy-backend' },
  transports: [
    // ── Console ───────────────────────────────────────────────────────────────
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),

    // ── Error-only file ───────────────────────────────────────────────────────
    new winston.transports.File({
      filename:  path.join(logsDir, 'error.log'),
      level:     'error',
      format:    fileFormat,
      maxsize:   5 * 1024 * 1024,  // 5 MB
      maxFiles:  5,
      tailable:  true,
    }),

    // ── Combined file ─────────────────────────────────────────────────────────
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format:   fileFormat,
      maxsize:  10 * 1024 * 1024,  // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
  ],

  // Don't exit on uncaught exceptions — let the process manager handle it
  exitOnError: false,
});

module.exports = logger;
