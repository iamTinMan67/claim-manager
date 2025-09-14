-- Compare evidence and exhibits tables to see which has better data
-- This will help us determine which table to use as the source of truth

-- Step 1: Check if exhibits table still exists
SELECT 
  'Exhibits Table Status' as info,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exhibits') 
    THEN 'EXISTS' 
    ELSE 'DOES NOT EXIST' 
  END as table_exists;

-- Step 2: If exhibits exists, compare the data
SELECT 
  'Exhibits Table Data' as info,
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as has_name,
  COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as has_description,
  COUNT(CASE WHEN exhibit_number IS NOT NULL THEN 1 END) as has_exhibit_number
FROM exhibits;

-- Step 3: Check evidence table data
SELECT 
  'Evidence Table Data' as info,
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as has_name,
  COUNT(CASE WHEN file_name IS NOT NULL AND file_name != '' THEN 1 END) as has_file_name,
  COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as has_title,
  COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as has_description,
  COUNT(CASE WHEN exhibit_number IS NOT NULL THEN 1 END) as has_exhibit_number,
  COUNT(CASE WHEN case_number IS NOT NULL THEN 1 END) as has_case_number
FROM evidence;

-- Step 4: Show sample data from exhibits table (if it exists)
SELECT 'Sample Exhibits Data' as info, 
  id, 
  name, 
  exhibit_number, 
  description, 
  user_id,
  created_at
FROM exhibits 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 5: Show sample data from evidence table
SELECT 'Sample Evidence Data' as info, 
  id, 
  name, 
  file_name, 
  title, 
  exhibit_number, 
  description, 
  case_number,
  user_id,
  created_at
FROM evidence 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 6: Check if there are any evidence records that look like they came from exhibits
SELECT 'Evidence Records from Exhibits' as info,
  COUNT(*) as count,
  array_agg(DISTINCT method) as methods_used
FROM evidence 
WHERE method = 'Exhibit' OR name ~ '^Exhibit \d+$';
