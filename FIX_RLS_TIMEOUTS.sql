-- ============================================================
-- FIX_RLS_TIMEOUTS.sql
-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: "Request timed out" when adding/updating jobs
-- ============================================================

-- 1. Create a fast, secure helper function to check admin status.
-- 'SECURITY DEFINER' means it bypasses RLS on the profiles table,
-- completely preventing infinite loops and timeouts.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
      AND (role IN ('admin', 'super_admin') OR email = 'rajputnileshsingh3@gmail.com')
  );
$$;

-- 2. Fix JOBS policies
DROP POLICY IF EXISTS "jobs_select_public" ON public.jobs;
CREATE POLICY "jobs_select_public" ON public.jobs
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "jobs_insert_admin" ON public.jobs;
CREATE POLICY "jobs_insert_admin" ON public.jobs
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "jobs_update_admin" ON public.jobs;
CREATE POLICY "jobs_update_admin" ON public.jobs
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "jobs_delete_admin" ON public.jobs;
CREATE POLICY "jobs_delete_admin" ON public.jobs
  FOR DELETE USING (public.is_admin());

-- 3. Fix NEWS policies
DROP POLICY IF EXISTS "news_select_public" ON public.news;
CREATE POLICY "news_select_public" ON public.news
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "news_insert_admin" ON public.news;
CREATE POLICY "news_insert_admin" ON public.news
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "news_update_admin" ON public.news;
CREATE POLICY "news_update_admin" ON public.news
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "news_delete_admin" ON public.news;
CREATE POLICY "news_delete_admin" ON public.news
  FOR DELETE USING (public.is_admin());

-- 4. Fix AFFILIATES policies
DROP POLICY IF EXISTS "aff_select_public" ON public.affiliates;
CREATE POLICY "aff_select_public" ON public.affiliates
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "aff_insert_admin" ON public.affiliates;
CREATE POLICY "aff_insert_admin" ON public.affiliates
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "aff_update_admin" ON public.affiliates;
CREATE POLICY "aff_update_admin" ON public.affiliates
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "aff_delete_admin" ON public.affiliates;
CREATE POLICY "aff_delete_admin" ON public.affiliates
  FOR DELETE USING (public.is_admin());

-- 5. Fix PROFILES policies to be safe and simple
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');
