# Job Vacancy Update Issue - Complete Fix Guide

## Status
🔴 **Issue:** "Post New Vacancy" form shows "SAVING..." button and hangs or fails to update job vacancies

---

## 🔍 Step 1: Identify the Exact Error

### In Browser Console (DevTools):
1. Press **F12** to open DevTools
2. Go to **Console** tab
3. Try to update a job vacancy
4. Look for errors - take note of:
   - Error message
   - Error code (e.g., 42501, PGRST204)
   - Any RLS or permission mentions

**Common Errors:**
- `[42501]` = RLS Permission Denied
- `PGRST204` = Column not found in schema
- `AbortError` = Request timeout
- No error + hanging = Timeout issue

---

## 🔧 Step 2: Apply the Comprehensive SQL Fix

This fixes ALL known issues with job vacancies:

### In Supabase:
1. Go to **https://app.supabase.com**
2. Select your project
3. Click **SQL Editor** → **New Query**
4. Copy and paste the entire script below:

```sql
-- COMPREHENSIVE JOB VACANCY UPDATE FIX
-- Fixes: RLS permissions, missing columns, admin access

-- ========== PHASE 1: ADD MISSING COLUMNS ==========
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS experience TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN public.jobs.experience IS 'Required experience (e.g., 2-5 years)';

-- ========== PHASE 2: CREATE ADMIN HELPER FUNCTION ==========
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ========== PHASE 3: DROP OLD RLS POLICIES ==========
DROP POLICY IF EXISTS "jobs_select_active"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_all_admin"        ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_public"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_admin"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_admin"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin"            ON public.jobs;
DROP POLICY IF EXISTS "auth_insert_jobs"             ON public.jobs;
DROP POLICY IF EXISTS "auth_update_jobs"             ON public.jobs;
DROP POLICY IF EXISTS "auth_delete_jobs"             ON public.jobs;
DROP POLICY IF EXISTS "Public can view active jobs"  ON public.jobs;
DROP POLICY IF EXISTS "Admins can manage jobs"       ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_all"               ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_public"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_public"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_public"           ON public.jobs;
DROP POLICY IF EXISTS "jobs_public_read_active"      ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_read_all"          ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_insert"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update"            ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_delete"            ON public.jobs;

-- ========== PHASE 4: ENABLE RLS ==========
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- ========== PHASE 5: CREATE NEW RLS POLICIES ==========
-- Policy 1: Public can read ACTIVE jobs
CREATE POLICY "jobs_public_read_active" ON public.jobs
  FOR SELECT
  USING (is_active = true);

-- Policy 2: Admins can read ALL jobs
CREATE POLICY "jobs_admin_read_all" ON public.jobs
  FOR SELECT
  USING (public.is_admin_user());

-- Policy 3: Only admins can INSERT jobs
CREATE POLICY "jobs_admin_insert" ON public.jobs
  FOR INSERT
  WITH CHECK (public.is_admin_user());

-- Policy 4: Only admins can UPDATE jobs
CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Policy 5: Only admins can DELETE jobs
CREATE POLICY "jobs_admin_delete" ON public.jobs
  FOR DELETE
  USING (public.is_admin_user());

-- ========== PHASE 6: ENSURE SUPER ADMIN ROLE ==========
UPDATE public.profiles
SET role = 'super_admin', updated_at = NOW()
WHERE email = 'rajputnileshsingh3@gmail.com'
  AND (role IS NULL OR role != 'super_admin');

-- ========== PHASE 7: FIX INVALID ROLES ==========
UPDATE public.profiles
SET role = 'user', updated_at = NOW()
WHERE role IS NULL 
   OR role NOT IN ('user', 'admin', 'super_admin');

-- ========== PHASE 8: VERIFY SETUP ==========
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: All fixes applied';
  RAISE NOTICE 'Experience column: OK';
  RAISE NOTICE 'Admin function: OK';
  RAISE NOTICE 'RLS policies: OK';
END $$;

-- Display current admin users
SELECT 'ADMIN USERS:' as info;
SELECT id, email, role, created_at
FROM public.profiles
WHERE role IN ('admin', 'super_admin')
ORDER BY role DESC;

-- Display RLS policies
SELECT 'RLS POLICIES:' as info;
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'jobs'
ORDER BY policyname;
```

5. Click **Run** or press **Ctrl+Enter**
6. Look for "SUCCESS" messages at the bottom
7. You should see a list of admin users and RLS policies

---

## 🔑 Step 3: Critical - Sign Out & Sign Back In

**⚠️ IMPORTANT: After running SQL, admins MUST re-login**

When a user is promoted to admin/super_admin, they need to refresh their JWT token:

