/*
  # Add missing foreign key relationships for claim_shares table

  1. Foreign Key Constraints
    - Add foreign key from `claim_shares.owner_id` to `profiles.id`
    - This enables PostgREST to resolve the relationship for joins

  2. Security
    - No changes to existing RLS policies
    - Maintains current access control
*/

-- Add foreign key constraint for owner_id to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'claim_shares_owner_id_fkey' 
    AND table_name = 'claim_shares'
  ) THEN
    ALTER TABLE claim_shares 
    ADD CONSTRAINT claim_shares_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;