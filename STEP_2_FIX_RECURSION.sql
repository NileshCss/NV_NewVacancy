-- Drop the broken recursive policy
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

-- Recreate it using the safe is_admin() function to avoid infinite recursion
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (public.is_admin());
