/*
  # Add foreign key relationship between pending_evidence and profiles

  1. Database Changes
    - Add foreign key constraint on `pending_evidence.submitter_id` referencing `profiles.id`
    - This enables proper joins between pending evidence and user profiles

  2. Security
    - No RLS changes needed as existing policies remain valid
    - Foreign key ensures data integrity

  3. Notes
    - This resolves the PGRST200 error when querying pending evidence with profile data
    - Uses CASCADE delete to maintain referential integrity
*/

-- Add foreign key constraint between pending_evidence.submitter_id and profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pending_evidence_submitter_id_fkey'
    AND table_name = 'pending_evidence'
  ) THEN
    ALTER TABLE pending_evidence 
    ADD CONSTRAINT pending_evidence_submitter_id_fkey 
    FOREIGN KEY (submitter_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;