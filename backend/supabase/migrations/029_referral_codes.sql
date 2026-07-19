-- ============================================================
-- MIGRATION 029: Add referral_code to profiles + fix referrals RLS
-- ============================================================

-- Add referral_code column to profiles (unique short code per user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Add referred_by column to profiles (which referral code was used at signup)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by text;

-- Auto-generate referral codes for existing users who don't have one
UPDATE public.profiles
SET referral_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Create an index for fast lookups by referral_code
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Fix the referrals INSERT policy: currently requires referrer_id OR referred_id = auth.uid()
-- A newly signed-up user inserting their own referral record will be the referred_id.
-- The existing "referrals_write" policy already covers this (referred_id = auth.uid()),
-- but let's make sure there's a clean INSERT-only policy for new users:
DROP POLICY IF EXISTS "referrals_insert_new_user" ON public.referrals;
CREATE POLICY "referrals_insert_new_user" ON public.referrals
  FOR INSERT WITH CHECK (referred_id = auth.uid() OR public.is_admin_user());

-- Create a DB function so the frontend can look up a referrer's user_id by their referral_code
-- (runs as SECURITY DEFINER so anon/new users can do the lookup without needing profiles RLS access)
CREATE OR REPLACE FUNCTION public.get_referrer_by_code(p_code text)
RETURNS uuid AS $$
  SELECT id FROM public.profiles
  WHERE referral_code = UPPER(p_code)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_referrer_by_code(text) TO anon, authenticated;
