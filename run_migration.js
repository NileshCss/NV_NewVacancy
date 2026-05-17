/**
 * run_migration.js
 * Applies the RLS fix directly using the Supabase service role key.
 * Run with: node run_migration.js
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://cmsuomeggkoxkxeqwoam.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtc3VvbWVnZ2tveGt4ZXF3b2FtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNTgxNywiZXhwIjoyMDkwMDkxODE3fQ.FMnx4vyN4fvQkFj7jCdAKRQqzq3kLvCuH9MbKZkMx2g'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SQL_STATEMENTS = [
  // 1. Drop and recreate is_admin with row_security bypass
  `CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result boolean := false;
  user_email text;
BEGIN
  SET LOCAL row_security = off;
  SELECT auth.jwt() ->> 'email' INTO user_email;
  IF user_email = 'rajputnileshsingh3@gmail.com' THEN
    RETURN true;
  END IF;
  SELECT (role IN ('admin', 'super_admin') AND NOT COALESCE(is_blocked, false))
    INTO result
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  RETURN COALESCE(result, false);
END;
$$`,

  `REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC`,
  `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated`,
  `GRANT EXECUTE ON FUNCTION public.is_admin() TO anon`,

  // 2. Drop ALL old profile policies
  `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "profiles_select" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_update" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_insert" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_delete" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles`,
  `DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles`,
  `DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles`,
  `DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles`,
  `DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles`,

  // 3. New clean profile policies
  `CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin())`,
  `CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)`,
  `CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin())`,
  `CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (public.is_admin())`,
  `GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated`,
  `GRANT SELECT ON public.profiles TO anon`,

  // 4. Drop ALL old jobs policies
  `ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "jobs_select" ON public.jobs`,
  `DROP POLICY IF EXISTS "jobs_insert" ON public.jobs`,
  `DROP POLICY IF EXISTS "jobs_update" ON public.jobs`,
  `DROP POLICY IF EXISTS "jobs_delete" ON public.jobs`,
  `DROP POLICY IF EXISTS "Anyone can view active jobs" ON public.jobs`,
  `DROP POLICY IF EXISTS "Admins can manage jobs" ON public.jobs`,

  // 5. New clean jobs policies
  `CREATE POLICY "jobs_select" ON public.jobs FOR SELECT USING (is_active = true OR public.is_admin())`,
  `CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT WITH CHECK (public.is_admin())`,
  `CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())`,
  `CREATE POLICY "jobs_delete" ON public.jobs FOR DELETE USING (public.is_admin())`,
  `GRANT SELECT ON public.jobs TO anon`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated`,

  // 6. news policies
  `ALTER TABLE public.news ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "news_select" ON public.news`,
  `DROP POLICY IF EXISTS "news_insert" ON public.news`,
  `DROP POLICY IF EXISTS "news_update" ON public.news`,
  `DROP POLICY IF EXISTS "news_delete" ON public.news`,
  `DROP POLICY IF EXISTS "Anyone can view active news" ON public.news`,
  `DROP POLICY IF EXISTS "Admins can manage news" ON public.news`,
  `CREATE POLICY "news_select" ON public.news FOR SELECT USING (is_active = true OR public.is_admin())`,
  `CREATE POLICY "news_insert" ON public.news FOR INSERT WITH CHECK (public.is_admin())`,
  `CREATE POLICY "news_update" ON public.news FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())`,
  `CREATE POLICY "news_delete" ON public.news FOR DELETE USING (public.is_admin())`,
  `GRANT SELECT ON public.news TO anon`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated`,

  // 7. affiliates policies
  `ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "affiliates_select" ON public.affiliates`,
  `DROP POLICY IF EXISTS "affiliates_insert" ON public.affiliates`,
  `DROP POLICY IF EXISTS "affiliates_update" ON public.affiliates`,
  `DROP POLICY IF EXISTS "affiliates_delete" ON public.affiliates`,
  `DROP POLICY IF EXISTS "Anyone can view active affiliates" ON public.affiliates`,
  `DROP POLICY IF EXISTS "Admins can manage affiliates" ON public.affiliates`,
  `CREATE POLICY "affiliates_select" ON public.affiliates FOR SELECT USING (is_active = true OR public.is_admin())`,
  `CREATE POLICY "affiliates_insert" ON public.affiliates FOR INSERT WITH CHECK (public.is_admin())`,
  `CREATE POLICY "affiliates_update" ON public.affiliates FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())`,
  `CREATE POLICY "affiliates_delete" ON public.affiliates FOR DELETE USING (public.is_admin())`,
  `GRANT SELECT ON public.affiliates TO anon`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliates TO authenticated`,
]

async function runMigration() {
  console.log('🚀 Running RLS fix migration via Supabase service role...\n')
  let success = 0
  let failed = 0

  for (const sql of SQL_STATEMENTS) {
    const preview = sql.replace(/\s+/g, ' ').slice(0, 80)
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single()
      if (error) throw error
      console.log(`✅ ${preview}`)
      success++
    } catch (err) {
      // Try alternative approach using from().select() with raw SQL
      console.log(`⚠️  RPC failed for: ${preview}`)
      console.log(`   Error: ${err.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${success} succeeded, ${failed} failed`)
  if (failed > 0) {
    console.log('\n⚠️  Some statements failed. Please run PASTE_IN_SUPABASE_SQL_EDITOR.sql manually in Supabase SQL Editor.')
  } else {
    console.log('\n🎉 Migration complete! Jobs should now save correctly.')
  }
}

runMigration()
