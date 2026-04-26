-- ============================================================
-- NEWVACANCY.LIVE — PRODUCTION DATABASE FIX
-- ============================================================
-- ⚠️  IMPORTANT: This SQL uses the EXISTING column names:
--     is_active, is_featured, posted_at
--     (not "active", "featured", "created_at" from the master prompt)
--     because ALL frontend code is already wired to these names.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ============================================================

-- ── 1. PROFILES TABLE ─────────────────────────────────────────────
-- Add missing columns safely (IF NOT EXISTS prevents errors on re-run)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS location    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS resume_url  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- ── 2. JOBS TABLE — ensure all required columns exist ─────────────
-- job_description was added in a prior migration but verify it exists:
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_description TEXT DEFAULT '';

-- posted_at must have a DEFAULT to avoid insert failures
ALTER TABLE public.jobs
  ALTER COLUMN posted_at SET DEFAULT NOW();

-- Ensure is_active defaults to true (so existing rows without it work)
ALTER TABLE public.jobs
  ALTER COLUMN is_active SET DEFAULT true;

-- ── 3. APPLICATIONS TABLE — ensure cascade delete ─────────────────
-- (Re-creating FK with ON DELETE CASCADE if not already set)
-- Safe approach: add the constraint only if it doesn't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'applications_user_id_fkey'
      AND table_name = 'applications'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 4. SAVED JOBS TABLE — ensure cascade delete ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'saved_jobs_user_id_fkey'
      AND table_name = 'saved_jobs'
  ) THEN
    ALTER TABLE public.saved_jobs
      ADD CONSTRAINT saved_jobs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 5. RESUME ANALYSES TABLE — ensure cascade delete ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'resume_analyses_user_id_fkey'
      AND table_name = 'resume_analyses'
  ) THEN
    ALTER TABLE public.resume_analyses
      ADD CONSTRAINT resume_analyses_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 6. PERFORMANCE INDEXES ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_is_active   ON public.jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_is_featured ON public.jobs(is_featured);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at   ON public.jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_category    ON public.jobs(category);
CREATE INDEX IF NOT EXISTS idx_apps_user_id     ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_apps_job_id      ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_saved_user_id    ON public.saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_user_id   ON public.resume_analyses(user_id);

-- ── 7. AUTO-UPDATE updated_at TRIGGER ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 8. AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────
-- If the trigger doesn't exist yet, creates it.
-- If it already exists, replaces the function safely.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'candidate'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 9. ROW LEVEL SECURITY ─────────────────────────────────────────
-- Enable RLS on all tables (idempotent)
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_analyses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs       ENABLE ROW LEVEL SECURITY;

-- Drop old policies (clean slate)
DROP POLICY IF EXISTS "profiles_select_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"     ON public.profiles;
DROP POLICY IF EXISTS "jobs_select_active"     ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_all_admin"  ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_admin"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_admin"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin"      ON public.jobs;
DROP POLICY IF EXISTS "apps_own"               ON public.applications;
DROP POLICY IF EXISTS "apps_admin"             ON public.applications;
DROP POLICY IF EXISTS "resume_own"             ON public.resume_analyses;
DROP POLICY IF EXISTS "saved_own"              ON public.saved_jobs;
-- Also drop any older named policies from previous migrations
DROP POLICY IF EXISTS "auth_insert_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "auth_update_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "auth_delete_jobs"       ON public.jobs;
DROP POLICY IF EXISTS "Public can view active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"     ON public.jobs;

-- ── PROFILES ──
-- Anyone can read profiles (needed for admin to list users)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can do everything to profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── JOBS ──
-- Public read: only active jobs (for public site)
CREATE POLICY "jobs_select_active" ON public.jobs
  FOR SELECT USING (is_active = true);

-- Admins can SELECT all jobs (active + inactive) in admin panel
CREATE POLICY "jobs_select_all_admin" ON public.jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can INSERT jobs
CREATE POLICY "jobs_insert_admin" ON public.jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can UPDATE jobs
CREATE POLICY "jobs_update_admin" ON public.jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can DELETE jobs
CREATE POLICY "jobs_delete_admin" ON public.jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── APPLICATIONS ──
CREATE POLICY "apps_own" ON public.applications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "apps_admin" ON public.applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ── RESUME ANALYSES ──
CREATE POLICY "resume_own" ON public.resume_analyses
  FOR ALL USING (auth.uid() = user_id);

-- ── SAVED JOBS ──
CREATE POLICY "saved_own" ON public.saved_jobs
  FOR ALL USING (auth.uid() = user_id);

-- ── 10. CLEAN UP ORPHANED DATA ────────────────────────────────────
-- Remove any rows that reference users no longer in profiles
DELETE FROM public.applications
  WHERE user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.resume_analyses
  WHERE user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.saved_jobs
  WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- ── 11. VERIFY — check job_description column exists ─────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'jobs'
ORDER BY ordinal_position;
