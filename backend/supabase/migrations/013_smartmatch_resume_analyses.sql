-- SmartMatch™ Resume Analysis Database Schema
-- Execute this in Supabase SQL Editor to create the resume_analyses table

-- ┌──────────────────────────────────────────────────────┐
-- │ Resume Analyses Table                                │
-- └──────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.resume_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  ats_score INTEGER DEFAULT 0,
  grade TEXT DEFAULT 'D',
  full_result JSONB NOT NULL,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ┌──────────────────────────────────────────────────────┐
-- │ Indexes for Performance                              │
-- └──────────────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_ra_user ON public.resume_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_ra_hash ON public.resume_analyses(file_hash);
CREATE INDEX IF NOT EXISTS idx_ra_created ON public.resume_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ra_ats_score ON public.resume_analyses(ats_score DESC);

-- ┌──────────────────────────────────────────────────────┐
-- │ Row Level Security (RLS)                             │
-- └──────────────────────────────────────────────────────┘
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own analyses
CREATE POLICY IF NOT EXISTS "users_own_analyses" ON public.resume_analyses
  FOR ALL
  USING (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────┐
-- │ Grant Permissions                                    │
-- └──────────────────────────────────────────────────────┘
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_analyses TO authenticated;
