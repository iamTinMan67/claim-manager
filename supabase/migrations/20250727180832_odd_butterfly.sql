/*
  # Add foreign key constraint for claim_shares to profiles

  1. Changes
    - Add foreign key constraint on `claim_shares.shared_with_id` referencing `profiles.id`
    - This enables Supabase to understand the relationship for queries

  2. Security
    - No RLS changes needed as existing policies remain intact
*/

-- Add foreign key constraint to establish relationship between claim_shares and profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'claim_shares_shared_with_id_fkey' 
    AND table_name = 'claim_shares'
  ) THEN
    ALTER TABLE claim_shares 
    ADD CONSTRAINT claim_shares_shared_with_id_fkey 
    FOREIGN KEY (shared_with_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;