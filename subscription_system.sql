-- ============================================================
-- SQL Migration: Student Dashboard & Subscription System
-- ============================================================

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Create subscription_plans table
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  validity_days int,
  question_limit int,
  mock_test_limit int,
  features jsonb default '{}',
  is_active boolean default true,
  display_order int default 0,
  created_at timestamptz default now()
);

-- 2. Create student_subscriptions table
create table if not exists public.student_subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id),
  status text default 'active' check (status in ('active','expired','cancelled','grace_period')),
  started_at timestamptz default now(),
  expires_at timestamptz,
  auto_renew boolean default false,
  created_at timestamptz default now()
);

-- 3. Create sponsored_access table
create table if not exists public.sponsored_access (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id),
  reason text,
  granted_by uuid references auth.users(id),
  valid_until timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 4. Create question_usage table
create table if not exists public.question_usage (
  student_id uuid references auth.users(id) primary key,
  questions_used int default 0,
  last_reset_at timestamptz default now()
);

-- 5. Create mock_test_usage table
create table if not exists public.mock_test_usage (
  student_id uuid references auth.users(id) primary key,
  mock_tests_used int default 0,
  last_reset_at timestamptz default now()
);

-- 6. Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id),
  plan_id uuid references public.subscription_plans(id),
  gateway text default 'razorpay',
  gateway_order_id text unique,
  gateway_payment_id text unique,
  amount numeric not null,
  currency text default 'INR',
  status text default 'pending' check (status in ('pending','captured','failed','refunded')),
  invoice_number text unique,
  coupon_code text,
  created_at timestamptz default now()
);

-- 7. Create coupons table
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text check (discount_type in ('flat','percentage')),
  discount_value numeric not null,
  max_redemptions int,
  max_redemptions_per_student int default 1,
  applicable_plan_ids uuid[],
  expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 8. Create coupon_redemptions table
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references public.coupons(id),
  student_id uuid references auth.users(id),
  payment_id uuid references public.payments(id),
  redeemed_at timestamptz default now()
);

-- 9. Create referrals table
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references auth.users(id),
  referred_id uuid references auth.users(id),
  reward_granted boolean default false,
  created_at timestamptz default now()
);

-- 10. Create feature_permissions table
create table if not exists public.feature_permissions (
  plan_id uuid references public.subscription_plans(id) on delete cascade,
  feature_key text not null,
  is_enabled boolean default false,
  primary key (plan_id, feature_key)
);

-- 11. Create subscription_audit_log table
create table if not exists public.subscription_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  student_id uuid references auth.users(id),
  action text not null,
  reason text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- ============================================================

-- Enable RLS on all tables
alter table public.subscription_plans enable row level security;
alter table public.student_subscriptions enable row level security;
alter table public.sponsored_access enable row level security;
alter table public.question_usage enable row level security;
alter table public.mock_test_usage enable row level security;
alter table public.payments enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.referrals enable row level security;
alter table public.feature_permissions enable row level security;
alter table public.subscription_audit_log enable row level security;

-- Drop existing policies if any
drop policy if exists "plans_select" on public.subscription_plans;
drop policy if exists "plans_write" on public.subscription_plans;
drop policy if exists "student_subs_select" on public.student_subscriptions;
drop policy if exists "student_subs_write" on public.student_subscriptions;
drop policy if exists "sponsored_access_select" on public.sponsored_access;
drop policy if exists "sponsored_access_write" on public.sponsored_access;
drop policy if exists "question_usage_select" on public.question_usage;
drop policy if exists "question_usage_write" on public.question_usage;
drop policy if exists "mock_usage_select" on public.mock_test_usage;
drop policy if exists "mock_usage_write" on public.mock_test_usage;
drop policy if exists "payments_select" on public.payments;
drop policy if exists "payments_write" on public.payments;
drop policy if exists "coupons_select" on public.coupons;
drop policy if exists "coupons_write" on public.coupons;
drop policy if exists "coupon_redemptions_select" on public.coupon_redemptions;
drop policy if exists "coupon_redemptions_write" on public.coupon_redemptions;
drop policy if exists "referrals_select" on public.referrals;
drop policy if exists "referrals_write" on public.referrals;
drop policy if exists "feature_perms_select" on public.feature_permissions;
drop policy if exists "feature_perms_write" on public.feature_permissions;
drop policy if exists "audit_log_select" on public.subscription_audit_log;
drop policy if exists "audit_log_write" on public.subscription_audit_log;

-- 1. subscription_plans
create policy "plans_select" on public.subscription_plans for select using (is_active = true or public.is_admin_user());
create policy "plans_write" on public.subscription_plans for all using (public.is_admin_user()) with check (public.is_admin_user());

-- 2. student_subscriptions
create policy "student_subs_select" on public.student_subscriptions for select using (student_id = auth.uid() or public.is_admin_user());
create policy "student_subs_write" on public.student_subscriptions for all using (public.is_admin_user()) with check (public.is_admin_user());

-- 3. sponsored_access
create policy "sponsored_access_select" on public.sponsored_access for select using (student_id = auth.uid() or public.is_admin_user());
create policy "sponsored_access_write" on public.sponsored_access for all using (public.is_admin_user()) with check (public.is_admin_user());

-- 4. question_usage
create policy "question_usage_select" on public.question_usage for select using (student_id = auth.uid() or public.is_admin_user());
create policy "question_usage_write" on public.question_usage for all using (student_id = auth.uid() or public.is_admin_user()) with check (student_id = auth.uid() or public.is_admin_user());

-- 5. mock_test_usage
create policy "mock_usage_select" on public.mock_test_usage for select using (student_id = auth.uid() or public.is_admin_user());
create policy "mock_usage_write" on public.mock_test_usage for all using (student_id = auth.uid() or public.is_admin_user()) with check (student_id = auth.uid() or public.is_admin_user());

