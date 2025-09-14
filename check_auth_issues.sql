-- Check for authentication and RLS issues
-- This will help diagnose login problems

-- Step 1: Check if auth.users table is accessible
SELECT 'Auth Users Count' as info, COUNT(*) as count FROM auth.users;

-- Step 2: Check profiles table
SELECT 'Profiles Count' as info, COUNT(*) as count FROM profiles;

-- Step 3: Check if there are any RLS policies blocking access
SELECT 'RLS Policies' as info, 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'claims', 'evidence')
ORDER BY tablename, policyname;

-- Step 4: Check if evidence table is accessible
SELECT 'Evidence Access Test' as info, COUNT(*) as count FROM evidence;

-- Step 5: Check if claims table is accessible  
SELECT 'Claims Access Test' as info, COUNT(*) as count FROM claims;
