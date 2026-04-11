-- ============================================================
-- MIGRATION 009: FIX RLS RECURSION IN ADMIN CHECK
-- Replaces is_admin() with a SECURITY DEFINER implementation.
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
BEGIN
  SELECT (p.role = 'admin' AND COALESCE(p.is_blocked, FALSE) = FALSE)
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
