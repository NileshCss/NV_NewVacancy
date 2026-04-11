-- ============================================================
-- Migration 006: New News & Affiliates Schema with RLS
-- ============================================================

-- ============================================================
-- NEW NEWS TABLE (v2) with improved schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.news_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  excerpt TEXT,
  content TEXT,
  cover_image TEXT,
  category TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- NEW AFFILIATES TABLE (v2) with improved schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.affiliates_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  platform TEXT,
  url TEXT NOT NULL,
  description TEXT,
  image TEXT,
  clicks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- NEW STORAGE BUCKETS (for images)
-- ============================================================
-- Note: Buckets must be created via Supabase UI or API
-- This is a reminder of the buckets needed:
-- - news-images
-- - affiliate-images

-- ============================================================
-- FUNCTION: Increment Affiliate Clicks
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_affiliate_clicks(aff_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.affiliates_v2
  SET clicks = clicks + 1
  WHERE id = aff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS: Enable RLS on tables
-- ============================================================
ALTER TABLE public.news_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates_v2 ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: NEWS (Public read, Admin write)
-- ============================================================
CREATE POLICY "news_v2_public_read" ON public.news_v2
  FOR SELECT USING (status = 'published' OR (auth.uid() = created_by) OR public.is_admin());

CREATE POLICY "news_v2_admin_insert" ON public.news_v2
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "news_v2_admin_update" ON public.news_v2
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "news_v2_admin_delete" ON public.news_v2
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- RLS POLICIES: AFFILIATES (Public read, Admin write)
-- ============================================================
CREATE POLICY "affiliates_v2_public_read" ON public.affiliates_v2
  FOR SELECT USING (status = 'active');

CREATE POLICY "affiliates_v2_admin_read" ON public.affiliates_v2
  FOR SELECT USING (public.is_admin());

CREATE POLICY "affiliates_v2_admin_insert" ON public.affiliates_v2
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "affiliates_v2_admin_update" ON public.affiliates_v2
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "affiliates_v2_admin_delete" ON public.affiliates_v2
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_news_v2_status ON public.news_v2(status);
CREATE INDEX IF NOT EXISTS idx_news_v2_category ON public.news_v2(category);
CREATE INDEX IF NOT EXISTS idx_news_v2_created_at ON public.news_v2(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliates_v2_status ON public.affiliates_v2(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_v2_platform ON public.affiliates_v2(platform);

-- ============================================================
-- GRANTS (allow public to use the increment function)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.increment_affiliate_clicks(UUID) TO authenticated, anon;
