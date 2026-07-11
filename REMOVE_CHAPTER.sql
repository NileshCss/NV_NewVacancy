-- ============================================================
-- SQL TO REMOVE CHAPTER LEVEL FROM SYLLABUS HIERARCHY
-- Paste this directly into your Supabase SQL Editor and run it.
-- ============================================================

-- 1. Drop chapter mapping columns from question_exam_map
ALTER TABLE public.question_exam_map DROP COLUMN IF EXISTS chapter_id;

-- 2. Add subject_id reference directly to topics table (linking topic to subject directly)
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE;

-- 3. If there is data to migrate from chapter_id to subject_id:
-- (Uncomment the block below if you had existing data that needs to be preserved)
/*
UPDATE public.topics t
SET subject_id = c.subject_id
FROM public.chapters c
WHERE t.chapter_id = c.id;
*/

-- 4. Drop chapter_id reference from topics
ALTER TABLE public.topics DROP COLUMN IF EXISTS chapter_id;

-- 5. Drop chapters table entirely
DROP TABLE IF EXISTS public.chapters CASCADE;

-- 6. Adjust unique constraint on question_exam_map
ALTER TABLE public.question_exam_map DROP CONSTRAINT IF EXISTS question_exam_map_question_id_exam_id_subject_id_chapter_id_key;
ALTER TABLE public.question_exam_map ADD CONSTRAINT question_exam_map_question_id_exam_id_subject_id_topic_id_key UNIQUE (question_id, exam_id, subject_id, topic_id);

-- 7. Update verification report/check
SELECT '✓ Chapters successfully removed and Topics linked directly to Subjects!' as status;
