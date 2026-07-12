-- ============================================================
-- Migration: Mock Tests Module Schema
-- Apply in Supabase SQL Editor AFTER 023_exam_module_schema.sql
-- ============================================================

-- 1. mock_tests
CREATE TABLE IF NOT EXISTS public.mock_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
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

-- 2. mock_test_questions
CREATE TABLE IF NOT EXISTS public.mock_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_test_id uuid REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  marks int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(mock_test_id, question_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mock_tests_exam ON public.mock_tests(exam_id);
CREATE INDEX IF NOT EXISTS idx_mock_tests_status ON public.mock_tests(status);
CREATE INDEX IF NOT EXISTS idx_mock_test_questions_test ON public.mock_test_questions(mock_test_id);
CREATE INDEX IF NOT EXISTS idx_mock_test_questions_order ON public.mock_test_questions(mock_test_id, display_order);

-- RLS
ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_questions ENABLE ROW LEVEL SECURITY;

-- Drop if re-running
DROP POLICY IF EXISTS "students read published mock_tests" ON public.mock_tests;
DROP POLICY IF EXISTS "admin manage mock_tests" ON public.mock_tests;
DROP POLICY IF EXISTS "students read mock_test_questions" ON public.mock_test_questions;
DROP POLICY IF EXISTS "admin manage mock_test_questions" ON public.mock_test_questions;

-- Students can only read published tests
CREATE POLICY "students read published mock_tests" ON public.mock_tests
  FOR SELECT USING (status = 'published' OR public.is_admin_user());

-- Admins can do everything
CREATE POLICY "admin manage mock_tests" ON public.mock_tests
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "students read mock_test_questions" ON public.mock_test_questions
  FOR SELECT USING (
    public.is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.mock_tests mt
      WHERE mt.id = mock_test_id AND mt.status = 'published'
    )
  );

CREATE POLICY "admin manage mock_test_questions" ON public.mock_test_questions
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Grant service_role full access
GRANT ALL ON public.mock_tests TO service_role;
GRANT ALL ON public.mock_test_questions TO service_role;
