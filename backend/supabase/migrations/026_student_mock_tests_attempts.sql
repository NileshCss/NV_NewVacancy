-- ============================================================
-- MIGRATION 026: Student Mock Test Attempts & Answers Schema
-- ============================================================

-- 1. Create student_attempts table
CREATE TABLE IF NOT EXISTS public.student_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mock_test_id uuid NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  score numeric DEFAULT 0,
  accuracy_ratio numeric DEFAULT 0,
  total_correct int DEFAULT 0,
  total_incorrect int DEFAULT 0,
  total_unattempted int DEFAULT 0,
  time_taken_seconds int DEFAULT 0,
  tab_switch_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create student_answers table
CREATE TABLE IF NOT EXISTS public.student_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.student_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer jsonb, -- Selected option index/array/text
  is_correct boolean,
  marks_obtained numeric DEFAULT 0,
  time_spent_seconds int DEFAULT 0,
  marked_for_review boolean DEFAULT false,
  answered_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_attempts_student ON public.student_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_test ON public.student_attempts(mock_test_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_status ON public.student_attempts(status);
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt ON public.student_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question ON public.student_answers(question_id);

-- Enable RLS
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- Drop policies if exist
DROP POLICY IF EXISTS "students read own attempts" ON public.student_attempts;
DROP POLICY IF EXISTS "students create own attempts" ON public.student_attempts;
DROP POLICY IF EXISTS "students update own attempts" ON public.student_attempts;
DROP POLICY IF EXISTS "admin view all attempts" ON public.student_attempts;

DROP POLICY IF EXISTS "students read own answers" ON public.student_answers;
DROP POLICY IF EXISTS "students write own answers" ON public.student_answers;
DROP POLICY IF EXISTS "admin view all answers" ON public.student_answers;

-- Policies for student_attempts
CREATE POLICY "students read own attempts" ON public.student_attempts
  FOR SELECT USING (student_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "students create own attempts" ON public.student_attempts
  FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "students update own attempts" ON public.student_attempts
  FOR UPDATE USING (student_id = auth.uid() OR public.is_admin_user()) WITH CHECK (student_id = auth.uid() OR public.is_admin_user());

-- Policies for student_answers
CREATE POLICY "students read own answers" ON public.student_answers
  FOR SELECT USING (
    public.is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.student_attempts sa
      WHERE sa.id = attempt_id AND sa.student_id = auth.uid()
    )
  );

CREATE POLICY "students write own answers" ON public.student_answers
  FOR ALL USING (
    public.is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.student_attempts sa
      WHERE sa.id = attempt_id AND sa.student_id = auth.uid() AND sa.status = 'in_progress'
    )
  ) WITH CHECK (
    public.is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.student_attempts sa
      WHERE sa.id = attempt_id AND sa.student_id = auth.uid() AND sa.status = 'in_progress'
    )
  );

-- Grants
GRANT ALL ON public.student_attempts TO service_role;
GRANT ALL ON public.student_answers TO service_role;
