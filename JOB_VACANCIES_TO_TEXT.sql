-- ============================================================
-- Convert Vacancies Column to Text Migration
-- NewVacancy.live — Run in Supabase SQL Editor
-- ============================================================

-- 1. Alter the jobs table to change vacancies from INTEGER to TEXT
-- We use USING vacancies::TEXT to safely convert existing numeric values to string
ALTER TABLE jobs
  ALTER COLUMN vacancies TYPE TEXT USING vacancies::TEXT;

-- 2. Update existing rows that might be 0 or null (optional)
UPDATE jobs
  SET vacancies = 'Not specified'
  WHERE vacancies IS NULL OR vacancies = '0';
