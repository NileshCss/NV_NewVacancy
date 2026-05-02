-- ============================================================
-- FIX: Admin Panel Action Buttons (Promote/Block/Delete Users)
-- ============================================================
-- ROOT CAUSE:
--   The profiles_admin_all policy was FOR ALL but Postgres
--   evaluates SELECT policies with OR, while UPDATE/DELETE
--   policies are evaluated separately. The admin-all policy
--   wasn't being recognized for write operations.
--
-- FIX: Explicit separate UPDATE and DELETE policies for admins.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ============================================================

-- Drop all existing profile policies
DROP POLICY IF EXISTS "profiles_select_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete"  ON public.profiles;

-- Anyone can read profiles (needed for admin user list + public profile views)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

-- Users can update their OWN profile only
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their OWN profile (on signup trigger)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin/super_admin can UPDATE ANY profile (for block/role changes)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Admin/super_admin can DELETE ANY profile
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE USING (public.is_admin_user());

-- Verify
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
