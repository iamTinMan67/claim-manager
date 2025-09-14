-- Check the current state of evidence data to see field mapping issues
SELECT 
  'Evidence Data Sample' as info,
  id,
  name,
  title,
  file_name,
  exhibit_id,
  exhibit_number,
  method,
  case_number,
  created_at
FROM evidence 
ORDER BY created_at DESC 
LIMIT 10;
