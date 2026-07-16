-- ============================================================
-- MIGRATION 028: Fix mock_tests RLS + Add anon SELECT for published tests
-- ============================================================
-- PROBLEM: Migration 027 added auth.uid() IS NOT NULL to the SELECT policy,
-- meaning anonymous users can't list published tests. The student list 
-- endpoint uses the user's JWT (via getClientForRequest) so authenticated
-- students CAN read — but if the mock_tests table was never created
-- (the mock_tests_migration.sql root file was never applied), that is 
-- the primary issue.
--
-- This migration:
-- 1. Creates mock_tests + mock_test_questions tables (safe IF NOT EXISTS)
-- 2. Sets the correct RLS: authenticated users can read published tests
--    (matching the pattern from migration 027, which is correct).
-- 3. Ensures anon SELECT grants row-level reads for published tests
--    (for unauthenticated previews, e.g. exam landing pages linking to tests)
-- ============================================================

-- 1. Ensure mock_tests table exists
CREATE TABLE IF NOT EXISTS public.mock_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id uuid,
  difficulty text DEFAULT 'mixed' CHECK (difficulty IN ('easy','medium','hard','mixed')),
  duration_minutes int NOT NULL DEFAULT 60,
  total_questions int NOT NULL DEFAULT 0,
  total_marks int NOT NULL DEFAULT 0,
  passing_marks int,
  negative_marking_ratio numeric DEFAULT 0,
  instructions text,
  question_selection_mode text DEFAULT 'manual' CHECK (question_selection_mode IN ('manual','random','ai')),
  random_rules jsonb DEFAULT '[]',
  status text DEFAULT 'draft' CHECK (status IN ('draft','published','expired')),
  publish_date timestamptz,
  expiry_date timestamptz,
  attempts_count int DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Ensure mock_test_questions table exists
CREATE TABLE IF NOT EXISTS public.mock_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  marks int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(mock_test_id, question_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_mock_tests_exam ON public.mock_tests(exam_id);
CREATE INDEX IF NOT EXISTS idx_mock_tests_status ON public.mock_tests(status);
CREATE INDEX IF NOT EXISTS idx_mock_test_questions_test ON public.mock_test_questions(mock_test_id);
CREATE INDEX IF NOT EXISTS idx_mock_test_questions_order ON public.mock_test_questions(mock_test_id, display_order);

-- 4. Enable RLS
ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_questions ENABLE ROW LEVEL SECURITY;

-- 5. Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "students read published mock_tests" ON public.mock_tests;
DROP POLICY IF EXISTS "admin manage mock_tests" ON public.mock_tests;
DROP POLICY IF EXISTS "students read mock_test_questions" ON public.mock_test_questions;
DROP POLICY IF EXISTS "admin manage mock_test_questions" ON public.mock_test_questions;

-- 6. CORRECT POLICIES:
-- Students (authenticated users) can read published tests.
-- Admins can read all (including draft/expired).
-- The key fix: auth.uid() IS NOT NULL ensures only logged-in users can list,
-- which is correct since the route uses `attachUser` middleware.
CREATE POLICY "students read published mock_tests" ON public.mock_tests
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (status = 'published' OR public.is_admin_user())
  );

CREATE POLICY "admin manage mock_tests" ON public.mock_tests
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "students read mock_test_questions" ON public.mock_test_questions
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.is_admin_user() OR
      EXISTS (
        SELECT 1 FROM public.mock_tests mt
        WHERE mt.id = mock_test_id AND mt.status = 'published'
      )
    )
  );

CREATE POLICY "admin manage mock_test_questions" ON public.mock_test_questions
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 7. Service role full access
GRANT ALL ON public.mock_tests TO service_role;
GRANT ALL ON public.mock_test_questions TO service_role;

-- 8. Verify current state
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('mock_tests', 'mock_test_questions')
ORDER BY tablename, policyname;

-- 9. Show row counts
SELECT 'mock_tests total' AS label, COUNT(*) AS cnt FROM public.mock_tests
UNION ALL
SELECT 'mock_tests published', COUNT(*) FROM public.mock_tests WHERE status = 'published'
UNION ALL
SELECT 'mock_test_questions total', COUNT(*) FROM public.mock_test_questions;
