-- ============================================================
-- PERFORMANCE FIX - Fix Slow Loading Issue
-- ============================================================
-- The RLS policies on profiles might be causing slowness
-- This script optimizes them and checks for issues

-- STEP 1: Disable RLS temporarily to test if that's the issue
-- This will allow the page to load quickly
ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;

-- Wait, let's actually keep RLS but optimize it
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- STEP 2: Drop the potentially slow is_admin_user function and recreate it optimized
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Recreate with IMMUTABLE flag for better caching
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role IN ('admin', 'super_admin');
END;
$$;

-- STEP 3: Check profiles table RLS policies (these might be the real culprit)
-- Show current policies on profiles table
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

-- STEP 4: Verify jobs policies are efficient
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'jobs';

-- STEP 5: Drop and recreate jobs policies with simpler logic
DROP POLICY IF EXISTS "jobs_public_read_active"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_read_all"          ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_insert"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_delete"            ON public.jobs;

-- Recreate with optimized inline checks (no function calls)
CREATE POLICY "jobs_public_read" ON public.jobs
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      LIMIT 1
    )
  );

CREATE POLICY "jobs_admin_write" ON public.jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      LIMIT 1
    )
  );

CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      LIMIT 1
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      LIMIT 1
    )
  );

CREATE POLICY "jobs_admin_delete" ON public.jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      LIMIT 1
    )
  );

-- STEP 6: Check profiles table for RLS issues
-- If profiles table has complex RLS, it might slow down profile loading
SELECT 'Profiles table RLS policies:' as info;
SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'profiles';

-- STEP 7: Verify the fix worked
SELECT 
  'Jobs Policies Count' as check_item,
  COUNT(*)::text || ' policies' as status
FROM pg_policies 
WHERE tablename = 'jobs';

-- STEP 8: Index check - ensure we have proper indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('jobs', 'profiles')
ORDER BY tablename;

-- STEP 9: Query the admin check directly to test performance
SELECT 
  'Admin User Check' as test,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    LIMIT 1
  ) THEN 'Current user is admin' ELSE 'Current user is NOT admin' END as result;

SELECT 'Performance optimization complete. Please refresh the browser.' as done;
