-- Fix field mapping issues in evidence table
-- This will correct the data that was migrated incorrectly

-- Step 1: Check current state
SELECT 'Before Fix' as info, 
  COUNT(*) as total_records,
  COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as has_name,
  COUNT(CASE WHEN file_name IS NOT NULL THEN 1 END) as has_file_name,
  COUNT(CASE WHEN exhibit_number IS NOT NULL THEN 1 END) as has_exhibit_number
FROM evidence;

-- Step 2: Fix the field mapping
-- If name is null but file_name exists, copy file_name to name
UPDATE evidence 
SET name = file_name 
WHERE name IS NULL AND file_name IS NOT NULL;

-- If file_name is null but name exists, copy name to file_name
UPDATE evidence 
SET file_name = name 
WHERE file_name IS NULL AND name IS NOT NULL;

-- If exhibit_number is null but we have a name that looks like "Exhibit X", extract the number
UPDATE evidence 
SET exhibit_number = CAST(SUBSTRING(name FROM 'Exhibit (\d+)') AS INTEGER)
WHERE exhibit_number IS NULL 
AND name ~ '^Exhibit \d+$';

-- Step 3: Show results after fix
SELECT 'After Fix' as info, 
  COUNT(*) as total_records,
  COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as has_name,
  COUNT(CASE WHEN file_name IS NOT NULL THEN 1 END) as has_file_name,
  COUNT(CASE WHEN exhibit_number IS NOT NULL THEN 1 END) as has_exhibit_number
FROM evidence;

-- Step 4: Show sample of corrected data
SELECT 'Sample Data' as info, 
  id, 
  name, 
  file_name, 
  exhibit_number, 
  method, 
  case_number
FROM evidence 
ORDER BY created_at DESC 
LIMIT 5;
