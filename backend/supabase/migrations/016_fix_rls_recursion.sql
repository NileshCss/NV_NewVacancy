-- ============================================================
-- MIGRATION 016: FIX RLS INFINITE RECURSION ON JOBS/PROFILES
-- Root cause: is_admin() queries profiles → profiles RLS calls
-- is_admin() → infinite recursion → 30 s timeout on any
-- INSERT/UPDATE/DELETE on jobs, news, affiliates.
--
-- Fix strategy:
--   1. Rewrite is_admin() to use ONLY auth.jwt() — zero DB queries,
--      zero recursion risk.
--   2. Set the Supabase custom claim 'app_role' via a trigger on
--      profiles so the JWT always carries the current role.
--   3. Drop & recreate all jobs/news/affiliates/profiles RLS policies
--      to use the new, safe is_admin().
-- ============================================================

-- ── STEP 1: New bulletproof is_admin() ──────────────────────────
-- Reads ONLY from auth.jwt() — no table scan, no recursion.
-- Falls back to profiles query using SECURITY DEFINER (postgres owner
-- bypasses RLS automatically in Supabase).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    CASE
      -- Hard-coded super admin always wins
      WHEN auth.jwt() ->> 'email' = 'rajputnileshsingh3@gmail.com' THEN true
      -- Check custom claim first (fast path — no DB query)
      WHEN coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '') IN ('admin', 'super_admin') THEN true
      -- Fallback: read profiles. SECURITY DEFINER runs as postgres
      -- (superuser) so RLS is bypassed — no recursion.
      ELSE coalesce(
        (
          SELECT role IN ('admin', 'super_admin') AND NOT coalesce(is_blocked, false)
          FROM public.profiles
          WHERE id = auth.uid()
          LIMIT 1
        ),
        false
      )
    END
$$;

-- Keep existing grants
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ── STEP 2: Trigger to write app_role into auth metadata ─────────
-- This makes future JWT tokens carry the role so the fast-path fires.
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('app_role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.profiles;
CREATE TRIGGER trg_sync_profile_role
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_to_auth();

-- ── STEP 3: Rebuild JOBS policies cleanly ─────────────────────────
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select"                 ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert"                 ON public.jobs;
DROP POLICY IF EXISTS "jobs_update"                 ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete"                 ON public.jobs;
DROP POLICY IF EXISTS "Anyone can view active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"      ON public.jobs;

-- Public can read active jobs; admins see all
CREATE POLICY "jobs_select" ON public.jobs FOR SELECT
  USING (is_active = true OR public.is_admin());

-- Only admins can insert / update / delete
CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "jobs_delete" ON public.jobs FOR DELETE
  USING (public.is_admin());

GRANT SELECT                         ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;

-- ── STEP 4: Rebuild NEWS policies ─────────────────────────────────
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_select" ON public.news;
DROP POLICY IF EXISTS "news_insert" ON public.news;
DROP POLICY IF EXISTS "news_update" ON public.news;
DROP POLICY IF EXISTS "news_delete" ON public.news;
DROP POLICY IF EXISTS "Anyone can view active news"  ON public.news;
DROP POLICY IF EXISTS "Admins can manage news"       ON public.news;

CREATE POLICY "news_select" ON public.news FOR SELECT
  USING (is_active = true OR public.is_admin());
CREATE POLICY "news_insert" ON public.news FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "news_update" ON public.news FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "news_delete" ON public.news FOR DELETE
  USING (public.is_admin());

GRANT SELECT                         ON public.news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;

-- ── STEP 5: Rebuild AFFILIATES policies ───────────────────────────
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliates_select" ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_insert" ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_update" ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_delete" ON public.affiliates;
DROP POLICY IF EXISTS "Anyone can view active affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Admins can manage affiliates"      ON public.affiliates;

CREATE POLICY "affiliates_select" ON public.affiliates FOR SELECT
  USING (is_active = true OR public.is_admin());
CREATE POLICY "affiliates_insert" ON public.affiliates FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "affiliates_update" ON public.affiliates FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "affiliates_delete" ON public.affiliates FOR DELETE
  USING (public.is_admin());

GRANT SELECT                         ON public.affiliates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliates TO authenticated;

-- ── STEP 6: Rebuild NEWS_V2 policies (used by NewsManager) ────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'news_v2'
  ) THEN
    EXECUTE 'ALTER TABLE public.news_v2 ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "news_v2_select" ON public.news_v2';
    EXECUTE 'DROP POLICY IF EXISTS "news_v2_insert" ON public.news_v2';
    EXECUTE 'DROP POLICY IF EXISTS "news_v2_update" ON public.news_v2';
    EXECUTE 'DROP POLICY IF EXISTS "news_v2_delete" ON public.news_v2';
    EXECUTE 'CREATE POLICY "news_v2_select" ON public.news_v2 FOR SELECT USING (status = ''published'' OR public.is_admin())';
    EXECUTE 'CREATE POLICY "news_v2_insert" ON public.news_v2 FOR INSERT WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY "news_v2_update" ON public.news_v2 FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY "news_v2_delete" ON public.news_v2 FOR DELETE USING (public.is_admin())';
    EXECUTE 'GRANT SELECT ON public.news_v2 TO anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_v2 TO authenticated';
  END IF;
END $$;

-- ── STEP 7: Rebuild AFFILIATES_V2 policies ────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'affiliates_v2'
  ) THEN
    EXECUTE 'ALTER TABLE public.affiliates_v2 ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "affiliates_v2_select" ON public.affiliates_v2';
    EXECUTE 'DROP POLICY IF EXISTS "affiliates_v2_insert" ON public.affiliates_v2';
    EXECUTE 'DROP POLICY IF EXISTS "affiliates_v2_update" ON public.affiliates_v2';
    EXECUTE 'DROP POLICY IF EXISTS "affiliates_v2_delete" ON public.affiliates_v2';
    EXECUTE 'CREATE POLICY "affiliates_v2_select" ON public.affiliates_v2 FOR SELECT USING (public.is_admin())';
    EXECUTE 'CREATE POLICY "affiliates_v2_insert" ON public.affiliates_v2 FOR INSERT WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY "affiliates_v2_update" ON public.affiliates_v2 FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY "affiliates_v2_delete" ON public.affiliates_v2 FOR DELETE USING (public.is_admin())';
    EXECUTE 'GRANT SELECT ON public.affiliates_v2 TO anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliates_v2 TO authenticated';
  END IF;
END $$;

-- ── STEP 8: Rebuild PROFILES policies ─────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL possibly conflicting policies from previous migrations
DROP POLICY IF EXISTS "profiles_select"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only"   ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Clean, non-recursive policies
-- SELECT: own row OR admin (is_admin() is safe because SECURITY DEFINER bypasses RLS)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- INSERT: own row only (trigger creates profile on signup)
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: own row OR admin
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- DELETE: admin only
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT                  ON public.profiles TO anon;

-- ── STEP 9: Backfill app_role into auth metadata for existing users ─
-- This ensures current admins get the fast-path on next login
UPDATE auth.users u
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('app_role', coalesce(p.role, 'user'))
FROM public.profiles p
WHERE p.id = u.id;
