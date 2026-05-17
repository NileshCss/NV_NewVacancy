-- ============================================================
-- QUICK FIX: Copy this ENTIRE script into Supabase SQL Editor and click RUN
-- This fixes: "Request timed out" when saving jobs/news/affiliates
-- ============================================================

-- STEP 1: Rewrite is_admin() with row_security bypass
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result boolean := false;
  user_email text;
BEGIN
  SET LOCAL row_security = off;
  SELECT auth.jwt() ->> 'email' INTO user_email;
  IF user_email = 'rajputnileshsingh3@gmail.com' THEN
    RETURN true;
  END IF;
  SELECT (role IN ('admin', 'super_admin') AND NOT COALESCE(is_blocked, false))
    INTO result
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  RETURN COALESCE(result, false);
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- STEP 2: Drop ALL old conflicting profile policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
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

-- STEP 3: New profile policies using inline JWT (zero recursion)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
  auth.uid() = id OR public.is_admin()
);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- STEP 4: Rebuild jobs policies cleanly
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jobs_select"                  ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert"                  ON public.jobs;
DROP POLICY IF EXISTS "jobs_update"                  ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete"                  ON public.jobs;
DROP POLICY IF EXISTS "Anyone can view active jobs"  ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"       ON public.jobs;

CREATE POLICY "jobs_select" ON public.jobs FOR SELECT
  USING (is_active = true OR public.is_admin());
CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "jobs_delete" ON public.jobs FOR DELETE
  USING (public.is_admin());

GRANT SELECT ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;

-- STEP 5: Rebuild news policies
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_select" ON public.news;
DROP POLICY IF EXISTS "news_insert" ON public.news;
DROP POLICY IF EXISTS "news_update" ON public.news;
DROP POLICY IF EXISTS "news_delete" ON public.news;
DROP POLICY IF EXISTS "Anyone can view active news" ON public.news;
DROP POLICY IF EXISTS "Admins can manage news"      ON public.news;

CREATE POLICY "news_select" ON public.news FOR SELECT
  USING (is_active = true OR public.is_admin());
CREATE POLICY "news_insert" ON public.news FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "news_update" ON public.news FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "news_delete" ON public.news FOR DELETE USING (public.is_admin());

GRANT SELECT ON public.news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;

-- STEP 6: Rebuild affiliates policies
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

GRANT SELECT ON public.affiliates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliates TO authenticated;
