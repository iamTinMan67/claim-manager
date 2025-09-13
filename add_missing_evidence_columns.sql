-- =====================================================
-- ADD MISSING COLUMNS TO EXISTING EVIDENCE TABLE
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Check current table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'evidence' 
ORDER BY ordinal_position;

-- 2. Add title column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'title'
    ) THEN
        ALTER TABLE evidence ADD COLUMN title text;
        RAISE NOTICE 'Added title column to evidence table';
    ELSE
        RAISE NOTICE 'Title column already exists in evidence table';
    END IF;
END $$;

-- 3. Add file_size column if it doesn't exist
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

-- 4. Add file_type column if it doesn't exist
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

-- 5. Add method column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'method'
    ) THEN
        ALTER TABLE evidence ADD COLUMN method text DEFAULT 'upload';
        RAISE NOTICE 'Added method column to evidence table';
    ELSE
        RAISE NOTICE 'method column already exists in evidence table';
    END IF;
END $$;

-- 6. Add url_link column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'url_link'
    ) THEN
        ALTER TABLE evidence ADD COLUMN url_link text;
        RAISE NOTICE 'Added url_link column to evidence table';
    ELSE
        RAISE NOTICE 'url_link column already exists in evidence table';
    END IF;
END $$;

-- 7. Add book_of_deeds_ref column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'book_of_deeds_ref'
    ) THEN
        ALTER TABLE evidence ADD COLUMN book_of_deeds_ref text;
        RAISE NOTICE 'Added book_of_deeds_ref column to evidence table';
    ELSE
        RAISE NOTICE 'book_of_deeds_ref column already exists in evidence table';
    END IF;
END $$;

-- 8. Add number_of_pages column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'number_of_pages'
    ) THEN
        ALTER TABLE evidence ADD COLUMN number_of_pages integer;
        RAISE NOTICE 'Added number_of_pages column to evidence table';
    ELSE
        RAISE NOTICE 'number_of_pages column already exists in evidence table';
    END IF;
END $$;

-- 9. Add date_submitted column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'date_submitted'
    ) THEN
        ALTER TABLE evidence ADD COLUMN date_submitted date;
        RAISE NOTICE 'Added date_submitted column to evidence table';
    ELSE
        RAISE NOTICE 'date_submitted column already exists in evidence table';
    END IF;
END $$;

-- 10. Add display_order column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'display_order'
    ) THEN
        ALTER TABLE evidence ADD COLUMN display_order integer DEFAULT 0;
        RAISE NOTICE 'Added display_order column to evidence table';
    ELSE
        RAISE NOTICE 'display_order column already exists in evidence table';
    END IF;
END $$;

-- 11. Make title column NOT NULL if it exists but is nullable
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'evidence' 
        AND column_name = 'title'
        AND is_nullable = 'YES'
    ) THEN
        -- First, update any NULL titles to have a default value
        UPDATE evidence SET title = 'Evidence Item' WHERE title IS NULL;
        
        -- Then make the column NOT NULL
        ALTER TABLE evidence ALTER COLUMN title SET NOT NULL;
        RAISE NOTICE 'Made title column NOT NULL';
    ELSE
        RAISE NOTICE 'Title column is already NOT NULL or does not exist';
    END IF;
END $$;

-- 12. Verify the final table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'evidence' 
ORDER BY ordinal_position;

-- 13. Test inserting a record with all fields
INSERT INTO evidence (
    user_id, 
    title, 
    case_number, 
    exhibit_id,
    file_name,
    method,
    number_of_pages,
    date_submitted,
    book_of_deeds_ref
) VALUES (
    (SELECT id FROM profiles LIMIT 1),
    'Test Evidence Item',
    'TEST001',
    '1',
    'test_file.pdf',
    'upload',
    1,
    CURRENT_DATE,
    'BD-TEST'
) ON CONFLICT DO NOTHING;

-- 14. Clean up test data
DELETE FROM evidence WHERE case_number = 'TEST001';

-- 15. Show success message
SELECT 'Evidence table columns added successfully!' as status;
