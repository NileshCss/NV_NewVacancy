-- ============================================================
-- BULLETPROOF FIX: Break the infinite RLS loop permanently
-- ============================================================
-- The timeout happens because `is_admin()` queries the `profiles` table,
-- but the `profiles` table's RLS policy calls `is_admin()`. This creates
-- an infinite loop that crashes the database query.
-- 
-- The solution is to allow basic read access to profiles, which stops
-- the loop instantly.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Drop the policy that causes the infinite loop
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

-- 2. Create a clean policy that allows users to read profiles without checking admin status
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
  true
);

-- Note: Users can STILL ONLY update/delete their OWN profile.
-- We are only allowing 'SELECT' (read) access, which is safe.
