-- ============================================================
-- NEW_VACANCY (NV) — Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOBS TABLE
-- ============================================================
CREATE TABLE public.jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('govt', 'private')),
  department TEXT,
  location TEXT DEFAULT 'India',
  state TEXT,                          -- For govt jobs (e.g., UP, Bihar)
  qualification TEXT,
  vacancies INTEGER,
  salary_range TEXT,
  age_limit TEXT,
  apply_url TEXT NOT NULL,
  notification_url TEXT,               -- PDF link for official notification
  last_date DATE,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  tags TEXT[],                         -- ['ssc', 'banking', 'it', 'engineering']
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NEWS TABLE
-- ============================================================
CREATE TABLE public.news (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  source_name TEXT,
  source_url TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('tech', 'govt', 'education', 'general')),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AFFILIATES TABLE
-- ============================================================
CREATE TABLE public.affiliates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  redirect_url TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('courses', 'books', 'tools', 'general', 'exam-prep')),
  position INTEGER DEFAULT 0,          -- Display order
  placement TEXT DEFAULT 'sidebar' CHECK (placement IN ('hero', 'sidebar', 'inline', 'footer', 'popup')),
  is_active BOOLEAN DEFAULT TRUE,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAVED JOBS (User bookmarks)
-- ============================================================
CREATE TABLE public.saved_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ============================================================
-- AFFILIATE CLICKS (Analytics)
-- ============================================================
CREATE TABLE public.affiliate_clicks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Jobs (public read, admin write)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active jobs" ON public.jobs FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage jobs" ON public.jobs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- News (public read, admin write)
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active news" ON public.news FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage news" ON public.news FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Affiliates (public read, admin write)
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active affiliates" ON public.affiliates FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage affiliates" ON public.affiliates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Saved Jobs
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved jobs" ON public.saved_jobs FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES (Performance)
-- ============================================================
CREATE INDEX idx_jobs_category ON public.jobs(category);
CREATE INDEX idx_jobs_state ON public.jobs(state);
CREATE INDEX idx_jobs_posted_at ON public.jobs(posted_at DESC);
CREATE INDEX idx_jobs_last_date ON public.jobs(last_date);
CREATE INDEX idx_jobs_is_active ON public.jobs(is_active);
CREATE INDEX idx_news_category ON public.news(category);
CREATE INDEX idx_news_published_at ON public.news(published_at DESC);
CREATE INDEX idx_affiliates_position ON public.affiliates(position);
CREATE INDEX idx_saved_jobs_user ON public.saved_jobs(user_id);

-- ============================================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER affiliates_updated_at BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
