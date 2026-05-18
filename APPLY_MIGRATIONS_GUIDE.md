# How to Fix the "experience column not found" Error

## Error Details
```
Save Failed
Could not find the 'experience' column of 'jobs' in the schema cache [PGRST204]
```

This error occurs because the database migrations haven't been applied to Supabase yet.

---

## Solution: Apply Migrations to Supabase

### Step 1: Go to Supabase Dashboard
1. Visit your Supabase project: https://app.supabase.com
2. Sign in with your credentials
3. Select your project (new-vacancy)

### Step 2: Open SQL Editor
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New Query"** button
3. You'll see a blank SQL editor

### Step 3: Copy and Paste the Migration Script
1. Open the file: `APPLY_MIGRATIONS_TO_SUPABASE.sql` in this repository
2. Copy ALL the SQL code
3. Paste it into the Supabase SQL Editor

### Step 4: Run the Migrations
1. Click the **"Run"** button (or press `Ctrl+Enter`)
2. Wait for the query to complete (should take a few seconds)
3. You should see "Query successful" message with no errors

### Step 5: Verify the Fix
After running, you should see output from the verification queries:
- ✅ Column "experience" should exist in jobs table
- ✅ RLS policies should be listed (5 policies for jobs)
- ✅ Function "is_admin_user" should exist
- ✅ Admin users should be listed

---

## What the Migrations Do

### Migration 1: Add Experience Column
```sql
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS experience TEXT;
```
- Adds the `experience` column to the jobs table
- Allows storing experience requirements like "2-5 years"

### Migration 2: Fix RLS Policies
- Creates `is_admin_user()` helper function
- Updates RLS policies to recognize both `admin` and `super_admin` roles
- Allows admin users to post jobs

---

## After Applying Migrations

### For Admin Users
1. **Sign out completely** from the app
2. **Sign back in** to refresh your JWT token
3. You should now be able to:
   - Access "Post New Vacancy" form
   - See the Experience field
   - Successfully submit and save jobs

### Testing the Fix
1. Go to Admin Panel
2. Click "Post New Vacancy" button
3. Fill in the form including the new "Experience" field
4. Click "Post Vacancy"
5. The form should close and the job should be saved ✅

---

## Troubleshooting

### Issue: Still getting "experience column not found" error
**Solution:** 
- Clear your browser cache (Ctrl+Shift+Delete)
- Refresh the page (Ctrl+F5)
- Wait 30 seconds for Supabase cache to update

### Issue: "Permission denied" when posting jobs
**Solution:**
- The user might not have the admin role or JWT token is stale
- Sign out completely and sign back in
- Run the verification queries to confirm the user has the admin role

### Issue: SQL Error when running migrations
**Solution:**
- Copy each migration separately if there's an error
- Check the error message in Supabase
- Some policies might already exist (that's okay, they'll be dropped and recreated)

---

## Quick Reference: SQL File Locations

| File | Purpose |
|------|---------|
| `APPLY_MIGRATIONS_TO_SUPABASE.sql` | Complete migration script (run this first) |
| `backend/supabase/migrations/020_add_experience_column.sql` | Adds experience column |
| `backend/supabase/migrations/021_fix_jobs_rls_policies.sql` | Fixes admin permissions |
| `ADMIN_SETUP_AND_VERIFICATION.sql` | Verify admin setup |

---

## Verification Checklist

After applying migrations:

- [ ] Go to Supabase SQL Editor
- [ ] Run this query:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'jobs' AND column_name = 'experience';
  ```
- [ ] You should see one row with "experience"

- [ ] Run this query:
  ```sql
  SELECT COUNT(*) FROM pg_policies WHERE tablename = 'jobs';
  ```
- [ ] You should see 5 policies

- [ ] Try posting a new vacancy as an admin
- [ ] The job should save successfully ✅

---

## Still Having Issues?

If you're still seeing errors after applying migrations:

1. **Check if migration ran successfully:**
   - Look for any error messages in the Supabase SQL Editor
   - All queries should show "Query successful"

2. **Verify the column exists:**
   - Run: `SELECT * FROM public.jobs LIMIT 1;`
   - You should see an `experience` column

3. **Clear all caches:**
   - Browser cache (Ctrl+Shift+Delete)
   - Supabase local cache (wait 2-3 minutes)
   - Restart the browser

4. **Check user role:**
   - Ensure the user is set to 'admin' role in profiles table
   - Sign out and back in to refresh JWT token

---

## Support

For more details, see:
- `FIX_POST_NEW_VACANCY.md` - Complete fix guide
- `FIX_POST_NEW_VACANCY_SUMMARY.md` - Implementation summary
- `ADMIN_SETUP_AND_VERIFICATION.sql` - Admin verification queries
