-- ============================================================
-- 022_ai_scraper_schema.sql
-- NewVacancy — AI Scraper Platform Extension
-- ALL changes are additive (ADD COLUMN IF NOT EXISTS).
-- Safe to run on existing production database.
-- ============================================================

-- Enable pg_trgm for fuzzy duplicate detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- EXTEND JOBS TABLE (additive only)
-- ============================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS slug              TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'published'
                                             CHECK (status IN ('draft','published','expired','flagged_review')),
  ADD COLUMN IF NOT EXISTS source_url        TEXT,
  ADD COLUMN IF NOT EXISTS source_name       TEXT,
  ADD COLUMN IF NOT EXISTS meta_title        TEXT,
  ADD COLUMN IF NOT EXISTS meta_description  TEXT,
  ADD COLUMN IF NOT EXISTS keywords          TEXT[],
  ADD COLUMN IF NOT EXISTS json_ld           JSONB,
  ADD COLUMN IF NOT EXISTS employment_type   TEXT DEFAULT 'Full-time'
                                             CHECK (employment_type IN ('Full-time','Part-time','Contract','Internship','Freelance','Walk-in')),
  ADD COLUMN IF NOT EXISTS work_mode         TEXT DEFAULT 'Office'
                                             CHECK (work_mode IN ('Office','Remote','Hybrid')),
  ADD COLUMN IF NOT EXISTS is_walkin         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_internship     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS walkin_date       DATE,
  ADD COLUMN IF NOT EXISTS walkin_venue      TEXT,
  ADD COLUMN IF NOT EXISTS batch_year        TEXT,
  ADD COLUMN IF NOT EXISTS skills            TEXT[],
  ADD COLUMN IF NOT EXISTS experience_min    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS experience_max    INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS company_id        UUID,  -- FK added after companies table
  ADD COLUMN IF NOT EXISTS city_id           UUID,  -- FK added after cities table
  ADD COLUMN IF NOT EXISTS scrape_confidence INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_flags          JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS raw_html_ref      TEXT,
  ADD COLUMN IF NOT EXISTS view_count        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS apply_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_description   TEXT,
  ADD COLUMN IF NOT EXISTS benefits          TEXT,
  ADD COLUMN IF NOT EXISTS scraped           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canonical_url     TEXT,
  ADD COLUMN IF NOT EXISTS apply_deadline    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- COMPANIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE,
  description  TEXT,
  logo_url     TEXT,
  website      TEXT,
  careers_url  TEXT,
  industry     TEXT,
  size         TEXT,
  verified     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- FK from jobs → companies (safe, non-blocking)
DO $$ BEGIN
  ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- CITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cities (
  id       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name     TEXT NOT NULL,
  slug     TEXT UNIQUE,
  state    TEXT,
  country  TEXT DEFAULT 'India'
);

-- FK from jobs → cities
DO $$ BEGIN
  ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_city_id_fkey
    FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- CATEGORIES TABLE (hierarchical)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name      TEXT NOT NULL,
  slug      TEXT UNIQUE NOT NULL,
  icon      TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL
);

-- Seed core categories
INSERT INTO public.categories (name, slug, icon) VALUES
  ('IT / Software',       'it-software',      '💻'),
  ('Government',          'government',        '🏛️'),
  ('Banking & Finance',   'banking-finance',   '🏦'),
  ('Internship',          'internship',        '🎓'),
  ('Walk-in Drive',       'walkin',            '🚶'),
  ('Mass Hiring',         'mass-hiring',       '👥'),
  ('Off-Campus Drive',    'off-campus',        '🎯'),
  ('Non-IT',              'non-it',            '📦'),
  ('Engineering',         'engineering',       '⚙️'),
  ('Marketing / Sales',   'marketing-sales',   '📈'),
  ('Healthcare',          'healthcare',        '🏥'),
  ('Education',           'education',         '📚')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SKILLS TABLE (normalized taxonomy)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skills (
  id       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name     TEXT NOT NULL,
  slug     TEXT UNIQUE NOT NULL,
  category TEXT
);

