-- ====================================================================
-- SQL TO RESTORE CHAPTERS AND ADD EXTENDED QUESTION COLUMNS
-- Paste this directly into your Supabase SQL Editor and run it.
-- ====================================================================

-- 1. Re-create public.chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Alter public.topics to link to chapters(id) instead of subjects
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE;
ALTER TABLE public.topics DROP COLUMN IF EXISTS subject_id CASCADE;

-- 3. Alter question_exam_map to add chapter_id back
ALTER TABLE public.question_exam_map ADD COLUMN IF NOT EXISTS chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL;

-- Recreate unique constraint
ALTER TABLE public.question_exam_map DROP CONSTRAINT IF EXISTS question_exam_map_question_id_exam_id_subject_id_topic_id_key;
ALTER TABLE public.question_exam_map DROP CONSTRAINT IF EXISTS question_exam_map_question_id_exam_id_subject_id_chapter_id_topic_id_key;
ALTER TABLE public.question_exam_map ADD CONSTRAINT question_exam_map_question_id_exam_id_subject_id_chapter_id_topic_id_key UNIQUE (question_id, exam_id, subject_id, chapter_id, topic_id);

-- 4. Enable RLS and policies for chapters
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read chapters" ON public.chapters;
DROP POLICY IF EXISTS "admin manage chapters" ON public.chapters;
CREATE POLICY "public read chapters" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "admin manage chapters" ON public.chapters FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 5. Alter questions table to add new columns
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS option_explanations jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS related_concept text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exam_relevance_score numeric;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS bloom_level text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS estimated_time_seconds integer;

-- 6. Grant privileges to service_role
GRANT ALL ON public.chapters TO service_role;

SELECT '✓ Database schema successfully updated: Chapters table restored and Questions table extended!' as status;
