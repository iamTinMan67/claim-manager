-- Simple step-by-step check of evidence and exhibits tables

-- Step 1: Check if exhibits table exists
SELECT 'Step 1: Exhibits Table Status' as step, 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exhibits') 
    THEN 'EXISTS' 
    ELSE 'DOES NOT EXIST' 
  END as result;

-- Step 2: Count exhibits records
SELECT 'Step 2: Exhibits Count' as step, COUNT(*) as count FROM exhibits;

-- Step 3: Count evidence records  
SELECT 'Step 3: Evidence Count' as step, COUNT(*) as count FROM evidence;

-- Step 4: Check evidence field completeness
SELECT 'Step 4: Evidence Fields' as step,
  COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as has_name,
  COUNT(CASE WHEN file_name IS NOT NULL THEN 1 END) as has_file_name,
  COUNT(CASE WHEN title IS NOT NULL THEN 1 END) as has_title,
  COUNT(CASE WHEN case_number IS NOT NULL THEN 1 END) as has_case_number
FROM evidence;

-- Step 5: Show a few sample evidence records
SELECT 'Step 5: Sample Evidence' as step, 
  id, 
  name, 
  file_name, 
  title, 
  case_number,
  method
FROM evidence 
ORDER BY created_at DESC 
LIMIT 3;