### For the Super Admin (rajputnileshsingh3@gmail.com):
1. Sign out completely (refresh browser)
2. Sign back in
3. Now you'll have permissions to update jobs

### For Other Admins:
If you promoted other users to admin, they must also:
1. Sign out completely
2. Sign back in

---

## ✅ Step 4: Verify the Fix

### Test 1: Check Admin Permissions in SQL
```sql
-- Check if your user is an admin
SELECT id, email, role
FROM public.profiles
WHERE email = 'your-email@example.com';
-- Should show: role = 'admin' or 'super_admin'
```

### Test 2: Test Update Functionality
1. Open the web app in your browser
2. Go to **Admin Panel** → **Jobs**
3. Click **Edit** on any job
4. Make a small change (e.g., change salary from "Not Disclosed" to "12 LPA")
5. Click **Save Job**

**Expected Result:**
- No "SAVING..." hang
- Form closes after 1-2 seconds
- Toast notification: "Vacancy updated successfully"
- Job appears in list with new values

### Test 3: Add New Job
1. Go to **Admin Panel** → **Post New Vacancy**
2. Fill in all fields:
   - **Title:** Test Job
   - **Organization:** Test Company
   - **Location:** All India
   - **Salary:** 12 LPA
   - **Positions:** 5
   - **Experience:** 2-5 years
   - **Qualification:** B.Tech
   - **Age Limit:** 18-30 years
   - **Apply URL:** https://example.com/apply
3. Click **Save Vacancy**

**Expected Result:**
- Form closes
- New job appears in the list
- No errors in console

---

## 🐛 Step 5: Troubleshooting

### Issue: Still Getting "Permission Denied" [42501]

**Solution:**
1. Check if user is actually an admin:
```sql
SELECT id, email, role FROM public.profiles WHERE email = 'your-email@example.com';
```
2. If not admin, run:
```sql
UPDATE public.profiles
SET role = 'admin', updated_at = NOW()
WHERE email = 'your-email@example.com';
```
3. **Sign out completely and sign back in**
4. Clear browser cache (Ctrl+Shift+Delete)

### Issue: "Column not found" error (PGRST204)

**Solution:** Schema cache not updated. Try:
```sql
-- Notify Supabase to refresh schema
SELECT schema_version FROM pg_tables LIMIT 1;
```
Then:
1. Refresh the web browser (Ctrl+F5)
2. Wait 30 seconds
3. Try again

### Issue: "SAVING..." hangs for 15+ seconds

**Solution:**
1. Check Supabase status: https://status.supabase.com
2. Check your internet connection
3. Check RLS policies are correct:
```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'jobs';
-- Should show 5 policies for SELECT, INSERT, UPDATE, DELETE
```

### Issue: Form doesn't close after successful save

**Solution:**
This is usually fixed in JobVacancyForm.jsx already (500ms timeout). If still happening:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Close and reopen the web app
3. Try again

---

## 📋 Complete Checklist

- [ ] Opened browser DevTools Console
- [ ] Ran the SQL script in Supabase
- [ ] Saw "SUCCESS" messages
- [ ] Verified admin user exists
- [ ] Verified 5 RLS policies exist
- [ ] Signed out completely and signed back in
- [ ] Cleared browser cache
- [ ] Tried updating a job (worked?)
- [ ] Tried creating a new job (worked?)
- [ ] No errors in browser console

---

## 📞 If Issues Persist

If you're still having problems after following this guide:

1. **Collect Error Info:**
   - Open DevTools (F12)
   - Try to update a job
   - Copy the exact error message
   - Take a screenshot of the error

2. **Run Diagnostic Query:**
```sql
-- Check everything at once
SELECT 'DIAGNOSTIC REPORT' as section;

-- 1. Jobs table structure
SELECT COUNT(*) as jobs_count FROM public.jobs;

-- 2. Experience column
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'experience';

-- 3. Admin users
SELECT COUNT(*) as admin_count
FROM public.profiles
WHERE role IN ('admin', 'super_admin');

-- 4. RLS policies
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'jobs';

-- 5. Your user role
SELECT role FROM public.profiles
WHERE email = 'rajputnileshsingh3@gmail.com';
```

3. **Share the output** of the diagnostic query along with the error message

---

## 🎯 Summary

| Step | Action | Status |
|------|--------|--------|
| 1 | Check for errors in browser console | ⏳ Do this |
| 2 | Run SQL fix script in Supabase | ⏳ Do this |
| 3 | Sign out and sign back in | ⏳ Do this |
| 4 | Test update and create functionality | ⏳ Do this |
| 5 | If issues persist, run diagnostic | ⏳ Do this if needed |

---

**Last Updated:** May 18, 2026
**Status:** Ready to Deploy
