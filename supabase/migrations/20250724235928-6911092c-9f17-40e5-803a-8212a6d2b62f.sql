-- Fix the exhibit_id mapping properly for all records
-- Clear any invalid exhibit_id values and update with proper UUIDs
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

-- For any remaining unmapped EX### format, let's update them based on display_order
UPDATE evidence 
SET exhibit_id = (
  SELECT id::text 
  FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = evidence.display_order
)
WHERE exhibit_id SIMILAR TO 'EX[0-9]+' 
AND EXISTS (
  SELECT 1 FROM exhibits 
  WHERE user_id = evidence.user_id 
  AND exhibit_number = evidence.display_order
);