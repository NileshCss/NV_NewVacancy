-- ============================================================
-- MIGRATION 011: AI ACTIVITY LOG TABLE + POLICIES
-- Supports admin AI audit trail from frontend and edge functions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT,
  action TEXT,
  prompt TEXT,
  response TEXT,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  error_message TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_activity_log_created_at ON public.ai_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_activity_log_admin_id ON public.ai_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_ai_activity_log_action_type ON public.ai_activity_log(action_type);

ALTER TABLE public.ai_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_activity_log_select" ON public.ai_activity_log;
DROP POLICY IF EXISTS "ai_activity_log_insert" ON public.ai_activity_log;
DROP POLICY IF EXISTS "ai_activity_log_update" ON public.ai_activity_log;

CREATE POLICY "ai_activity_log_select"
ON public.ai_activity_log
FOR SELECT
USING (auth.uid() = admin_id OR public.is_admin());

CREATE POLICY "ai_activity_log_insert"
ON public.ai_activity_log
FOR INSERT
WITH CHECK (auth.uid() = admin_id OR public.is_admin());

CREATE POLICY "ai_activity_log_update"
ON public.ai_activity_log
FOR UPDATE
USING (auth.uid() = admin_id OR public.is_admin())
WITH CHECK (auth.uid() = admin_id OR public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.ai_activity_log TO authenticated;
