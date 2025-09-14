-- Check the original exhibits table structure and data quality
-- This will help us understand the proper data structure

-- Step 1: Check if exhibits table still exists
SELECT 'Exhibits Table Exists' as info,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exhibits') 
    THEN 'YES' 
    ELSE 'NO' 
  END as exists;

-- Step 2: Show exhibits table structure
SELECT 'Exhibits Table Structure' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'exhibits'
ORDER BY ordinal_position;

-- Step 3: Show sample exhibits data
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

-- Step 4: Count exhibits by user
SELECT 'Exhibits by User' as info,
  user_id,
  COUNT(*) as count,
  array_agg(name ORDER BY exhibit_number) as exhibit_names
FROM exhibits 
GROUP BY user_id
ORDER BY user_id;
