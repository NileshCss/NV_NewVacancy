-- ============================================================
-- COMPREHENSIVE JOB VACANCY FIX
-- For Supabase - Fixed for actual schema
-- ============================================================

-- PHASE 1: ADD MISSING COLUMNS (if they don't exist)
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS experience TEXT;

COMMENT ON COLUMN public.jobs.experience IS 'Required experience (e.g., 2-5 years)';

-- PHASE 2: CREATE ADMIN HELPER FUNCTION
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

-- PHASE 3: DROP OLD RLS POLICIES (all variations)
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
DROP POLICY IF EXISTS "jobs_public_read_active"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_read_all"          ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_insert"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_delete"            ON public.jobs;

-- PHASE 4: ENABLE RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- PHASE 5: CREATE NEW RLS POLICIES
-- Policy 1: Public can read ACTIVE jobs only
CREATE POLICY "jobs_public_read_active" ON public.jobs
  FOR SELECT
  USING (is_active = true);

-- Policy 2: Admins can read ALL jobs (active and inactive)
CREATE POLICY "jobs_admin_read_all" ON public.jobs
  FOR SELECT
  USING (public.is_admin_user());

-- Policy 3: Only admins can INSERT new jobs
CREATE POLICY "jobs_admin_insert" ON public.jobs
  FOR INSERT
  WITH CHECK (public.is_admin_user());

-- Policy 4: Only admins can UPDATE jobs
CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Policy 5: Only admins can DELETE jobs
CREATE POLICY "jobs_admin_delete" ON public.jobs
  FOR DELETE
  USING (public.is_admin_user());

-- PHASE 6: ENSURE SUPER ADMIN ROLE
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'rajputnileshsingh3@gmail.com'
  AND role IS NULL;

-- PHASE 7: FIX ANY INVALID ROLES
UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL 
   OR role NOT IN ('user', 'admin', 'super_admin');

-- PHASE 8: VERIFICATION - Check all critical pieces
SELECT 'VERIFICATION REPORT' as section;

-- Check 1: Experience column
SELECT 
  'Experience Column' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'experience'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status;

-- Check 2: Admin function
SELECT 
  'is_admin_user() Function' as check_item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'is_admin_user'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status;

-- Check 3: RLS Policies
SELECT 
  'RLS Policies' as check_item,
  (SELECT COUNT(*)::text || '/5 policies created' FROM pg_policies WHERE tablename = 'jobs') as status;

-- Check 4: Admin users
SELECT 
  'Admin Users' as check_item,
  (SELECT COUNT(*)::text || ' admins found' FROM public.profiles WHERE role IN ('admin', 'super_admin')) as status;

-- Check 5: Super admin status
SELECT 
  'Super Admin (rajputnileshsingh3@gmail.com)' as check_item,
  COALESCE((SELECT role FROM public.profiles WHERE email = 'rajputnileshsingh3@gmail.com'), 'NOT FOUND') as status;

-- FINAL STATUS
SELECT '✓ FIX COMPLETE - ALL PHASES DONE' as final_status;
SELECT 'IMPORTANT: Super admin must sign out and sign back in to refresh JWT token' as reminder;

-- ============================================================
-- END OF FIX
-- ============================================================
