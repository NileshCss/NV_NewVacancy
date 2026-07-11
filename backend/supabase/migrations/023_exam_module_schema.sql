-- ============================================================
-- MIGRATION 023: Exam Practice & Mock Test Module Schema
-- ============================================================
-- Includes Phase 1 (Syllabus Hierarchy) and Phase 2 (Question Bank)
-- Implements RLS using the existing public.is_admin_user() helper.

-- ── PHASE 1: Syllabus Hierarchy ───────────────────────────────

-- 1. exam_categories
CREATE TABLE IF NOT EXISTS public.exam_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. exams
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.exam_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  banner_url text,
  description text,
  eligibility text,
  age_limit text,
  selection_process text,
  exam_pattern jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  image_url text,
  display_order int DEFAULT 0,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. chapters
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. topics
CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  notes_rich_text text,
  formula text,
  diagrams jsonb DEFAULT '[]',
  interview_tips text,
  revision_notes text,
  important_points text,
  pdf_url text,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for Phase 1
CREATE INDEX IF NOT EXISTS idx_exams_category ON public.exams(category_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams(status);
CREATE INDEX IF NOT EXISTS idx_subjects_exam ON public.subjects(exam_id);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON public.chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_chapter ON public.topics(chapter_id);

-- RLS for Phase 1
ALTER TABLE public.exam_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if running multiple times
DROP POLICY IF EXISTS "public read exam_categories" ON public.exam_categories;
DROP POLICY IF EXISTS "admin manage exam_categories" ON public.exam_categories;
DROP POLICY IF EXISTS "public read published exams" ON public.exams;
DROP POLICY IF EXISTS "admin manage exams" ON public.exams;
DROP POLICY IF EXISTS "public read subjects" ON public.subjects;
DROP POLICY IF EXISTS "admin manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "public read chapters" ON public.chapters;
DROP POLICY IF EXISTS "admin manage chapters" ON public.chapters;
DROP POLICY IF EXISTS "public read topics" ON public.topics;
DROP POLICY IF EXISTS "admin manage topics" ON public.topics;

-- Public Read Policies
CREATE POLICY "public read exam_categories" ON public.exam_categories FOR SELECT USING (true);
CREATE POLICY "public read published exams" ON public.exams FOR SELECT USING (status = 'published');
CREATE POLICY "public read subjects" ON public.subjects FOR SELECT USING (enabled = true);
CREATE POLICY "public read chapters" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "public read topics" ON public.topics FOR SELECT USING (true);

-- Admin Manage Policies
CREATE POLICY "admin manage exam_categories" ON public.exam_categories FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin manage exams" ON public.exams FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin manage subjects" ON public.subjects FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin manage chapters" ON public.chapters FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin manage topics" ON public.topics FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());


-- ── PHASE 2: Question Bank ────────────────────────────────────────

-- 1. questions
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN (
    'mcq','multiple_correct','true_false','fill_blank','assertion_reason',
    'match_following','case_study','scenario_based','sql_output','coding_mcq',
    'interview_question','previous_year_question'
  )),
  options jsonb,
  correct_answer jsonb NOT NULL,
  solution_text text,
  explanation text,
  difficulty text CHECK (difficulty IN ('easy','medium','hard')),
  year int,
  marks numeric DEFAULT 1,
  negative_marks numeric DEFAULT 0,
  tags text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  reference text,
  image_url text,
  diagram_url text,
  formula text,
  code_block text,
  hint text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  source text DEFAULT 'manual' CHECK (source IN ('manual','bulk_import','ai_extracted')),
  possible_duplicate_of uuid REFERENCES public.questions(id),
  created_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. question_exam_map
CREATE TABLE IF NOT EXISTS public.question_exam_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  UNIQUE (question_id, exam_id, subject_id, chapter_id, topic_id)
);

-- 3. question_import_logs
CREATE TABLE IF NOT EXISTS public.question_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by uuid REFERENCES auth.users(id),
  filename text,
  source_type text,
  total_processed int DEFAULT 0,
  success_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  duplicate_count int DEFAULT 0,
  errors jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Indexes for Phase 2
CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_qem_exam ON public.question_exam_map(exam_id);
CREATE INDEX IF NOT EXISTS idx_qem_topic ON public.question_exam_map(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_tags ON public.questions USING gin(tags);

-- RLS for Phase 2
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_exam_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read approved questions" ON public.questions;
DROP POLICY IF EXISTS "admin manage questions" ON public.questions;
DROP POLICY IF EXISTS "public read question_exam_map" ON public.question_exam_map;
DROP POLICY IF EXISTS "admin manage question_exam_map" ON public.question_exam_map;
DROP POLICY IF EXISTS "admin manage import logs" ON public.question_import_logs;

-- Public Read Policies (only approved questions)
CREATE POLICY "public read approved questions" ON public.questions FOR SELECT USING (status = 'approved');
CREATE POLICY "public read question_exam_map" ON public.question_exam_map FOR SELECT USING (true);

-- Admin Manage Policies
CREATE POLICY "admin manage questions" ON public.questions FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin manage question_exam_map" ON public.question_exam_map FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "admin manage import logs" ON public.question_import_logs FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Make sure service_role can access them fully
GRANT ALL ON public.exam_categories TO service_role;
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.subjects TO service_role;
GRANT ALL ON public.chapters TO service_role;
GRANT ALL ON public.topics TO service_role;
GRANT ALL ON public.questions TO service_role;
GRANT ALL ON public.question_exam_map TO service_role;
GRANT ALL ON public.question_import_logs TO service_role;
