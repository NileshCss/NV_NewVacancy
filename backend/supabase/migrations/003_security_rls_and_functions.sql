-- ============================================================
-- SECURITY HARDENING + RLS + SERVER FUNCTIONS
-- ============================================================

-- Add blocked-user flag for admin controls
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Helper function for RLS checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_blocked = FALSE
  );
$$;

-- ============================================================
-- RLS: PROFILES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_insert_admin_only"
ON public.profiles FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_admin_only"
ON public.profiles FOR DELETE
USING (public.is_admin());

-- ============================================================
-- RLS: JOBS
-- ============================================================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs" ON public.jobs;

CREATE POLICY "jobs_public_read_active"
ON public.jobs FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "jobs_admin_insert"
ON public.jobs FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "jobs_admin_update"
ON public.jobs FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "jobs_admin_delete"
ON public.jobs FOR DELETE
USING (public.is_admin());

-- ============================================================
-- RLS: NEWS
-- ============================================================
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active news" ON public.news;
DROP POLICY IF EXISTS "Admins can manage news" ON public.news;

CREATE POLICY "news_public_read_active"
ON public.news FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "news_admin_insert"
ON public.news FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "news_admin_update"
ON public.news FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "news_admin_delete"
ON public.news FOR DELETE
USING (public.is_admin());

-- ============================================================
-- RLS: AFFILIATES
-- ============================================================
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Admins can manage affiliates" ON public.affiliates;

CREATE POLICY "affiliates_public_read_active"
ON public.affiliates FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "affiliates_admin_insert"
ON public.affiliates FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "affiliates_admin_update"
ON public.affiliates FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "affiliates_admin_delete"
ON public.affiliates FOR DELETE
USING (public.is_admin());

-- ============================================================
-- RLS: SAVED JOBS
-- ============================================================
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved jobs" ON public.saved_jobs;

CREATE POLICY "saved_jobs_select_own"
ON public.saved_jobs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "saved_jobs_insert_own"
ON public.saved_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_jobs_delete_own"
ON public.saved_jobs FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================
-- RLS: AFFILIATE CLICKS
-- ============================================================
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_clicks_insert_any_authenticated" ON public.affiliate_clicks;
DROP POLICY IF EXISTS "affiliate_clicks_admin_read" ON public.affiliate_clicks;

CREATE POLICY "affiliate_clicks_insert_authenticated"
ON public.affiliate_clicks FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL);

CREATE POLICY "affiliate_clicks_admin_read"
ON public.affiliate_clicks FOR SELECT
USING (public.is_admin());

-- ============================================================
-- SQL FUNCTION: INCREMENT AFFILIATE CLICKS
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_affiliate_clicks(aff_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.affiliates
  SET click_count = click_count + 1,
      updated_at = NOW()
  WHERE id = aff_id;
END;
$$;
