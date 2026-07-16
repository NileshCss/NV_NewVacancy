-- ============================================================
-- DIAGNOSTIC: Mock Tests Root Cause Analysis
-- Run this in Supabase SQL Editor → Results will tell you exactly
-- which of the 3 root causes applies.
-- ============================================================

-- ── SECTION 1: Table Existence Check ─────────────────────
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('mock_tests', 'mock_test_questions', 'student_attempts', 'student_answers')
ORDER BY table_name;

-- ── SECTION 2: Row Count & Status Distribution ────────────
-- This tells you if any published tests exist.
SELECT
  status,
  COUNT(*) AS count
FROM public.mock_tests
GROUP BY status
ORDER BY status;

-- If zero rows: table exists but no tests created → create + publish one.
-- If rows exist with status='draft': tests exist but not published → publish them.
-- If rows exist with status='published': data is fine → RLS is the culprit.

-- ── SECTION 3: Total Row Count (simple) ──────────────────
SELECT COUNT(*) AS total_mock_tests FROM public.mock_tests;

-- ── SECTION 4: RLS Policies on mock_tests ────────────────
-- Compare this against the exams table policy below.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'mock_tests'
ORDER BY policyname;

-- ── SECTION 5: RLS Policies on exams (for comparison) ────
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'exams'
ORDER BY policyname;

-- ── SECTION 6: RLS Enabled? ──────────────────────────────
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN ('mock_tests', 'mock_test_questions', 'exams')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ── SECTION 7: Test the query as anon user ───────────────
-- Temporarily set role to anon to simulate an unauthenticated query:
-- (If this returns 0 but Section 2 shows published rows → RLS is blocking anon)
SET LOCAL ROLE anon;
SELECT COUNT(*) AS published_mock_tests_visible_to_anon
FROM public.mock_tests
WHERE status = 'published';
RESET ROLE;

-- ── SECTION 8: Sample published mock tests (if any) ──────
SELECT
  id,
  name,
  status,
  exam_id,
  subject_id,
  total_questions,
  created_at
FROM public.mock_tests
WHERE status = 'published'
LIMIT 5;