-- ============================================================
-- WALKINS TABLE (walk-in specific details)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.walkins (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id           UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  venue            TEXT,
  address          TEXT,
  date             DATE NOT NULL,
  start_time       TIME,
  end_time         TIME,
  required_docs    TEXT[],
  dress_code       TEXT,
  map_url          TEXT,
  registration_url TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCRAPE LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scrape_logs (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_name    TEXT NOT NULL,
  run_at         TIMESTAMPTZ DEFAULT NOW(),
  status         TEXT CHECK (status IN ('running','success','partial','failed')),
  jobs_found     INTEGER DEFAULT 0,
  jobs_inserted  INTEGER DEFAULT 0,
  jobs_skipped   INTEGER DEFAULT 0,
  jobs_duplicate INTEGER DEFAULT 0,
  jobs_flagged   INTEGER DEFAULT 0,
  error_msg      TEXT,
  checkpoint     TEXT,  -- last processed URL/page for resume
  duration_ms    INTEGER
);

-- ============================================================
-- AI LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  prompt_hash      TEXT,
  model            TEXT,
  provider         TEXT,  -- 'ollama' | 'groq' | 'anthropic'
  input_length     INTEGER,
  output_length    INTEGER,
  raw_output       TEXT,
  parsed_ok        BOOLEAN,
  validation_error TEXT,
  job_id           UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS TABLE (delivery queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type       TEXT CHECK (type IN ('telegram','email','whatsapp')),
  recipient  TEXT,
  job_id     UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  status     TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  error_msg  TEXT,
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANALYTICS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analytics (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT CHECK (event_type IN ('view','apply','search','share','save')),
  job_id     UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_hash    TEXT,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES (Performance)
-- ============================================================

-- Jobs extended indexes
CREATE INDEX IF NOT EXISTS idx_jobs_slug         ON public.jobs(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_status       ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_is_walkin    ON public.jobs(is_walkin, walkin_date);
CREATE INDEX IF NOT EXISTS idx_jobs_is_internship ON public.jobs(is_internship);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id   ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_city_id      ON public.jobs(city_id);
CREATE INDEX IF NOT EXISTS idx_jobs_skills       ON public.jobs USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_jobs_keywords     ON public.jobs USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_jobs_source       ON public.jobs(source_name);
CREATE INDEX IF NOT EXISTS idx_jobs_work_mode    ON public.jobs(work_mode);

-- Create an immutable wrapper for array_to_string so it can be used in an index
CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT array_to_string($1, $2);
$$;

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_jobs_fts ON public.jobs
  USING GIN (to_tsvector('english',
    coalesce(title,'') || ' ' ||
    coalesce(organization,'') || ' ' ||
    coalesce(location,'') || ' ' ||
    coalesce(immutable_array_to_string(skills,' '),'') || ' ' ||
    coalesce(immutable_array_to_string(tags,' '),'')
  ));

-- Trigram index for fuzzy duplicate detection
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm        ON public.jobs USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_organization_trgm ON public.jobs USING GIN(organization gin_trgm_ops);

-- Other tables
CREATE INDEX IF NOT EXISTS idx_scrape_logs_source  ON public.scrape_logs(source_name, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_job         ON public.ai_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_analytics_job       ON public.analytics(job_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event     ON public.analytics(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_walkins_date        ON public.walkins(date);
CREATE INDEX IF NOT EXISTS idx_walkins_job         ON public.walkins(job_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug      ON public.companies(slug);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Companies (public read, admin write)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read companies"  ON public.companies;
DROP POLICY IF EXISTS "Admin manage companies" ON public.companies;
CREATE POLICY "Public read companies"  ON public.companies FOR SELECT USING (true);
CREATE POLICY "Admin manage companies" ON public.companies FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- Cities (public read)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read cities" ON public.cities;
CREATE POLICY "Public read cities" ON public.cities FOR SELECT USING (true);

-- Categories (public read)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);

-- Skills (public read)
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read skills" ON public.skills;
CREATE POLICY "Public read skills" ON public.skills FOR SELECT USING (true);

-- Walkins (public read active, admin write)
ALTER TABLE public.walkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read walkins"  ON public.walkins;
DROP POLICY IF EXISTS "Admin manage walkins" ON public.walkins;
CREATE POLICY "Public read walkins"  ON public.walkins FOR SELECT USING (true);
CREATE POLICY "Admin manage walkins" ON public.walkins FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- Scrape logs (admin only)
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read scrape_logs" ON public.scrape_logs;
CREATE POLICY "Admin read scrape_logs" ON public.scrape_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- AI logs (admin only)
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read ai_logs" ON public.ai_logs;
CREATE POLICY "Admin read ai_logs" ON public.ai_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- Notifications (service role only — no direct user access)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Analytics (admin read, service write)
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read analytics" ON public.analytics;
CREATE POLICY "Admin read analytics" ON public.analytics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- ============================================================
-- RPC: Full-text + filtered job search
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_jobs(
  query_text TEXT DEFAULT '',
  p_category TEXT DEFAULT NULL,
  p_city     TEXT DEFAULT NULL,
  p_remote   BOOLEAN DEFAULT NULL,
  p_walkin   BOOLEAN DEFAULT NULL,
  p_internship BOOLEAN DEFAULT NULL,
  p_limit    INTEGER DEFAULT 20,
  p_offset   INTEGER DEFAULT 0
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT j.* FROM public.jobs j
  WHERE
    j.status = 'published'
    AND (j.is_active = TRUE OR j.is_active IS NULL)
    AND (query_text = '' OR
         to_tsvector('english',
           coalesce(j.title,'') || ' ' ||
           coalesce(j.organization,'') || ' ' ||
           coalesce(j.location,'') || ' ' ||
           coalesce(array_to_string(j.skills,' '),'')
         ) @@ plainto_tsquery('english', query_text)
    )
    AND (p_category IS NULL OR j.category = p_category)
    AND (p_city IS NULL     OR j.location ILIKE '%' || p_city || '%')
    AND (p_remote IS NULL   OR j.work_mode = 'Remote')
    AND (p_walkin IS NULL   OR j.is_walkin = p_walkin)
    AND (p_internship IS NULL OR j.is_internship = p_internship)
  ORDER BY j.posted_at DESC
  LIMIT p_limit OFFSET p_offset;
END $$;

-- ============================================================
-- RPC: Duplicate detection
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_duplicate_jobs(
  p_title    TEXT,
  p_org      TEXT,
  p_location TEXT,
  p_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE(id UUID, title TEXT, organization TEXT, similarity_score FLOAT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    j.organization,
    (
      similarity(lower(j.title), lower(p_title)) * 0.5 +
      similarity(lower(j.organization), lower(p_org)) * 0.3 +
      similarity(lower(coalesce(j.location,'')), lower(coalesce(p_location,''))) * 0.2
    ) AS similarity_score
  FROM public.jobs j
  WHERE
    j.status IN ('published','draft')
    AND j.posted_at > NOW() - INTERVAL '30 days'
  HAVING (
      similarity(lower(j.title), lower(p_title)) * 0.5 +
      similarity(lower(j.organization), lower(p_org)) * 0.3 +
      similarity(lower(coalesce(j.location,'')), lower(coalesce(p_location,''))) * 0.2
    ) >= p_threshold
  ORDER BY similarity_score DESC
  LIMIT 5;
END $$;

-- ============================================================
-- TRIGGER: auto-update updated_at for new tables
-- ============================================================
CREATE TRIGGER walkins_updated_at   BEFORE UPDATE ON public.walkins   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed some major cities
INSERT INTO public.cities (name, slug, state) VALUES
  ('Mumbai',      'mumbai',       'Maharashtra'),
  ('Delhi',       'delhi',        'Delhi'),
  ('Bangalore',   'bangalore',    'Karnataka'),
  ('Hyderabad',   'hyderabad',    'Telangana'),
  ('Chennai',     'chennai',      'Tamil Nadu'),
  ('Pune',        'pune',         'Maharashtra'),
  ('Kolkata',     'kolkata',      'West Bengal'),
  ('Ahmedabad',   'ahmedabad',    'Gujarat'),
  ('Noida',       'noida',        'Uttar Pradesh'),
  ('Gurgaon',     'gurgaon',      'Haryana'),
  ('Jaipur',      'jaipur',       'Rajasthan'),
  ('Lucknow',     'lucknow',      'Uttar Pradesh'),
  ('Bhopal',      'bhopal',       'Madhya Pradesh'),
  ('Patna',       'patna',        'Bihar'),
  ('All India',   'all-india',    NULL)
ON CONFLICT (slug) DO NOTHING;
