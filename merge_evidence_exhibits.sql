-- Merge exhibits into evidence table, handling duplicate IDs
-- This will consolidate the data properly

-- Step 1: Check what we're working with
SELECT 'Evidence Table' as table_name, COUNT(*) as count FROM evidence;
SELECT 'Exhibits Table' as table_name, COUNT(*) as count FROM exhibits;

-- Step 2: Add missing columns to evidence table
ALTER TABLE evidence 
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS exhibit_number integer,
ADD COLUMN IF NOT EXISTS description text;

-- Step 3: Update existing evidence records with exhibit data
-- Only update records that exist in both tables
UPDATE evidence 
SET 
  name = e.name,
  exhibit_number = e.exhibit_number,
  description = e.description,
  file_name = COALESCE(evidence.file_name, e.name),
  title = COALESCE(evidence.title, e.name),
  method = COALESCE(evidence.method, 'Exhibit'),
  display_order = COALESCE(evidence.display_order, e.exhibit_number)
FROM exhibits e
WHERE evidence.id = e.id;

-- Step 4: Create new evidence records for exhibits that don't exist in evidence
-- We'll generate new IDs to avoid conflicts
INSERT INTO evidence (
  id,
  user_id,
  case_number,
  name,
  exhibit_number,
  description,
  file_name,
  title,
  method,
  display_order,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() as id, -- Generate new ID to avoid conflicts
  e.user_id,
  c.case_number,
  e.name,
  e.exhibit_number,
  e.description,
  e.name as file_name,
  e.name as title,
  'Exhibit' as method,
  e.exhibit_number as display_order,
  e.created_at,
  e.updated_at
FROM exhibits e
LEFT JOIN claims c ON c.user_id = e.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM evidence ev WHERE ev.id = e.id
);

-- Step 5: Handle evidence records that don't have claims
UPDATE evidence 
SET case_number = 'DEFAULT-' || user_id::text
WHERE case_number IS NULL;

-- Step 6: Show results
SELECT 'Migration Complete' as info, COUNT(*) as total_evidence FROM evidence;
SELECT 'Evidence by Claim' as info, case_number, COUNT(*) as count FROM evidence GROUP BY case_number ORDER BY case_number;

-- Step 7: Show some sample evidence records
SELECT 'Sample Evidence' as info, id, name, case_number, method FROM evidence ORDER BY created_at DESC LIMIT 5;
