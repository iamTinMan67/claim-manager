-- =====================================================
-- FIX EVIDENCE METHOD CONSTRAINT
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. First, check what constraints exist
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'evidence'::regclass
AND pg_get_constraintdef(oid) LIKE '%method%';

-- 2. Drop the existing method constraint if it exists
DO $$ 
BEGIN
    -- Drop any check constraints on the method column
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'evidence'::regclass
        AND pg_get_constraintdef(oid) LIKE '%method%'
    ) THEN
        -- Get the constraint name and drop it
        EXECUTE (
            SELECT 'ALTER TABLE evidence DROP CONSTRAINT ' || conname
            FROM pg_constraint 
            WHERE conrelid = 'evidence'::regclass
            AND pg_get_constraintdef(oid) LIKE '%method%'
            LIMIT 1
        );
        RAISE NOTICE 'Dropped existing method constraint';
    ELSE
        RAISE NOTICE 'No method constraint found';
    END IF;
END $$;

-- 3. Add a new, more permissive method constraint
ALTER TABLE evidence ADD CONSTRAINT evidence_method_check 
CHECK (method IS NULL OR method IN (
    'upload', 
    'email', 
    'post', 
    'hand', 
    'call', 
    'todo',
    'url',
    'link',
    'document',
    'file'
));

-- 4. Update any existing records with invalid method values
UPDATE evidence 
SET method = 'upload' 
WHERE method IS NOT NULL 
AND method NOT IN (
    'upload', 'email', 'post', 'hand', 'call', 'todo', 'url', 'link', 'document', 'file'
);

-- 5. Test inserting a record with 'upload' method
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

-- 6. Clean up test data
DELETE FROM evidence WHERE case_number = 'TEST001';

-- 7. Show the new constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'evidence'::regclass
AND conname = 'evidence_method_check';

-- 8. Show success message
SELECT 'Method constraint fixed successfully!' as status;
