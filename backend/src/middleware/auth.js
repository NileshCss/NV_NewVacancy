'use strict';
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');

/**
 * JWT Authentication middleware
 * Verifies Bearer token from Authorization header
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error:   'Authentication required',
        code:    'AUTH_REQUIRED',
      });
    }

    const token = header.slice(7);

    // Try Supabase JWT first
    const { data: { user }, error } =
      await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = { id: user.id, email: user.email };
      return next();
    }

    // Fallback: local JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub || decoded.id, email: decoded.email };
    next();

  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({
      success: false,
      error:   'Invalid or expired token',
      code:    'AUTH_INVALID',
    });
  }
}

/**
 * Optional auth — continues without user if no token
 */
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    await authenticate(req, res, next);
  } catch {
    req.user = null;
    next();
  }
}

/**
 * Admin-only middleware
 */
async function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false, error: 'Authentication required', code: 'AUTH_REQUIRED'
      });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return res.status(403).json({
        success: false, error: 'Admin access required', code: 'FORBIDDEN'
      });
    }
    next();
  } catch (err) {
    console.error('[Auth][requireAdmin]', err.message);
    res.status(500).json({ success: false, error: 'Auth check failed' });
  }
}

module.exports = { authenticate, optionalAuth, requireAdmin };
