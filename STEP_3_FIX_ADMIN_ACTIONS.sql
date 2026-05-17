-- Function to delete a user (only super_admin can delete admins, admins can delete users)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_email text;
    caller_role text;
    target_email text;
    target_role text;
BEGIN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

    IF COALESCE(caller_email, '') != 'rajputnileshsingh3@gmail.com' AND COALESCE(caller_role, '') != 'admin' THEN
        RAISE EXCEPTION 'Not authorized to perform this action';
    END IF;

    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;

    IF COALESCE(target_email, '') = 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Cannot delete the super admin';
    END IF;

    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot delete yourself';
    END IF;

    IF COALESCE(target_role, '') IN ('admin', 'super_admin') AND COALESCE(caller_email, '') != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Only the super admin can delete other admins';
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Function to block/unblock a user
CREATE OR REPLACE FUNCTION public.admin_block_user(target_user_id uuid, set_is_blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_email text;
    caller_role text;
    target_email text;
    target_role text;
BEGIN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

    IF COALESCE(caller_email, '') != 'rajputnileshsingh3@gmail.com' AND COALESCE(caller_role, '') != 'admin' THEN
        RAISE EXCEPTION 'Not authorized to perform this action';
    END IF;

    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;

    IF COALESCE(target_email, '') = 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Cannot block the super admin';
    END IF;

    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot block yourself';
    END IF;

    IF COALESCE(target_role, '') IN ('admin', 'super_admin') AND COALESCE(caller_email, '') != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Only the super admin can block other admins';
    END IF;

    UPDATE public.profiles SET is_blocked = set_is_blocked, updated_at = now() WHERE id = target_user_id;
END;
$$;

-- Function to promote a user to admin (super admin only)
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
    IF COALESCE(caller_email, '') != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Only the super admin can promote users';
    END IF;

    UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE id = target_user_id;
END;
$$;

-- Function to demote an admin to user (super admin only)
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
    IF COALESCE(caller_email, '') != 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Only the super admin can demote users';
    END IF;

    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    IF COALESCE(target_email, '') = 'rajputnileshsingh3@gmail.com' THEN
        RAISE EXCEPTION 'Cannot demote the super admin';
    END IF;

    UPDATE public.profiles SET role = 'user', updated_at = now() WHERE id = target_user_id;
END;
$$;

-- Grant permissions to authenticated users to execute these
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_promote_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_demote_user TO authenticated;
