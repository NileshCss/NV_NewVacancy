-- ============================================================
-- UPGRADE USER MANAGEMENT RPC: Super Admin Strict Enforcement
-- ============================================================
-- Ensures all user management features restrict to super_admin,
-- and deeply integrates with auth.users for banning and metadata.

-- 1. DELETE USER (Super Admin Only)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_email text;
    target_email text;
BEGIN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    IF caller_email != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Not authorized. Only the super admin can delete users.';
    END IF;

    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    IF target_email = 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Cannot delete the super admin.';
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- 2. BLOCK/UNBLOCK USER (Super Admin Only, with true Auth Ban)
CREATE OR REPLACE FUNCTION public.admin_block_user(target_user_id uuid, set_is_blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_email text;
    target_email text;
BEGIN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    IF caller_email != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Not authorized. Only the super admin can block/unblock users.';
    END IF;

    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    IF target_email = 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Cannot block the super admin.';
    END IF;

    -- 1. Mark in public profiles
    UPDATE public.profiles SET is_blocked = set_is_blocked, updated_at = now() WHERE id = target_user_id;
    
    -- 2. Apply actual login ban at the Supabase Auth level
    IF set_is_blocked THEN
        UPDATE auth.users SET banned_until = '2099-12-31'::timestamp WHERE id = target_user_id;
    ELSE
        UPDATE auth.users SET banned_until = null WHERE id = target_user_id;
    END IF;
END;
$$;

-- 3. PROMOTE TO ADMIN (Super Admin Only, updates app_metadata)
CREATE OR REPLACE FUNCTION public.super_admin_promote_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_email text;
BEGIN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    IF caller_email != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Only the super admin can promote users.';
    END IF;

    -- 1. Mark in public profiles
    UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE id = target_user_id;
    
    -- 2. Inject role into auth user metadata
    UPDATE auth.users 
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
    WHERE id = target_user_id;
END;
$$;

-- 4. DEMOTE TO USER (Super Admin Only)
CREATE OR REPLACE FUNCTION public.super_admin_demote_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_email text;
    target_email text;
BEGIN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    IF caller_email != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Only the super admin can demote users.';
    END IF;

    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    IF target_email = 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Cannot demote the super admin.';
    END IF;

    -- 1. Mark in public profiles
    UPDATE public.profiles SET role = 'user', updated_at = now() WHERE id = target_user_id;
    
    -- 2. Strip role from auth user metadata
    UPDATE auth.users 
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
    WHERE id = target_user_id;
END;
$$;

-- Ensure permissions remain intact
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_promote_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_demote_user TO authenticated;
