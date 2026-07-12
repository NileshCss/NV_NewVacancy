-- ============================================================
-- MIGRATION 027: Require Authentication for Mock Tests & Affiliates
-- ============================================================

-- 1. Restrict affiliates_select policy to authenticated users only
DROP POLICY IF EXISTS "affiliates_select" ON public.affiliates;
CREATE POLICY "affiliates_select" ON public.affiliates 
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_active = true OR public.is_admin_user()));

-- 2. Restrict students read published mock_tests to authenticated users only
DROP POLICY IF EXISTS "students read published mock_tests" ON public.mock_tests;
CREATE POLICY "students read published mock_tests" ON public.mock_tests
  FOR SELECT USING (auth.uid() IS NOT NULL AND (status = 'published' OR public.is_admin_user()));

-- 3. Restrict students read mock_test_questions to authenticated users only
DROP POLICY IF EXISTS "students read mock_test_questions" ON public.mock_test_questions;
CREATE POLICY "students read mock_test_questions" ON public.mock_test_questions
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.is_admin_user() OR
      EXISTS (
        SELECT 1 FROM public.mock_tests mt
        WHERE mt.id = mock_test_id AND mt.status = 'published'
      )
    )
  );
