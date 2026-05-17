-- ============================================================
-- MIGRATION 014: FIX SUPER ADMIN RLS RECURSION
-- ============================================================
-- Fixes the issue where the super admin email is not recognized as an admin by RLS policies.
-- By checking both 'admin' and 'super_admin' roles, AND checking the hardcoded super admin email.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_access BOOLEAN := FALSE;
  user_email TEXT;
BEGIN
  -- Get user email from auth.jwt() to check against hardcoded super admin
  SELECT auth.jwt() ->> 'email' INTO user_email;

  IF user_email = 'rajputnileshsingh3@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT (p.role IN ('admin', 'super_admin') AND COALESCE(p.is_blocked, FALSE) = FALSE)
    INTO has_access
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(has_access, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
