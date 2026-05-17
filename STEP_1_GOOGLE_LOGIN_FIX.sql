-- ============================================================
-- RUN THIS ENTIRE BLOCK IN SUPABASE SQL EDITOR
-- ============================================================

-- STEP A: Make sure profiles table has all needed columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'candidate'
    CHECK (role IN ('candidate', 'recruiter', 'admin', 'super_admin', 'user')),
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- STEP B: Fix/Replace the trigger that creates profile on signup
-- This handles BOTH email signup AND Google OAuth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_provider TEXT;
  user_name TEXT;
  user_avatar TEXT;
BEGIN
  -- Detect provider (google, email, github etc.)
  user_provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'email'
  );

  -- Get name from Google metadata or raw_user_meta_data
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Get avatar from Google
  user_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    provider,
    profile_completed,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_avatar,
    'user',
    user_provider,
    -- Google users: mark incomplete so popup shows
    -- Email users: mark complete (they set password during signup)
    CASE WHEN user_provider = 'google' THEN false ELSE true END,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If profile exists but was created empty, fill in missing data
    full_name = CASE
      WHEN profiles.full_name = '' OR profiles.full_name IS NULL
      THEN EXCLUDED.full_name
      ELSE profiles.full_name
    END,
    avatar_url = CASE
      WHEN profiles.avatar_url = '' OR profiles.avatar_url IS NULL
      THEN EXCLUDED.avatar_url
      ELSE profiles.avatar_url
    END,
    provider = EXCLUDED.provider,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- STEP C: Backfill existing Google users who have NO profile row
-- This fixes users who already signed up with Google before the trigger
INSERT INTO public.profiles (id, email, full_name, avatar_url, role, provider, profile_completed, is_active, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture', ''),
  'user',
  COALESCE(au.raw_app_meta_data->>'provider', 'email'),
  -- Mark existing Google users as incomplete so they get the popup
  CASE WHEN COALESCE(au.raw_app_meta_data->>'provider', 'email') = 'google' THEN false ELSE true END,
  true,
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- STEP D: Fix RLS policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Anyone can read profiles (needed for admin dashboard)
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (fallback if trigger fails)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin can do everything
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- STEP E: Verify — check how many profiles exist vs auth users
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE provider = 'google') as google_users,
  (SELECT COUNT(*) FROM public.profiles WHERE profile_completed = false) as incomplete_profiles;
