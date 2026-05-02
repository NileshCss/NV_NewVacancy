-- ============================================================
-- NEWVACANCY.LIVE — FIX RLS POLICIES FOR ADMIN + SUPER_ADMIN
-- ============================================================
-- ROOT CAUSE:
--   All job policies only check role = 'admin'
--   but super_admin users have role = 'super_admin' in the DB,
--   so they are BLOCKED from INSERT/UPDATE/DELETE on jobs.
--
-- FIX: All admin policies now accept BOTH 'admin' AND 'super_admin'.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ============================================================

-- ── STEP 1: Drop ALL existing job policies (clean slate) ──────────
DROP POLICY IF EXISTS "jobs_select_active"     ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_all_admin"  ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_admin"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_admin"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin"      ON public.jobs;
DROP POLICY IF EXISTS "auth_insert_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "auth_update_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "auth_delete_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "Public can view active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"     ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_all"         ON public.jobs;

-- ── STEP 2: Drop ALL existing profiles policies ────────────────────
DROP POLICY IF EXISTS "profiles_select_all"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;

-- ── STEP 3: Make sure RLS is enabled ──────────────────────────────
ALTER TABLE public.jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── STEP 4: Helper function — is the current user an admin? ────────
-- Returns true for role = 'admin' OR role = 'super_admin'
-- Using SECURITY DEFINER so it can read profiles even under RLS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── STEP 5: PROFILES policies ──────────────────────────────────────

-- Anyone (even anon) can read profiles (needed for admin user list)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

-- Users can update ONLY their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins & super_admins can do everything on profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin_user());

-- Allow trigger to insert a profile on signup (SECURITY DEFINER handles this)
-- but add INSERT policy for edge cases
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── STEP 6: JOBS policies ──────────────────────────────────────────

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

-- ── STEP 7: Fix new user trigger — use 'user' not 'candidate' ──────
-- The old trigger set role = 'candidate' which is not a valid role.
-- Valid roles in this app: 'user', 'admin', 'super_admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'user'   -- ← was 'candidate', now correctly 'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── STEP 8: Fix existing users with 'candidate' role ──────────────
-- Update any existing users that have role = 'candidate' to 'user'
UPDATE public.profiles
  SET role = 'user'
  WHERE role = 'candidate' OR role IS NULL OR role = '';

-- ── STEP 9: Ensure super_admin has the correct role in DB ──────────
-- This ensures the super admin email always has super_admin role
UPDATE public.profiles
  SET role = 'super_admin'
  WHERE email = 'rajputnileshsingh3@gmail.com'
    AND role != 'super_admin';

-- ── STEP 10: Verify — show all policies on jobs table ─────────────
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('jobs', 'profiles')
ORDER BY tablename, policyname;

-- ── STEP 11: Quick sanity check ───────────────────────────────────
SELECT id, email, role FROM public.profiles
WHERE email = 'rajputnileshsingh3@gmail.com';
