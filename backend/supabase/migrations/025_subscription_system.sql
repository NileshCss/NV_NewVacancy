-- ============================================================
-- MIGRATION 025: Student Dashboard & Subscription System
-- ============================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  validity_days int,
  question_limit int,
  mock_test_limit int,
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Create student_subscriptions table
CREATE TABLE IF NOT EXISTS public.student_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  status text DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','grace_period')),
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  auto_renew boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Create sponsored_access table
CREATE TABLE IF NOT EXISTS public.sponsored_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  reason text,
  granted_by uuid REFERENCES auth.users(id),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. Create question_usage table
CREATE TABLE IF NOT EXISTS public.question_usage (
  student_id uuid REFERENCES auth.users(id) PRIMARY KEY,
  questions_used int DEFAULT 0,
  last_reset_at timestamptz DEFAULT now()
);

-- 5. Create mock_test_usage table
CREATE TABLE IF NOT EXISTS public.mock_test_usage (
  student_id uuid REFERENCES auth.users(id) PRIMARY KEY,
  mock_tests_used int DEFAULT 0,
  last_reset_at timestamptz DEFAULT now()
);

-- 6. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES auth.users(id),
  plan_id uuid REFERENCES public.subscription_plans(id),
  gateway text DEFAULT 'razorpay',
  gateway_order_id text UNIQUE,
  gateway_payment_id text UNIQUE,
  amount numeric NOT NULL,
  currency text DEFAULT 'INR',
  status text DEFAULT 'pending' CHECK (status IN ('pending','captured','failed','refunded')),
  invoice_number text UNIQUE,
  coupon_code text,
  created_at timestamptz DEFAULT now()
);

-- 7. Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text CHECK (discount_type IN ('flat','percentage')),
  discount_value numeric NOT NULL,
  max_redemptions int,
  max_redemptions_per_student int DEFAULT 1,
  applicable_plan_ids uuid[],
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 8. Create coupon_redemptions table
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.coupons(id),
  student_id uuid REFERENCES auth.users(id),
  payment_id uuid REFERENCES public.payments(id),
  redeemed_at timestamptz DEFAULT now()
);

-- 9. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id),
  referred_id uuid REFERENCES auth.users(id),
  reward_granted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 10. Create feature_permissions table
CREATE TABLE IF NOT EXISTS public.feature_permissions (
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled boolean DEFAULT false,
  PRIMARY KEY (plan_id, feature_key)
);

-- 11. Create subscription_audit_log table
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id),
  student_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "plans_select" ON public.subscription_plans;
DROP POLICY IF EXISTS "plans_write" ON public.subscription_plans;
DROP POLICY IF EXISTS "student_subs_select" ON public.student_subscriptions;
DROP POLICY IF EXISTS "student_subs_write" ON public.student_subscriptions;
DROP POLICY IF EXISTS "sponsored_access_select" ON public.sponsored_access;
DROP POLICY IF EXISTS "sponsored_access_write" ON public.sponsored_access;
DROP POLICY IF EXISTS "question_usage_select" ON public.question_usage;
DROP POLICY IF EXISTS "question_usage_write" ON public.question_usage;
DROP POLICY IF EXISTS "mock_usage_select" ON public.mock_test_usage;
DROP POLICY IF EXISTS "mock_usage_write" ON public.mock_test_usage;
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_write" ON public.payments;
DROP POLICY IF EXISTS "coupons_select" ON public.coupons;
DROP POLICY IF EXISTS "coupons_write" ON public.coupons;
DROP POLICY IF EXISTS "coupon_redemptions_select" ON public.coupon_redemptions;
DROP POLICY IF EXISTS "coupon_redemptions_write" ON public.coupon_redemptions;
DROP POLICY IF EXISTS "referrals_select" ON public.referrals;
DROP POLICY IF EXISTS "referrals_write" ON public.referrals;
DROP POLICY IF EXISTS "feature_perms_select" ON public.feature_permissions;
DROP POLICY IF EXISTS "feature_perms_write" ON public.feature_permissions;
DROP POLICY IF EXISTS "audit_log_select" ON public.subscription_audit_log;
DROP POLICY IF EXISTS "audit_log_write" ON public.subscription_audit_log;

