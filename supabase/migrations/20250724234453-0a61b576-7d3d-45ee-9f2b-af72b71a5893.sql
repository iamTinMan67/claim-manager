-- Update evidence records to use proper exhibit IDs instead of legacy format strings
-- Map EX001 -> first exhibit (exhibit_number = 1), EX002 -> exhibit_number = 2, etc.
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