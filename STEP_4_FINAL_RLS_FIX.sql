-- Run this exactly as is in Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result boolean := false;
  user_email text;
BEGIN
  -- This line absolutely guarantees NO infinite recursion
  SET LOCAL row_security = off;
  
  -- 1. Fast path for super admin
  SELECT auth.jwt() ->> 'email' INTO user_email;
  IF user_email = 'rajputnileshsingh3@gmail.com' THEN
    RETURN true;
  END IF;
  
  -- 2. Check the database safely
  SELECT (role IN ('admin', 'super_admin') AND NOT COALESCE(is_blocked, false))
    INTO result
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Grant permissions so logged-in users and guests can evaluate RLS
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
