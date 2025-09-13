-- =====================================================
-- CHECK EVIDENCE TABLE CONSTRAINTS
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Check all constraints on the evidence table
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'evidence'::regclass;

-- 2. Check specifically for method column constraints
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'evidence'::regclass
AND pg_get_constraintdef(oid) LIKE '%method%';

-- 3. Check what values are currently in the method column
SELECT DISTINCT method, COUNT(*) as count
FROM evidence 
GROUP BY method;

-- 4. Show the current evidence table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'evidence' 
ORDER BY ordinal_position;
