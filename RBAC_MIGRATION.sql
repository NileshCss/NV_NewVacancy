-- ============================================================
-- RBAC_MIGRATION.sql  —  NewVacancy
-- Run the full file in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 0. Role column constraint ──────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- Ensure your account is super_admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'rajputnileshsingh3@gmail.com';

-- ── 1. Protect super_admin trigger ────────────────────────
CREATE OR REPLACE FUNCTION protect_super_admin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Block downgrading super admin
  IF OLD.email = 'rajputnileshsingh3@gmail.com' AND NEW.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Super admin role is immutable';
  END IF;
  -- Block anyone else getting super_admin
  IF NEW.email <> 'rajputnileshsingh3@gmail.com' AND NEW.role = 'super_admin' THEN
    RAISE EXCEPTION 'Only rajputnileshsingh3@gmail.com can hold the super_admin role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_super_admin ON public.profiles;
CREATE TRIGGER enforce_super_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION protect_super_admin();


-- ============================================================
-- ── 2. PROFILES RLS  (THE CRITICAL MISSING PIECE)  ─────────
-- Without these, admins can only read their OWN profile row.
-- After promoting a user to admin, the super_admin's fetchUsers
-- query can no longer see that row, so promoted users "disappear".
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2a. SELECT: users see their own row; admins/super_admin see ALL rows
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    -- own row
    auth.uid() = id
    OR
    -- admin / super_admin can read everyone
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'super_admin')
          OR p.email = 'rajputnileshsingh3@gmail.com'
        )
    )
  );

-- 2b. INSERT: only service_role (Supabase auto-creates profile on signup via trigger)
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    OR auth.role() = 'service_role'
  );

-- 2c. UPDATE: users update their own; super_admin can update role of any user
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    -- own row (name, avatar, etc.)
    auth.uid() = id
    OR
    -- super_admin can update any profile (role changes, block/unblock)
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR p.email = 'rajputnileshsingh3@gmail.com'
        )
    )
    OR
    -- admin can block/unblock regular users (but NOT change roles — trigger prevents that)
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- 2d. DELETE: super_admin can delete any profile; admins can delete only users
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR p.email = 'rajputnileshsingh3@gmail.com'
        )
    )
    OR (
      -- admin can delete regular users only
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
      )
      AND (
        SELECT role FROM public.profiles WHERE id = profiles.id
      ) = 'user'
    )
  );


-- ============================================================
-- ── 3. JOBS RLS ─────────────────────────────────────────────
-- Public read; admin/super_admin can write.
-- ============================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Public can read active jobs
DROP POLICY IF EXISTS "jobs_select_public" ON public.jobs;
CREATE POLICY "jobs_select_public" ON public.jobs
  FOR SELECT USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
  ));

DROP POLICY IF EXISTS "jobs_insert_admin" ON public.jobs;
CREATE POLICY "jobs_insert_admin" ON public.jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "jobs_update_admin" ON public.jobs;
CREATE POLICY "jobs_update_admin" ON public.jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "jobs_delete_admin" ON public.jobs;
CREATE POLICY "jobs_delete_admin" ON public.jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );


-- ============================================================
-- ── 4. NEWS RLS ─────────────────────────────────────────────
-- ============================================================

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_select_public" ON public.news;
CREATE POLICY "news_select_public" ON public.news
  FOR SELECT USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
  ));

DROP POLICY IF EXISTS "news_insert_admin" ON public.news;
CREATE POLICY "news_insert_admin" ON public.news
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "news_update_admin" ON public.news;
CREATE POLICY "news_update_admin" ON public.news
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "news_delete_admin" ON public.news;
CREATE POLICY "news_delete_admin" ON public.news
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );


-- ============================================================
-- ── 5. AFFILIATES RLS ───────────────────────────────────────
-- ============================================================

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aff_select_public" ON public.affiliates;
CREATE POLICY "aff_select_public" ON public.affiliates
  FOR SELECT USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
  ));

DROP POLICY IF EXISTS "aff_insert_admin" ON public.affiliates;
CREATE POLICY "aff_insert_admin" ON public.affiliates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "aff_update_admin" ON public.affiliates;
CREATE POLICY "aff_update_admin" ON public.affiliates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "aff_delete_admin" ON public.affiliates;
CREATE POLICY "aff_delete_admin" ON public.affiliates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );


-- ============================================================
-- ── 6. VERIFY ───────────────────────────────────────────────
-- Run these after to confirm everything is correct:
-- ============================================================

-- Check your role:
-- SELECT id, email, role FROM public.profiles WHERE email = 'rajputnileshsingh3@gmail.com';

-- Check all RLS policies on profiles:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';

-- List all users (confirm no role filter):
-- SELECT id, email, role, is_blocked, created_at FROM public.profiles ORDER BY created_at DESC;
