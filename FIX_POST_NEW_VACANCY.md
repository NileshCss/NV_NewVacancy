# Post New Vacancy - Fix Guide

## Issues Fixed

### 1. ✅ Experience Field Missing
**Problem:** The "Post New Vacancy" form was missing an Experience field.
**Solution:** 
- Added `experience` column to the `jobs` table (migration: `020_add_experience_column.sql`)
- Added Experience input field to JobVacancyForm.jsx
- Updated API payload in api.js to include experience field

**Impact:** Admin and super admin can now specify required experience for job postings.

---

### 2. ✅ Form Stays on Same Page After Submission
**Problem:** After filling and submitting the form, it would stay on the same page without closing.
**Solution:**
- Improved error handling in JobVacancyForm.jsx
- Added better error detection for RLS permission errors
- Added a 500ms delay before closing the modal to ensure all async operations complete
- Enhanced console logging for debugging
- Added specific error messages for RLS permission issues

**Impact:** Form now properly closes after successful submission. If there's an error, it shows a clear message.

---

### 3. ✅ Admin and Super Admin Cannot Post Jobs
**Problem:** Admin and super_admin users got "permission denied" errors when trying to post jobs.
**Root Cause:** The RLS (Row Level Security) policies were not properly recognizing super_admin role.

**Solution:**
Created migration `021_fix_jobs_rls_policies.sql` that:
1. Creates a helper function `is_admin_user()` that recognizes both 'admin' and 'super_admin' roles
2. Drops all old job RLS policies
3. Creates new policies using the helper function:
   - `jobs_select_active` - Public can read active jobs
   - `jobs_select_all_admin` - Admins can read all jobs (including inactive)
   - `jobs_insert_admin` - Admins can insert jobs
   - `jobs_update_admin` - Admins can update jobs
   - `jobs_delete_admin` - Admins can delete jobs

**Important:** After these migrations are applied and a user is promoted to admin, they MUST:
1. Sign out completely
2. Sign back in to refresh their JWT token with the new role
3. Without re-login, they'll still see permission denied errors

**Impact:** Admin and super_admin users can now post, edit, and delete jobs.

---

## How to Apply These Fixes

### Step 1: Apply Database Migrations
Run these migrations in Supabase SQL Editor in order:

1. **`020_add_experience_column.sql`** - Adds the experience column to jobs table
2. **`021_fix_jobs_rls_policies.sql`** - Fixes RLS policies for admin/super_admin job posting

Copy the content from these files and execute them in Supabase:
- Go to Supabase Dashboard
- Click "SQL Editor"
- Create a new query
- Paste the migration content
- Click "Run"

### Step 2: Verify Admin Setup
Run the verification script `ADMIN_SETUP_AND_VERIFICATION.sql`:
1. Check which users are admins
2. Promote a user to admin if needed (replace 'YOUR_EMAIL@example.com' with the actual email)
3. Verify RLS policies are in place
4. Verify the helper function exists

### Step 3: Test the Fixes

#### For Regular Users (Non-Admin)
1. Sign in with a regular user account
2. Ensure they can only see active jobs (not inactive ones)
3. Ensure they cannot access the admin panel

#### For Admin Users
1. Promote a user to admin using the verification script
2. **Important:** That user must completely sign out and sign back in
3. They should now see the "Post New Vacancy" button in the admin panel
4. They should be able to:
   - Fill in the form with all fields including the new "Experience" field
   - Successfully submit the form (modal closes after 500ms delay)
   - See the new job in the admin jobs list

#### For Super Admin
1. The super admin (rajputnileshsingh3@gmail.com) should have role='super_admin' in the database
2. They should have all the same permissions as admins
3. If they have issues, run this in Supabase SQL:
   ```sql
   UPDATE public.profiles 
   SET role = 'super_admin' 
   WHERE email = 'rajputnileshsingh3@gmail.com';
   ```

### Step 4: Frontend Deployment
Deploy the updated frontend code which includes:
- Updated `JobVacancyForm.jsx` with Experience field and better error handling
- Updated `api.js` with experience field in payloads

---

## Troubleshooting

### Issue: "Permission denied" error when posting jobs
**Cause:** User's JWT token doesn't have the new role
**Fix:** Sign out completely and sign back in

### Issue: "RLS policy violation [42501]"
**Cause:** The RLS policies might not be applied correctly
**Fix:** 
1. Verify the `is_admin_user()` function exists:
   ```sql
   SELECT function_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'is_admin_user';
   ```
2. Re-apply migration `021_fix_jobs_rls_policies.sql`

### Issue: Experience field not showing in form
**Cause:** Frontend code not updated or jobs table doesn't have experience column
**Fix:**
1. Apply migration `020_add_experience_column.sql`
2. Deploy the latest frontend code
3. Refresh the browser

### Issue: Form doesn't close after submission but job is created
**Cause:** Modal closing logic is async and might fail
**Fix:** Already fixed in the updated code with 500ms delay. Check browser console for errors.

---

## Files Modified

### Backend (SQL)
- `backend/supabase/migrations/020_add_experience_column.sql` - NEW
- `backend/supabase/migrations/021_fix_jobs_rls_policies.sql` - NEW

### Frontend (JavaScript/React)
- `frontend/src/components/admin/JobVacancyForm.jsx` - Updated
  - Added experience field to form
  - Improved error handling
  - Added better error messages for RLS issues
- `frontend/src/services/api.js` - Updated
  - Added experience field to addJob payload
  - Added experience field to updateJob payload

### Documentation
- `ADMIN_SETUP_AND_VERIFICATION.sql` - NEW
- This file (FIX_POST_NEW_VACANCY.md) - NEW

---

## Testing Checklist

- [ ] Experience column exists in jobs table
- [ ] Experience field appears in the Post New Vacancy form
- [ ] Admin user can post a job with experience field
- [ ] Admin user can edit a job and see/modify experience field
- [ ] Form closes properly after successful submission
- [ ] Permission denied error shows clear message when non-admin tries to post
- [ ] Super admin can post jobs
- [ ] Super admin can edit and delete jobs
- [ ] Regular users cannot access admin job posting features
- [ ] Regular users cannot see inactive jobs

---

## Database Schema Changes

### New Column Added to `jobs` table:
```sql
experience TEXT;
-- e.g., "0-2 years", "2-5 years", "5+ years", "Fresher"
```

---

## Notes

- The `experience` field is optional (nullable TEXT)
- Example values: "0-2 years", "2-5 years", "5+ years", "Fresher", "1-3 years"
- The RLS policies are now more robust and use a helper function for better maintainability
- All admin/super_admin users will be able to manage all jobs after signing back in
