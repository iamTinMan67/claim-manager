-- =====================================================
-- DIAGNOSTIC SCRIPT FOR 400 ERRORS
-- Run this in your Supabase SQL Editor to identify issues
-- =====================================================

-- 1. Check if all required tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('profiles', 'claims', 'todos', 'evidence', 'chat_messages', 'claim_shares', 'calendar_events') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('profiles', 'claims', 'todos', 'evidence', 'chat_messages', 'claim_shares', 'calendar_events')
ORDER BY table_name;

-- 2. Check RLS status on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ENABLED' 
    ELSE '❌ RLS DISABLED' 
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'claims', 'todos', 'evidence', 'chat_messages', 'claim_shares', 'calendar_events')
ORDER BY tablename;

-- 3. Check policies on each table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'claims', 'todos', 'evidence', 'chat_messages', 'claim_shares', 'calendar_events')
ORDER BY tablename, policyname;

-- 4. Check foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('profiles', 'claims', 'todos', 'evidence', 'chat_messages', 'claim_shares', 'calendar_events')
ORDER BY tc.table_name;

-- 5. Check if auth.users table exists and has data
SELECT 
  'auth.users' as table_name,
  COUNT(*) as user_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ HAS DATA' 
    ELSE '❌ NO DATA' 
  END as status
FROM auth.users;

-- 6. Check if profiles table has data
SELECT 
  'profiles' as table_name,
  COUNT(*) as profile_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ HAS DATA' 
    ELSE '❌ NO DATA' 
  END as status
FROM profiles;

-- 7. Test basic query that might be failing
SELECT 
  'Test Query' as test_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM profiles LIMIT 1) THEN '✅ PROFILES ACCESSIBLE'
    ELSE '❌ PROFILES NOT ACCESSIBLE'
  END as profiles_test,
  CASE 
    WHEN EXISTS(SELECT 1 FROM claims LIMIT 1) THEN '✅ CLAIMS ACCESSIBLE'
    ELSE '❌ CLAIMS NOT ACCESSIBLE'
  END as claims_test,
  CASE 
    WHEN EXISTS(SELECT 1 FROM todos LIMIT 1) THEN '✅ TODOS ACCESSIBLE'
    ELSE '❌ TODOS NOT ACCESSIBLE'
  END as todos_test;
