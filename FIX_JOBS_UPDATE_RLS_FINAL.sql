-- ============================================================
-- FIX_JOBS_UPDATE_RLS_FINAL.sql   (v2 — updated 2026-07-08)
-- Definitive RLS fix for admin job CRUD operations.
--
-- ROOT CAUSE:
--   The frontend addJob() / updateJob() / deleteJob() calls use a
--   Supabase client authenticated with the logged-in user's JWT
--   (via createFreshClient). RLS evaluates this JWT.
--
--   Supabase JWT claims do NOT automatically include the 'role'
--   from the profiles table. So a policy like:
--     auth.jwt() ->> 'role' = 'admin'
--   ALWAYS fails for admin users — their JWT role claim is 'authenticated',
--   not 'admin'. The role is only in the profiles table.
--
--   CONFIRMED: anonymous-key test returned code '42501' (RLS violation)
--   on INSERT even with valid data — proving the INSERT policy is missing
--   or broken.
--
-- SOLUTION:
--   Use a SECURITY DEFINER function to safely look up the user's role
--   from the profiles table using auth.uid(). This bypasses the JWT
--   claim problem and reads the ground-truth role.
--
-- HOW TO APPLY:
--   1. Go to https://supabase.com/dashboard → your project → SQL Editor
--   2. Paste this ENTIRE file and click "Run"
--   3. You should see 4 rows in the verification output at the bottom
--   4. After applying, retry "Post Vacancy" — it should succeed immediately
-- ============================================================

-- Step 1: Create (or replace) the SECURITY DEFINER helper function.
-- This function runs as the DB owner (bypasses RLS on profiles)
-- so it can safely read the caller's role.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Step 2: Drop ALL existing policies on jobs table to start clean.
-- (Avoids conflicts from previous partial fix attempts)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'jobs' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', pol.policyname);
  END LOOP;
END;
$$;

-- Step 3: Re-create all policies from scratch.

-- SELECT: Anyone can read active jobs (public); admins can read all jobs
CREATE POLICY "jobs_select_public"
  ON public.jobs FOR SELECT
  USING (
    is_active = true
    OR get_my_role() IN ('admin', 'super_admin')
  );

-- INSERT: Admin and super_admin can insert new jobs
CREATE POLICY "jobs_insert_admin"
  ON public.jobs FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'super_admin')
  );

-- UPDATE: Admin and super_admin can update any job
CREATE POLICY "jobs_update_admin"
  ON public.jobs FOR UPDATE
  USING (
    get_my_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'super_admin')
  );

-- DELETE: Admin and super_admin can delete any job
CREATE POLICY "jobs_delete_admin"
  ON public.jobs FOR DELETE
  USING (
    get_my_role() IN ('admin', 'super_admin')
  );

-- Step 4: Make sure RLS is enabled on the jobs table
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify — this should show EXACTLY 4 policies
-- (jobs_delete_admin, jobs_insert_admin, jobs_select_public, jobs_update_admin)
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'jobs' AND schemaname = 'public'
ORDER BY policyname;
