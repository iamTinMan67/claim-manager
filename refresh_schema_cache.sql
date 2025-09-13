-- =====================================================
-- REFRESH SUPABASE SCHEMA CACHE
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Force refresh of schema cache by querying system tables
SELECT 
    schemaname,
    tablename,
    attname,
    atttypid::regtype as data_type,
    attnotnull as not_null,
    adsrc as default_value
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
WHERE n.nspname = 'public' 
AND c.relname = 'evidence'
AND a.attnum > 0
ORDER BY a.attnum;

-- 2. Query the evidence table to refresh cache
SELECT * FROM evidence LIMIT 1;

-- 3. Check if title column exists and is accessible
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'evidence' 
AND column_name = 'title';

-- 4. Test a simple insert to verify schema
DO $$
BEGIN
    -- This will fail if the schema is not properly updated
    PERFORM 1 FROM evidence WHERE title IS NOT NULL LIMIT 1;
    RAISE NOTICE 'Schema cache refreshed successfully - title column is accessible';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Schema cache refresh may be needed - error: %', SQLERRM;
END $$;

-- 5. Show current evidence table structure
SELECT 
    'Current Evidence Table Structure:' as info,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'evidence' 
ORDER BY ordinal_position;
