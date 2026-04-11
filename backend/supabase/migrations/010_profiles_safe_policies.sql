-- ============================================================
-- MIGRATION 010: SAFE PROFILES RLS POLICIES
-- Clean profile policies without recursive conditions.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove legacy/conflicting policies.
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Users can read only their own profile.
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can read all profiles.
CREATE POLICY "profiles_select_admin"
ON public.profiles
FOR SELECT
USING (public.is_admin());

-- Users can insert their own profile row (fallback path).
CREATE POLICY "profiles_insert_self"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Admins can insert profile rows.
CREATE POLICY "profiles_insert_admin"
ON public.profiles
FOR INSERT
WITH CHECK (public.is_admin());

-- Users can update their own profile.
CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any profile.
CREATE POLICY "profiles_update_admin"
ON public.profiles
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admins can delete profile rows.
CREATE POLICY "profiles_delete_admin"
ON public.profiles
FOR DELETE
USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
