-- ============================================================
-- Add experience column to jobs table
-- ============================================================

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS experience TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.experience IS 'Required experience for the job (e.g., "0-2 years", "3-5 years", "5+ years")';
