'use strict';

const { createClient } = require('@supabase/supabase-js');

// ── Service-role client ────────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Regular client (JWT validation only) ──────────────────────────────────────
const supabaseRegular = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// IMMUTABLE CONSTANTS — never derive from DB, always from this file
// ─────────────────────────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = 'rajputnileshsingh3@gmail.com';

/**
 * Role hierarchy — higher index = more power.
 * Used to compare roles numerically.
 */
const ROLE_RANK = { user: 0, admin: 1, super_admin: 2 };

/**
 * Check if an email is the immutable super admin.
 * This is the ONLY authoritative check — never trust DB role alone for super_admin.
 */
const isSuperAdminEmail = (email) =>
  typeof email === 'string' &&
  email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

/**
 * Returns the effective role of a user:
 *   - If their email matches SUPER_ADMIN_EMAIL → always 'super_admin'
 *   - Otherwise → whatever is in the profiles table
 */
const getEffectiveRole = (profile, email) => {
  if (isSuperAdminEmail(email)) return 'super_admin';
  return profile?.role || 'user';
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: attachUser
// Validates the Bearer JWT, fetches profile, attaches req.user with role.
// ─────────────────────────────────────────────────────────────────────────────
async function attachUser(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization header missing', code: 'AUTH_REQUIRED' });
  }

  try {
    // Validate JWT against Supabase
    const { data: { user }, error: authErr } = await supabaseRegular.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'AUTH_INVALID' });
    }

    // Fetch profile (use service-role so RLS doesn't block)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, full_name, is_blocked')
      .eq('id', user.id)
      .single();

    if (profile?.is_blocked) {
      return res.status(403).json({ success: false, error: 'Account suspended', code: 'ACCOUNT_BLOCKED' });
    }

    const effectiveRole = getEffectiveRole(profile, user.email);

    req.user = {
      id:         user.id,
      email:      user.email,
      role:       effectiveRole,
      isSuperAdmin: isSuperAdminEmail(user.email),
      profile,
    };

    next();
  } catch (err) {
    console.error('[RBAC] attachUser error:', err.message);
    res.status(500).json({ success: false, error: 'Auth verification failed' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE FACTORY: authorize(allowedRoles)
// Usage: router.post('/...', attachUser, authorize(['super_admin']), handler)
// ─────────────────────────────────────────────────────────────────────────────
function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated', code: 'AUTH_REQUIRED' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`[RBAC] Access denied: ${req.user.email} (${req.user.role}) tried route requiring [${allowedRoles}]`);
      return res.status(403).json({ success: false, error: 'Access denied', code: 'FORBIDDEN' });
    }
    next();
  };
}

// Convenience shortcuts
const requireAdmin      = [attachUser, authorize(['admin', 'super_admin'])];
const requireSuperAdmin = [attachUser, authorize(['super_admin'])];

module.exports = {
  attachUser,
  authorize,
  requireAdmin,
  requireSuperAdmin,
  isSuperAdminEmail,
  getEffectiveRole,
  SUPER_ADMIN_EMAIL,
  ROLE_RANK,
  supabaseAdmin,
  supabaseRegular,
};
