-- Fix remaining legacy exhibit_id values by creating missing exhibits if needed
-- First let's map the remaining EX005 and EX011 if they exist in exhibits table
UPDATE evidence 
SET exhibit_id = (
  SELECT id::text 
  FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = 5
)
WHERE exhibit_id = 'EX005' 
AND EXISTS (
  SELECT 1 FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = 5
);

UPDATE evidence 
SET exhibit_id = (
  SELECT id::text 
  FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = 11
)
WHERE exhibit_id = 'EX011' 
AND EXISTS (
  SELECT 1 FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = 11
);