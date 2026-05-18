-- ============================================================
-- COMPREHENSIVE FIX - NEW VACANCY JOB POSTING SYSTEM
-- ============================================================
-- This script is PRODUCTION-READY and idempotent (safe to run multiple times)
-- It fixes all issues with the Post New Vacancy form:
--   1. Adds experience column to jobs table
--   2. Fixes RLS policies for admin/super_admin access
--   3. Ensures all tables have proper permissions
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ============================================================

-- ============================================================
-- PHASE 1: ADD EXPERIENCE COLUMN
-- ============================================================

-- Add experience column if it doesn't exist
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS experience TEXT;

-- Add helpful comment
COMMENT ON COLUMN public.jobs.experience IS 'Required experience for the job (e.g., "0-2 years", "3-5 years", "5+ years")';

-- ============================================================
-- PHASE 2: CREATE ADMIN HELPER FUNCTION
-- ============================================================

-- This function safely checks if current user is admin/super_admin
-- Using SECURITY DEFINER allows it to work even under strict RLS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- PHASE 3: RESET JOBS TABLE RLS POLICIES
-- ============================================================

-- Drop all old job policies
DROP POLICY IF EXISTS "jobs_select_active"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_all_admin"        ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_public"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_admin"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_admin"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin"            ON public.jobs;
DROP POLICY IF EXISTS "auth_insert_jobs"             ON public.jobs;
DROP POLICY IF EXISTS "auth_update_jobs"             ON public.jobs;
DROP POLICY IF EXISTS "auth_delete_jobs"             ON public.jobs;
DROP POLICY IF EXISTS "Public can view active jobs"  ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"       ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_all"               ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_public"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_public"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_public"           ON public.jobs;

-- Enable RLS (should already be enabled, but ensure it)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PHASE 4: CREATE NEW JOBS RLS POLICIES
-- ============================================================

-- Policy 1: Public can read ACTIVE jobs
CREATE POLICY "jobs_public_read_active" ON public.jobs
  FOR SELECT
  USING (is_active = true);

-- Policy 2: Admins can read ALL jobs (active and inactive)
CREATE POLICY "jobs_admin_read_all" ON public.jobs
  FOR SELECT
  USING (public.is_admin_user());

-- Policy 3: Only admins can INSERT jobs
CREATE POLICY "jobs_admin_insert" ON public.jobs
  FOR INSERT
  WITH CHECK (public.is_admin_user());

-- Policy 4: Only admins can UPDATE jobs
CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin_user());

-- Policy 5: Only admins can DELETE jobs
CREATE POLICY "jobs_admin_delete" ON public.jobs
  FOR DELETE
  USING (public.is_admin_user());

-- ============================================================
-- PHASE 5: ENSURE SUPER ADMIN ROLE EXISTS
-- ============================================================

-- Make absolutely sure super admin has the correct role
UPDATE public.profiles
SET role = 'super_admin', updated_at = NOW()
WHERE email = 'rajputnileshsingh3@gmail.com'
  AND (role IS NULL OR role != 'super_admin');

-- ============================================================
-- PHASE 6: FIX ANY INVALID ROLES
-- ============================================================

-- Convert any invalid roles to 'user'
UPDATE public.profiles
SET role = 'user', updated_at = NOW()
WHERE role IS NULL 
   OR role NOT IN ('user', 'admin', 'super_admin');

-- ============================================================
-- PHASE 7: VERIFY EVERYTHING IS IN PLACE
-- ============================================================

-- Verify experience column exists and is accessible
DO $$
DECLARE
  v_column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' 
      AND column_name = 'experience'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE NOTICE 'SUCCESS: experience column exists in jobs table';
  ELSE
    RAISE EXCEPTION 'FAILED: experience column not found in jobs table';
  END IF;
END $$;

-- Verify is_admin_user function exists
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'is_admin_user'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE 'SUCCESS: is_admin_user function exists';
  ELSE
    RAISE EXCEPTION 'FAILED: is_admin_user function not found';
  END IF;
END $$;

-- Verify RLS policies exist
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) FROM pg_policies
  WHERE tablename = 'jobs'
  INTO v_policy_count;
  
  IF v_policy_count >= 5 THEN
    RAISE NOTICE 'SUCCESS: All % RLS policies created for jobs table', v_policy_count;
  ELSE
    RAISE EXCEPTION 'FAILED: Only % RLS policies found, expected at least 5', v_policy_count;
  END IF;
END $$;

-- ============================================================
-- FINAL VERIFICATION QUERIES (for manual inspection)
-- ============================================================

-- 1. Check jobs table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
ORDER BY ordinal_position;

-- 2. Show all RLS policies on jobs table
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'jobs'
ORDER BY policyname;

-- 3. Show admin users in the system
SELECT id, email, role, created_at, updated_at
FROM public.profiles
WHERE role IN ('admin', 'super_admin')
ORDER BY role DESC, created_at DESC;

-- 4. Show total user count by role
SELECT role, COUNT(*) as count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 5. Verify experience column is readable (test insert)
-- This query shows that the column definition is correct
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'experience';
