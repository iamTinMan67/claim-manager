-- =====================================================
-- CHECK EVIDENCE TABLE SCHEMA
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Check what columns actually exist in the evidence table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'evidence' 
ORDER BY ordinal_position;

-- 2. Check if the table exists at all
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'evidence';

-- 3. Show the actual table structure
\d evidence;
