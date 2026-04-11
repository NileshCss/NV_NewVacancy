-- ============================================================
-- Promote rajputnileshsingh3@gmail.com to admin
-- ============================================================

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'rajputnileshsingh3@gmail.com';

-- Verify the update
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