-- 6. payments
create policy "payments_select" on public.payments for select using (student_id = auth.uid() or public.is_admin_user());
create policy "payments_write" on public.payments for all using (student_id = auth.uid() or public.is_admin_user()) with check (student_id = auth.uid() or public.is_admin_user());

-- 7. coupons
create policy "coupons_select" on public.coupons for select using (is_active = true or public.is_admin_user());
create policy "coupons_write" on public.coupons for all using (public.is_admin_user()) with check (public.is_admin_user());

-- 8. coupon_redemptions
create policy "coupon_redemptions_select" on public.coupon_redemptions for select using (student_id = auth.uid() or public.is_admin_user());
create policy "coupon_redemptions_write" on public.coupon_redemptions for all using (student_id = auth.uid() or public.is_admin_user()) with check (student_id = auth.uid() or public.is_admin_user());

-- 9. referrals
create policy "referrals_select" on public.referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin_user());
create policy "referrals_write" on public.referrals for all using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin_user()) with check (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin_user());

-- 10. feature_permissions
create policy "feature_perms_select" on public.feature_permissions for select using (true);
create policy "feature_perms_write" on public.feature_permissions for all using (public.is_admin_user()) with check (public.is_admin_user());

-- 11. subscription_audit_log
create policy "audit_log_select" on public.subscription_audit_log for select using (public.is_admin_user());
create policy "audit_log_write" on public.subscription_audit_log for insert with check (public.is_admin_user());

-- ============================================================
-- SEED DATA FOR SUBSCRIPTION PLANS & FEATURE PERMISSIONS
-- ============================================================

-- Clear existing data if any (for clean seeding)
truncate table public.feature_permissions cascade;
delete from public.subscription_plans;

-- Insert plans (storing returned IDs for feature mapping)
do $$
declare
  free_id uuid;
  basic_id uuid;
  std_id uuid;
  prem_id uuid;
begin
  -- 1. Free Plan
  insert into public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  values ('Free', 0, 30, 50, 2, '{"previous_year_papers": false, "ai_analytics": false, "interview_questions": false}', 0)
  returning id into free_id;

  -- 2. Basic Plan
  insert into public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  values ('Basic', 99, 30, 500, 10, '{"previous_year_papers": true, "ai_analytics": false, "interview_questions": false}', 1)
  returning id into basic_id;

  -- 3. Standard Plan
  insert into public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  values ('Standard', 199, 90, 2000, 50, '{"previous_year_papers": true, "ai_analytics": true, "interview_questions": false}', 2)
  returning id into std_id;

  -- 4. Premium Plan
  insert into public.subscription_plans (name, price, validity_days, question_limit, mock_test_limit, features, display_order)
  values ('Premium', 399, 180, null, null, '{"previous_year_papers": true, "ai_analytics": true, "interview_questions": true}', 3)
  returning id into prem_id;

  -- Insert feature permissions for Free
  insert into public.feature_permissions (plan_id, feature_key, is_enabled) values
    (free_id, 'previous_year_papers', false),
    (free_id, 'ai_analytics', false),
    (free_id, 'interview_questions', false);

  -- Insert feature permissions for Basic
  insert into public.feature_permissions (plan_id, feature_key, is_enabled) values
    (basic_id, 'previous_year_papers', true),
    (basic_id, 'ai_analytics', false),
    (basic_id, 'interview_questions', false);

  -- Insert feature permissions for Standard
  insert into public.feature_permissions (plan_id, feature_key, is_enabled) values
    (std_id, 'previous_year_papers', true),
    (std_id, 'ai_analytics', true),
    (std_id, 'interview_questions', false);

  -- Insert feature permissions for Premium
  insert into public.feature_permissions (plan_id, feature_key, is_enabled) values
    (prem_id, 'previous_year_papers', true),
    (prem_id, 'ai_analytics', true),
    (prem_id, 'interview_questions', true);
end;
$$;

-- ============================================================
-- ATOMIC USAGE INCREMENT RPC FUNCTIONS
-- ============================================================

-- Increment question usage
create or replace function public.increment_question_usage(p_student_id uuid, p_limit int)
returns boolean as $$
declare
  current_count int;
begin
  -- Ensure a usage row exists for the student
  insert into public.question_usage (student_id, questions_used, last_reset_at)
  values (p_student_id, 0, now())
  on conflict (student_id) do nothing;

  -- Lock row and select count
  select questions_used into current_count
  from public.question_usage
  where student_id = p_student_id
  for update;

  -- Check limit
  if p_limit is not null and current_count >= p_limit then
    return false; -- limit reached
  end if;

  -- Increment usage
  update public.question_usage
  set questions_used = questions_used + 1
  where student_id = p_student_id;

  return true;
end;
$$ language plpgsql security definer;

-- Increment mock test usage
create or replace function public.increment_mock_test_usage(p_student_id uuid, p_limit int)
returns boolean as $$
declare
  current_count int;
begin
  -- Ensure a usage row exists for the student
  insert into public.mock_test_usage (student_id, mock_tests_used, last_reset_at)
  values (p_student_id, 0, now())
  on conflict (student_id) do nothing;

  -- Lock row and select count
  select mock_tests_used into current_count
  from public.mock_test_usage
  where student_id = p_student_id
  for update;

  -- Check limit
  if p_limit is not null and current_count >= p_limit then
    return false; -- limit reached
  end if;

  -- Increment usage
  update public.mock_test_usage
  set mock_tests_used = mock_tests_used + 1
  where student_id = p_student_id;

  return true;
end;
$$ language plpgsql security definer;
