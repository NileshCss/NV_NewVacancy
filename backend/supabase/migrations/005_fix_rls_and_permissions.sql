-- ============================================================
-- MIGRATION 005: FIX RLS INFINITE RECURSION + GRANT PERMISSIONS
-- ============================================================
-- Run this ENTIRE script in Supabase SQL Editor → Run
-- This fixes the "admin cannot insert/update/delete" issue
-- ============================================================

-- ── Step 1: Drop ALL existing RLS policies on profiles ────────
-- (They may be causing infinite recursion via is_admin())
DROP POLICY IF EXISTS "profiles_select_own_or_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_policy"           ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.profiles;

-- ── Step 2: Re-create is_admin() with SECURITY DEFINER ───────
-- Uses a direct join to avoid RLS policy recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' AND is_blocked = FALSE
     FROM public.profiles
     WHERE id = auth.uid()
     LIMIT 1),
    FALSE
  );
$$;

-- ── Step 3: Re-create clean profiles policies ─────────────────
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- Admins can insert (for new user creation edge cases)
CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_delete"
ON public.profiles FOR DELETE
USING (public.is_admin());

-- ── Step 4: Drop + recreate jobs policies cleanly ─────────────
DROP POLICY IF EXISTS "Anyone can view active jobs"  ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"       ON public.jobs;
DROP POLICY IF EXISTS "jobs_public_read_active"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_insert"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_delete"            ON public.jobs;

CREATE POLICY "jobs_select" ON public.jobs FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "jobs_delete" ON public.jobs FOR DELETE USING (public.is_admin());

-- ── Step 5: Drop + recreate news policies cleanly ─────────────
DROP POLICY IF EXISTS "Anyone can view active news"  ON public.news;
DROP POLICY IF EXISTS "Admins can manage news"       ON public.news;
DROP POLICY IF EXISTS "news_public_read_active"      ON public.news;
DROP POLICY IF EXISTS "news_admin_insert"            ON public.news;
DROP POLICY IF EXISTS "news_admin_update"            ON public.news;
DROP POLICY IF EXISTS "news_admin_delete"            ON public.news;

CREATE POLICY "news_select" ON public.news FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "news_insert" ON public.news FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "news_update" ON public.news FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "news_delete" ON public.news FOR DELETE USING (public.is_admin());

-- ── Step 6: Drop + recreate affiliates policies cleanly ───────
DROP POLICY IF EXISTS "Anyone can view active affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Admins can manage affiliates"      ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_public_read_active"     ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_admin_insert"           ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_admin_update"           ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_admin_delete"           ON public.affiliates;

CREATE POLICY "affiliates_select" ON public.affiliates FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "affiliates_insert" ON public.affiliates FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "affiliates_update" ON public.affiliates FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "affiliates_delete" ON public.affiliates FOR DELETE USING (public.is_admin());

-- ── Step 7: Grant permissions to authenticated role ───────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliates  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles    TO authenticated;
GRANT SELECT                         ON public.jobs        TO anon;
GRANT SELECT                         ON public.news        TO anon;
GRANT SELECT                         ON public.affiliates  TO anon;

-- ── Step 8: Add 'clicks' as alias column if needed ───────────
-- The affiliates table uses 'click_count' but API sends 'clicks'
-- This adds a 'clicks' generated column for backwards compat
-- (Skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliates' AND column_name = 'clicks'
  ) THEN
    ALTER TABLE public.affiliates ADD COLUMN clicks INTEGER DEFAULT 0;
  END IF;
END $$;

-- ── Step 9: Verify your admin account ────────────────────────
-- After running this, check your admin status:
-- SELECT id, email, role, is_blocked FROM public.profiles WHERE email = 'your-email@example.com';
-- If role is not 'admin', run:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
