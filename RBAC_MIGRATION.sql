-- 1. Ensure the role column can handle 'super_admin' just in case, though we primarily rely on email
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'super_admin', 'candidate'));

-- 2. Update Jobs RLS to explicitly allow super_admin email or super_admin role
DROP POLICY IF EXISTS "jobs_select_all_admin" ON public.jobs;
CREATE POLICY "jobs_select_all_admin" ON public.jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "jobs_insert_admin" ON public.jobs;
CREATE POLICY "jobs_insert_admin" ON public.jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "jobs_update_admin" ON public.jobs;
CREATE POLICY "jobs_update_admin" ON public.jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "jobs_delete_admin" ON public.jobs;
CREATE POLICY "jobs_delete_admin" ON public.jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

-- Do the same for News
DROP POLICY IF EXISTS "news_insert_admin" ON public.news;
CREATE POLICY "news_insert_admin" ON public.news
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "news_update_admin" ON public.news;
CREATE POLICY "news_update_admin" ON public.news
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "news_delete_admin" ON public.news;
CREATE POLICY "news_delete_admin" ON public.news
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

-- Do the same for Affiliates
DROP POLICY IF EXISTS "aff_insert_admin" ON public.affiliates;
CREATE POLICY "aff_insert_admin" ON public.affiliates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "aff_update_admin" ON public.affiliates;
CREATE POLICY "aff_update_admin" ON public.affiliates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );

DROP POLICY IF EXISTS "aff_delete_admin" ON public.affiliates;
CREATE POLICY "aff_delete_admin" ON public.affiliates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role IN ('admin', 'super_admin') OR p.email = 'rajputnileshsingh3@gmail.com')
    )
  );
