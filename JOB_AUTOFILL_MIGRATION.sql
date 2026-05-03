-- ============================================================
-- Job URL Auto-Fill + Auto-Expiry Migration
-- NewVacancy.live — Run in Supabase SQL Editor
-- ============================================================

-- 1. Add new columns to the jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS source_url        TEXT          DEFAULT '',
  ADD COLUMN IF NOT EXISTS scraped           BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_checked_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_expired      BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS scrape_confidence INTEGER       DEFAULT 0;

-- 2. Performance indexes for the nightly expiry checker
CREATE INDEX IF NOT EXISTS idx_jobs_source_url
  ON jobs(source_url)
  WHERE source_url IS NOT NULL AND source_url != '';

CREATE INDEX IF NOT EXISTS idx_jobs_active_scraped
  ON jobs(is_active, scraped)
  WHERE scraped = true;

-- 3. Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('source_url', 'scraped', 'last_checked_at', 'auto_expired', 'scrape_confidence')
ORDER BY column_name;
