-- Purge all entries from auth.users table
-- WARNING: This will delete ALL users from the authentication system
-- Make sure you want to do this before running!

DELETE FROM auth.users;

-- Verify the table is empty
SELECT COUNT(*) as user_count FROM auth.users;

-- Also clean up any related data in public tables
DELETE FROM public.profiles;
DELETE FROM public.subscribers;

-- Verify cleanup
SELECT 'profiles' as table_name, COUNT(*) as record_count FROM public.profiles
UNION ALL
SELECT 'subscribers' as table_name, COUNT(*) as record_count FROM public.subscribers
UNION ALL
SELECT 'auth.users' as table_name, COUNT(*) as record_count FROM auth.users;

