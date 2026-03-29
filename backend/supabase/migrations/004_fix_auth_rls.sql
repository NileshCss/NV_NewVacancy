-- ============================================================
-- MIGRATION 004: FIX AUTH RLS + ADMIN POLICIES
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Step 1: Drop conflicting old policies ────────────────────
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_policy" ON public.profiles;

-- ── Step 2: Re-create clean read policy ─────────────────────
-- Users can read their own profile, admins can read ALL profiles
CREATE POLICY "profiles_read_policy"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.id = auth.uid() AND p2.role = 'admin'
  )
);

-- ── Step 3: Fix is_admin() to avoid recursion ────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_blocked = FALSE
  );
$$;

-- ── Step 4: Grant anon / authenticated access to profiles ────
GRANT SELECT ON public.profiles TO anon, authenticated;

-- ── Step 5: How to create your first admin user ──────────────
-- After signing up on the website, run the following:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE email = 'your-email@example.com';
--
--   -- Verify it worked:
--   SELECT id, email, role, is_blocked
--   FROM public.profiles
--   WHERE email = 'your-email@example.com';
--   -- Expected: role = 'admin'
