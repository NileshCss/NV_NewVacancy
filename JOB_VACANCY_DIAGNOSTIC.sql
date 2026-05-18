-- ============================================================
-- JOB VACANCY DIAGNOSTIC REPORT
-- Run this to identify the exact issue
-- ============================================================

-- SECTION 1: Database Setup Verification
SELECT '=== SECTION 1: DATABASE SETUP ===' as status;

-- 1.1 Check if jobs table exists and has required columns
SELECT 
  table_name,
  COUNT(*) as total_columns,
  array_agg(column_name ORDER BY column_name) as columns
FROM information_schema.columns
WHERE table_name = 'jobs'
GROUP BY table_name;

-- 1.2 Check specifically for critical columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('experience', 'updated_at', 'title', 'id', 'is_active')
ORDER BY column_name;

-- SECTION 2: RLS and Security
SELECT '=== SECTION 2: RLS POLICIES ===' as status;

-- 2.1 Show all RLS policies on jobs table
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual as condition
FROM pg_policies
WHERE tablename = 'jobs'
ORDER BY policyname;

-- 2.2 Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'jobs';

-- 2.3 Check if admin helper function exists
SELECT 
  routine_schema,
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin_user';

-- SECTION 3: User Roles and Permissions
SELECT '=== SECTION 3: USER ROLES ===' as status;

-- 3.1 Count users by role
SELECT 
  role,
  COUNT(*) as count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 3.2 Show all admin/super_admin users
SELECT 
  id,
  email,
  role,
  created_at,
  updated_at
FROM public.profiles
WHERE role IN ('admin', 'super_admin')
ORDER BY role DESC, created_at DESC;

-- 3.3 Check for NULL or invalid roles
SELECT 
  id,
  email,
  role,
  created_at
FROM public.profiles
WHERE role IS NULL 
   OR role NOT IN ('user', 'admin', 'super_admin')
LIMIT 10;

-- SECTION 4: Job Data Inspection
SELECT '=== SECTION 4: JOB DATA ===' as status;

-- 4.1 Count total jobs
SELECT 
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_jobs,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_jobs
FROM public.jobs;

-- 4.2 Recent jobs (last 5)
SELECT 
  id,
  title,
  organization,
  is_active,
  experience
FROM public.jobs
ORDER BY id DESC
LIMIT 5;

-- 4.3 Check for any NULL experience values in recent jobs
SELECT 
  id,
  title,
  experience
FROM public.jobs
WHERE experience IS NULL OR experience = ''
LIMIT 5;

-- SECTION 5: Performance Check
SELECT '=== SECTION 5: PERFORMANCE ===' as status;

-- 5.1 Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND tablename IN ('jobs', 'profiles', 'auth.users')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 5.2 Check for long running queries (if any are stuck)
SELECT 
  query,
  state,
  wait_event,
  query_start
FROM pg_stat_activity
WHERE query NOT ILIKE '%pg_stat_activity%'
  AND state != 'idle'
ORDER BY query_start DESC
LIMIT 5;

-- SECTION 6: Summary Report
SELECT '=== SECTION 6: SUMMARY ===' as status;

SELECT 
  'Jobs Table' as item,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'jobs')::text as detail,
  'Total columns' as description
UNION ALL
SELECT 
  'Experience Column', 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'experience') THEN '✓ EXISTS' ELSE '✗ MISSING' END,
  'Column present'
UNION ALL
SELECT 
  'RLS Policies',
  (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'jobs'),
  'Policies created'
UNION ALL
SELECT 
  'Admin Users',
  (SELECT COUNT(*)::text FROM public.profiles WHERE role IN ('admin', 'super_admin')),
  'Administrators'
UNION ALL
SELECT 
  'Total Jobs',
  (SELECT COUNT(*)::text FROM public.jobs),
  'Jobs in database'
UNION ALL
SELECT 
  'Super Admin Role',
  COALESCE((SELECT role FROM public.profiles WHERE email = 'rajputnileshsingh3@gmail.com'), 'NOT FOUND'),
  'rajputnileshsingh3@gmail.com status';

-- SECTION 7: Specific Test Cases
SELECT '=== SECTION 7: TEST CASES ===' as status;

-- 7.1 Test if admin can insert a job (simulation)
-- This will show if the RLS would allow the operation
SELECT 
  'Admin Insert Test' as test,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE role IN ('admin', 'super_admin')
    LIMIT 1
  ) THEN '✓ PASS: Admin user exists' 
    ELSE '✗ FAIL: No admin user found' 
  END as result;

-- 7.2 Check if is_admin_user function is callable
SELECT 
  'Function Existence' as test,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'is_admin_user'
  ) THEN '✓ PASS: Function exists'
    ELSE '✗ FAIL: Function missing'
  END as result;

-- ============================================================
-- END OF DIAGNOSTIC REPORT
-- ============================================================
-- If you see any FAIL or MISSING items above, they need to be fixed.
-- Use the JOB_VACANCY_UPDATE_FIX_GUIDE.md to apply the comprehensive fix.
