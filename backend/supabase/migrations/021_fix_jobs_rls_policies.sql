-- ============================================================
-- Fix: RLS Policies for Admin/SuperAdmin Job Posting
-- ============================================================
-- This migration ensures admin and super_admin users can post jobs
-- by using a helper function that recognizes both roles.

-- ── 1. Helper function — is the current user an admin? ────────
-- Returns true for role = 'admin' OR role = 'super_admin'
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 2. Drop ALL existing job policies (clean slate) ──────────
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

-- ── 3. Ensure RLS is enabled ──────────────────────────────────
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- ── 4. Create new JOBS policies using helper function ────────────

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

-- ── 5. Verify super_admin has correct role in DB ────────────────
-- Ensure the super admin email always has super_admin role
UPDATE public.profiles
  SET role = 'super_admin'
  WHERE email = 'rajputnileshsingh3@gmail.com'
    AND role != 'super_admin';

-- ── 6. Verify all policies are in place ────────────────────────
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'jobs'
ORDER BY policyname;
