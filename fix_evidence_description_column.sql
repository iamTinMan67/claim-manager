-- =====================================================
-- FIX EVIDENCE TABLE DESCRIPTION COLUMN
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Check if description column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'evidence' 
AND column_name = 'description';

-- 2. Add description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE evidence ADD COLUMN description text;
        RAISE NOTICE 'Added description column to evidence table';
    ELSE
        RAISE NOTICE 'Description column already exists in evidence table';
    END IF;
END $$;

-- 3. Add title column if it doesn't exist (required field)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'title'
    ) THEN
        ALTER TABLE evidence ADD COLUMN title text NOT NULL DEFAULT 'Evidence Item';
        RAISE NOTICE 'Added title column to evidence table';
    ELSE
        RAISE NOTICE 'Title column already exists in evidence table';
    END IF;
END $$;

-- 4. Add file_size and file_type columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'file_size'
    ) THEN
        ALTER TABLE evidence ADD COLUMN file_size integer;
        RAISE NOTICE 'Added file_size column to evidence table';
    ELSE
        RAISE NOTICE 'file_size column already exists in evidence table';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'file_type'
    ) THEN
        ALTER TABLE evidence ADD COLUMN file_type text;
        RAISE NOTICE 'Added file_type column to evidence table';
    ELSE
        RAISE NOTICE 'file_type column already exists in evidence table';
    END IF;
END $$;

-- 5. Verify the evidence table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'evidence' 
ORDER BY ordinal_position;

-- 6. Test inserting a record with description
INSERT INTO evidence (
    user_id, 
    title, 
    description, 
    case_number, 
    exhibit_id,
    method
) VALUES (
    (SELECT id FROM profiles LIMIT 1),
    'Test Evidence',
    'This is a test description',
    'TEST001',
    '1',
    'upload'
) ON CONFLICT DO NOTHING;

-- 7. Clean up test data
DELETE FROM evidence WHERE case_number = 'TEST001';

-- 8. Show success message
SELECT 'Evidence table structure updated successfully!' as status;
