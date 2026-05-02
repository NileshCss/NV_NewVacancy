-- ============================================================
-- FIX: Admin users cannot add/update jobs in Admin Panel
-- ============================================================
-- ROOT CAUSE:
--   11 conflicting RLS policies existed on the jobs table from
--   multiple past migrations (jobs_admin_manage, authenticated_update_jobs,
--   authenticated_insert_jobs, etc.). These policies were in conflict
--   and causing Supabase queries to hang (30-second timeout) for
--   regular admin users while super_admin worked fine.
--
-- FIX: Drop ALL existing jobs policies. Recreate as clean 5-policy set:
--   - jobs_public_select  → everyone sees active jobs
--   - jobs_admin_select   → admin/super_admin sees all jobs
--   - jobs_admin_insert   → admin/super_admin can create jobs
--   - jobs_admin_update   → admin/super_admin can update jobs
--   - jobs_admin_delete   → admin/super_admin can delete jobs
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ============================================================

-- Drop ALL conflicting policies (covers all historical names)
DROP POLICY IF EXISTS "jobs_select_active"          ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_all_admin"       ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_admin"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_admin"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_all"              ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_manage"           ON public.jobs;
DROP POLICY IF EXISTS "auth_insert_jobs"            ON public.jobs;
DROP POLICY IF EXISTS "auth_update_jobs"            ON public.jobs;
DROP POLICY IF EXISTS "auth_delete_jobs"            ON public.jobs;
DROP POLICY IF EXISTS "authenticated_insert_jobs"   ON public.jobs;
DROP POLICY IF EXISTS "authenticated_update_jobs"   ON public.jobs;
DROP POLICY IF EXISTS "authenticated_delete_jobs"   ON public.jobs;
DROP POLICY IF EXISTS "authenticated_read_all_jobs" ON public.jobs;
DROP POLICY IF EXISTS "jobs_public_read"            ON public.jobs;
DROP POLICY IF EXISTS "Public can view active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_public_select"          ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_select"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_insert"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_delete"           ON public.jobs;

-- Create clean 5-policy set
CREATE POLICY "jobs_public_select" ON public.jobs
  FOR SELECT USING (is_active = true);

CREATE POLICY "jobs_admin_select" ON public.jobs
  FOR SELECT USING (public.is_admin_user());

CREATE POLICY "jobs_admin_insert" ON public.jobs
  FOR INSERT WITH CHECK (public.is_admin_user());

CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "jobs_admin_delete" ON public.jobs
  FOR DELETE USING (public.is_admin_user());

-- Verify: should show exactly 5 policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'jobs'
ORDER BY cmd;
