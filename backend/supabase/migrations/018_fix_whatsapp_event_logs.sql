-- ============================================================
-- MIGRATION 018: Fix whatsapp_logs table for event logging
-- ============================================================
--
-- Migration 017 created whatsapp_logs for vacancy send-tracking
-- (vacancy_id, sent_at, status, error_message, retry_count).
-- The new whatsappService.js inserts event log rows with a
-- completely different shape:
--   event_type, reason, phone_number, triggered_by, created_at
--
-- This migration adds those missing columns (non-destructive —
-- existing rows and the old columns are preserved).
-- Also grants service_role explicit INSERT permission so the
-- backend can bypass RLS when writing logs.
--
-- Safe to run multiple times (all statements use IF NOT EXISTS
-- or IF column does not already exist guards via DO block).
-- ============================================================

-- 1. Add missing columns (no-ops if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_logs'
      AND column_name  = 'event_type'
  ) THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN event_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_logs'
      AND column_name  = 'reason'
  ) THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_logs'
      AND column_name  = 'phone_number'
  ) THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN phone_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_logs'
      AND column_name  = 'triggered_by'
  ) THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN triggered_by text DEFAULT 'system';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_logs'
      AND column_name  = 'created_at'
  ) THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 2. Index on event_type for fast filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_event_type
  ON public.whatsapp_logs(event_type);

-- Index on created_at for ordered queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at
  ON public.whatsapp_logs(created_at DESC);

-- 3. Grant service_role explicit INSERT + SELECT so the backend
--    can write event logs even when RLS is enabled.
--    (service_role bypasses RLS by default in Supabase, but this
--    is an explicit belt-and-suspenders grant.)
GRANT SELECT, INSERT ON public.whatsapp_logs TO service_role;

-- 4. Add a permissive RLS policy for service_role inserts
--    (Supabase service_role bypasses RLS, but make it explicit
--    in case your project has overridden that default.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'whatsapp_logs'
      AND policyname = 'service_role can insert whatsapp logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service_role can insert whatsapp logs"
      ON public.whatsapp_logs
      FOR INSERT
      TO service_role
      WITH CHECK (true)
    $policy$;
  END IF;
END $$;

-- 5. Verify: show column list after migration
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'whatsapp_logs'
ORDER BY ordinal_position;
