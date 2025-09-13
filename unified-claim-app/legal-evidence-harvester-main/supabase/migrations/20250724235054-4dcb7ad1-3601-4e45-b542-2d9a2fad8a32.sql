-- Fix the exhibit_id mapping - the previous update didn't work properly
-- Update evidence records to use proper exhibit UUIDs instead of legacy format strings
UPDATE evidence 
SET exhibit_id = (
  SELECT id::text 
  FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = CAST(SUBSTRING(evidence.exhibit_id FROM 3) AS INTEGER)
)
WHERE exhibit_id SIMILAR TO 'EX[0-9]+' 
AND EXISTS (
  SELECT 1 FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = CAST(SUBSTRING(evidence.exhibit_id FROM 3) AS INTEGER)
);