-- 1. subscription_plans
CREATE POLICY "plans_select" ON public.subscription_plans FOR SELECT USING (is_active = true OR public.is_admin_user());
CREATE POLICY "plans_write" ON public.subscription_plans FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 2. student_subscriptions
CREATE POLICY "student_subs_select" ON public.student_subscriptions FOR SELECT USING (student_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "student_subs_write" ON public.student_subscriptions FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 3. sponsored_access
CREATE POLICY "sponsored_access_select" ON public.sponsored_access FOR SELECT USING (student_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "sponsored_access_write" ON public.sponsored_access FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 4. question_usage
CREATE POLICY "question_usage_select" ON public.question_usage FOR SELECT USING (student_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "question_usage_write" ON public.question_usage FOR ALL USING (student_id = auth.uid() OR public.is_admin_user()) WITH CHECK (student_id = auth.uid() OR public.is_admin_user());

-- 5. mock_test_usage
CREATE POLICY "mock_usage_select" ON public.mock_test_usage FOR SELECT USING (student_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "mock_usage_write" ON public.mock_test_usage FOR ALL USING (student_id = auth.uid() OR public.is_admin_user()) WITH CHECK (student_id = auth.uid() OR public.is_admin_user());

-- 6. payments
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (student_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "payments_write" ON public.payments FOR all USING (student_id = auth.uid() OR public.is_admin_user()) WITH CHECK (student_id = auth.uid() OR public.is_admin_user());

-- 7. coupons
CREATE POLICY "coupons_select" ON public.coupons FOR SELECT USING (is_active = true OR public.is_admin_user());
CREATE POLICY "coupons_write" ON public.coupons FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 8. coupon_redemptions
CREATE POLICY "coupon_redemptions_select" ON public.coupon_redemptions FOR SELECT USING (student_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "coupon_redemptions_write" ON public.coupon_redemptions FOR ALL USING (student_id = auth.uid() OR public.is_admin_user()) WITH CHECK (student_id = auth.uid() OR public.is_admin_user());

-- 9. referrals
CREATE POLICY "referrals_select" ON public.referrals FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "referrals_write" ON public.referrals FOR all USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin_user()) WITH CHECK (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin_user());

-- 10. feature_permissions
CREATE POLICY "feature_perms_select" ON public.feature_permissions FOR SELECT USING (true);
CREATE POLICY "feature_perms_write" ON public.feature_permissions FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 11. subscription_audit_log
CREATE POLICY "audit_log_select" ON public.subscription_audit_log FOR SELECT USING (public.is_admin_user());
CREATE POLICY "audit_log_write" ON public.subscription_audit_log FOR INSERT WITH CHECK (public.is_admin_user());

-- ============================================================
-- SEED DATA FOR SUBSCRIPTION PLANS & FEATURE PERMISSIONS
-- ============================================================

-- Clear existing data if any (for clean seeding)
TRUNCATE TABLE public.feature_permissions CASCADE;
DELETE FROM public.subscription_plans;

-- Insert plans (storing returned IDs for feature mapping)
DO $$
DECLARE
  free_id uuid;
  basic_id uuid;
  std_id uuid;
  prem_id uuid;
BEGIN
  -- 1. Free Plan
  INSERT INTO public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  VALUES ('Free', 0, 30, 50, 2, '{"previous_year_papers": false, "ai_analytics": false, "interview_questions": false}', 0)
  RETURNING id INTO free_id;

  -- 2. Basic Plan
  INSERT INTO public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  VALUES ('Basic', 99, 30, 500, 10, '{"previous_year_papers": true, "ai_analytics": false, "interview_questions": false}', 1)
  RETURNING id INTO basic_id;

  -- 3. Standard Plan
  INSERT INTO public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  VALUES ('Standard', 199, 90, 2000, 50, '{"previous_year_papers": true, "ai_analytics": true, "interview_questions": false}', 2)
  RETURNING id INTO std_id;

  -- 4. Premium Plan
  INSERT INTO public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  VALUES ('Premium', 399, 180, null, null, '{"previous_year_papers": true, "ai_analytics": true, "interview_questions": true}', 3)
  RETURNING id INTO prem_id;

  -- Insert feature permissions for Free
  INSERT INTO public.feature_permissions (plan_id, feature_key, is_enabled) VALUES
    (free_id, 'previous_year_papers', false),
    (free_id, 'ai_analytics', false),
    (free_id, 'interview_questions', false);

  -- Insert feature permissions for Basic
  INSERT INTO public.feature_permissions (plan_id, feature_key, is_enabled) VALUES
    (basic_id, 'previous_year_papers', true),
    (basic_id, 'ai_analytics', false),
    (basic_id, 'interview_questions', false);

  -- Insert feature permissions for Standard
  INSERT INTO public.feature_permissions (plan_id, feature_key, is_enabled) VALUES
    (std_id, 'previous_year_papers', true),
    (std_id, 'ai_analytics', true),
    (std_id, 'interview_questions', false);

  -- Insert feature permissions for Premium
  INSERT INTO public.feature_permissions (plan_id, feature_key, is_enabled) VALUES
    (prem_id, 'previous_year_papers', true),
    (prem_id, 'ai_analytics', true),
    (prem_id, 'interview_questions', true);
END;
$$;

-- ============================================================
-- ATOMIC USAGE INCREMENT RPC FUNCTIONS
-- ============================================================

-- Increment question usage
CREATE OR REPLACE FUNCTION public.increment_question_usage(p_student_id uuid, p_limit int)
RETURNS boolean AS $$
DECLARE
  current_count int;
BEGIN
  -- Ensure a usage row exists for the student
  INSERT INTO public.question_usage (student_id, questions_used, last_reset_at)
  VALUES (p_student_id, 0, now())
  ON CONFLICT (student_id) DO NOTHING;

  -- Lock row and select count
  SELECT questions_used INTO current_count
  FROM public.question_usage
  WHERE student_id = p_student_id
  FOR UPDATE;

  -- Check limit
  IF p_limit is not null and current_count >= p_limit THEN
    RETURN false; -- limit reached
  END IF;

  -- Increment usage
  UPDATE public.question_usage
  set questions_used = questions_used + 1
  WHERE student_id = p_student_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment mock test usage
CREATE OR REPLACE FUNCTION public.increment_mock_test_usage(p_student_id uuid, p_limit int)
RETURNS boolean AS $$
DECLARE
  current_count int;
BEGIN
  -- Ensure a usage row exists for the student
  INSERT INTO public.mock_test_usage (student_id, mock_tests_used, last_reset_at)
  VALUES (p_student_id, 0, now())
  ON CONFLICT (student_id) DO NOTHING;

  -- Lock row and select count
  SELECT mock_tests_used INTO current_count
  FROM public.mock_test_usage
  WHERE student_id = p_student_id
  FOR UPDATE;

  -- Check limit
  IF p_limit is not null and current_count >= p_limit THEN
    RETURN false; -- limit reached
  END IF;

  -- Increment usage
  UPDATE public.mock_test_usage
  set mock_tests_used = mock_tests_used + 1
  WHERE student_id = p_student_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
