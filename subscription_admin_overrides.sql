-- ============================================================
-- Migration: Admin Subscription Override Columns
-- Apply in Supabase SQL Editor
-- ============================================================

-- Add per-student limit override columns to student_subscriptions
-- These allow admin to override a student's plan default limits
-- without modifying the shared subscription_plans table.

ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS question_limit_override INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mock_test_limit_override INT DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.student_subscriptions.question_limit_override IS
  'Admin-set per-student question limit. Overrides the plan default when not NULL.';
COMMENT ON COLUMN public.student_subscriptions.mock_test_limit_override IS
  'Admin-set per-student mock test limit. Overrides the plan default when not NULL.';
