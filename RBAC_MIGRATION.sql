-- ============================================================
-- RBAC Migration: Strict Role Hierarchy
-- NewVacancy — Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Add/update role column on profiles ──────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- ── 2. Lock in the super admin (immutable) ─────────────────
--    This runs once. The backend ALSO enforces this via email check,
--    so even if someone updates the DB row, the backend ignores it
--    and treats this email as super_admin regardless.
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'rajputnileshsingh3@gmail.com';

-- ── 3. Ensure super_admin cannot be downgraded via SQL directly ──
--    This trigger fires before any UPDATE on profiles.
--    It prevents any role change for the super admin email.
CREATE OR REPLACE FUNCTION protect_super_admin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Block any attempt to change the super admin's role
  IF OLD.email = 'rajputnileshsingh3@gmail.com' AND NEW.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Super admin role is immutable';
  END IF;
  -- Block any attempt to set role = super_admin for anyone else
  IF NEW.email <> 'rajputnileshsingh3@gmail.com' AND NEW.role = 'super_admin' THEN
    RAISE EXCEPTION 'Only rajputnileshsingh3@gmail.com can hold the super_admin role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_super_admin ON profiles;
CREATE TRIGGER enforce_super_admin
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_super_admin();

-- ── 4. Audit logs table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT        NOT NULL,
  performed_by TEXT        NOT NULL,  -- email of the actor
  target_user  TEXT,                  -- email or userId of the target
  meta         JSONB       DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by actor
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON audit_logs(created_at DESC);

-- ── 5. RLS Policies ─────────────────────────────────────────

-- Profiles: only the service_role (backend) can update roles.
-- Authenticated users can only update their own non-role fields (e.g. full_name).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can read all profiles (for user lists)
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON profiles;
CREATE POLICY "Profiles are readable by authenticated users"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Update: users can update their OWN profile but NOT the role column
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- The role must remain unchanged — only backend (service_role) can change it
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Role updates: ONLY via service_role (backend with SUPABASE_SERVICE_KEY)
-- The backend rbac.js middleware enforces super_admin rules on top of this.
DROP POLICY IF EXISTS "Only service role can update roles" ON profiles;
CREATE POLICY "Only service role can update roles"
  ON profiles FOR UPDATE
  USING (auth.role() = 'service_role');

-- Audit logs: only service_role can insert/read
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can write audit logs" ON audit_logs;
CREATE POLICY "Only service role can write audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can read audit logs" ON audit_logs;
CREATE POLICY "Only service role can read audit logs"
  ON audit_logs FOR SELECT
  USING (auth.role() = 'service_role');

-- ── 6. Verify ──────────────────────────────────────────────
-- Run these SELECTs to confirm setup:
-- SELECT email, role FROM profiles WHERE email = 'rajputnileshsingh3@gmail.com';
-- SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
