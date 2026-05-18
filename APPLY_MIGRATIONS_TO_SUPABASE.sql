-- ============================================================
-- APPLY THESE MIGRATIONS IN SUPABASE TO FIX THE EXPERIENCE FIELD ERROR
-- ============================================================
-- Error: Could not find the 'experience' column of 'jobs' in the schema cache [PGRST204]
--
-- This means the database schema is out of sync. Run this script in:
-- Supabase Dashboard → SQL Editor → New Query → Run All
-- ============================================================

-- STEP 1: Add experience column to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS experience TEXT;

COMMENT ON COLUMN public.jobs.experience IS 'Required experience for the job (e.g., "0-2 years", "3-5 years", "5+ years")';

-- ============================================================
-- STEP 2: Fix RLS Policies for Admin/SuperAdmin Job Posting
-- ============================================================

-- Helper function — is the current user an admin?
-- Returns true for role = 'admin' OR role = 'super_admin'
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop ALL existing job policies (clean slate)
DROP POLICY IF EXISTS "jobs_select_active"     ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_all_admin"  ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_public"     ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_admin"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_admin"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin"      ON public.jobs;
DROP POLICY IF EXISTS "auth_insert_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "auth_update_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "auth_delete_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "Public can view active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"     ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_all"         ON public.jobs;

-- Ensure RLS is enabled
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read ACTIVE jobs
CREATE POLICY "jobs_select_active" ON public.jobs
  FOR SELECT USING (is_active = true);

-- Admins & super_admins can read ALL jobs (including inactive)
CREATE POLICY "jobs_select_all_admin" ON public.jobs
  FOR SELECT USING (public.is_admin_user());

-- Admins & super_admins can INSERT jobs
CREATE POLICY "jobs_insert_admin" ON public.jobs
  FOR INSERT WITH CHECK (public.is_admin_user());

-- Admins & super_admins can UPDATE jobs
CREATE POLICY "jobs_update_admin" ON public.jobs
  FOR UPDATE USING (public.is_admin_user());

-- Admins & super_admins can DELETE jobs
CREATE POLICY "jobs_delete_admin" ON public.jobs
  FOR DELETE USING (public.is_admin_user());

-- Verify super_admin has correct role in DB
UPDATE public.profiles
  SET role = 'super_admin'
  WHERE email = 'rajputnileshsingh3@gmail.com'
    AND role != 'super_admin';

-- ============================================================
-- VERIFICATION: Run these queries to confirm the fix worked
-- ============================================================

-- Check the experience column exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'experience';

-- Verify RLS policies are in place
SELECT tablename, policyname, cmd FROM pg_policies 
WHERE tablename = 'jobs' ORDER BY policyname;

-- Check the is_admin_user function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'is_admin_user';

-- Show admin users
SELECT id, email, role FROM public.profiles 
WHERE role IN ('admin', 'super_admin') LIMIT 5;
