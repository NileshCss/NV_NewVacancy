-- ============================================================
-- ADMIN SETUP & VERIFICATION GUIDE
-- ============================================================
-- Run this script in Supabase SQL Editor to:
-- 1. Check which users are admins
-- 2. Promote a user to admin
-- 3. Verify RLS policies are correct
-- 4. Test admin permissions

-- ── STEP 1: Check current admin users ──────────────────────
SELECT id, email, role, created_at, updated_at 
FROM public.profiles 
WHERE role IN ('admin', 'super_admin') 
ORDER BY role DESC, created_at DESC;

-- ── STEP 2: Verify the super admin is configured ──────────
-- The super admin email is hardcoded in the backend: rajputnileshsingh3@gmail.com
SELECT id, email, role 
FROM public.profiles 
WHERE email = 'rajputnileshsingh3@gmail.com';

-- ── STEP 3: Check all profiles with invalid roles ──────────
SELECT id, email, role 
FROM public.profiles 
WHERE role NOT IN ('user', 'admin', 'super_admin', 'candidate') 
   OR role IS NULL;

-- ── STEP 4: Promote a specific user to admin ──────────────
-- Replace 'YOUR_EMAIL@example.com' with the actual email address
UPDATE public.profiles 
SET role = 'admin', updated_at = NOW() 
WHERE email = 'YOUR_EMAIL@example.com' 
  AND role != 'admin' 
  AND role != 'super_admin';

-- Verify the update
SELECT id, email, role, updated_at 
FROM public.profiles 
WHERE email = 'YOUR_EMAIL@example.com';

-- ── STEP 5: Check the is_admin_user() function exists ──────
-- This function should be present for RLS to work correctly
SELECT function_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'is_admin_user';

-- ── STEP 6: Verify jobs RLS policies ──────────────────────
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

-- ── STEP 7: Test admin can read all jobs (including inactive) ──
-- Run this as an admin user (will show error if not admin)
SELECT COUNT(*) as total_jobs, 
       SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_jobs,
       SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_jobs
FROM public.jobs;

-- ── STEP 8: Fix any users with 'candidate' role ──────────────
UPDATE public.profiles 
SET role = 'user' 
WHERE role = 'candidate' OR role = '';

-- ── STEP 9: Ensure super admin role is set correctly ────────
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE email = 'rajputnileshsingh3@gmail.com' 
  AND role != 'super_admin';

-- ── FINAL: Verify the admin can insert a job ───────────────
-- This tests the INSERT policy with the is_admin_user() function
-- If successful, admin can post jobs through the form

-- IMPORTANT: After promoting a user to admin:
-- 1. The user MUST sign out completely and sign back in
-- 2. This refreshes their JWT token with the new role
-- 3. Without re-login, they'll still see "permission denied" errors
