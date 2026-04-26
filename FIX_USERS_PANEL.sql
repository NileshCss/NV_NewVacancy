-- ============================================================
-- FIX_USERS_PANEL.sql
-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: 0 users showing in admin panel
-- ============================================================

-- ── STEP 1: Backfill profiles from existing auth.users ─────
-- Inserts a profile row for every user that signed up but
-- doesn't have a profiles entry yet (no trigger was set up).
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ) AS full_name,
  'user' AS role,
  u.created_at,
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET
    email      = EXCLUDED.email,
    updated_at = NOW();

-- Verify backfill:
SELECT id, email, full_name, role FROM public.profiles ORDER BY created_at DESC;


-- ── STEP 2: Auto-trigger — create profile on every new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── STEP 3: Enable RLS + fix SELECT policy on profiles ─────
-- Without this, admin can only see their OWN row → 0 other users.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    -- users can always read their own row
    auth.uid() = id
    OR
    -- admin / super_admin can read ALL rows
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'super_admin')
          OR p.email = 'rajputnileshsingh3@gmail.com'
        )
    )
  );

-- Allow admins to update profiles (block/unblock, role changes)
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

-- Allow admins to delete regular users
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

-- Allow new users to insert their own profile (signup flow)
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR auth.role() = 'service_role'
  );


-- ── STEP 4: Make sure super_admin role is set correctly ─────
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'rajputnileshsingh3@gmail.com';


-- ── STEP 5: Verify everything ───────────────────────────────
SELECT id, email, full_name, role, is_blocked, created_at
FROM public.profiles
ORDER BY created_at DESC;
