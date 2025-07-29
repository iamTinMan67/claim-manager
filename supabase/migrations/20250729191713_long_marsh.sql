/*
  # Add missing columns to claim_shares table

  1. New Columns
    - `is_frozen` (boolean, default false) - Controls if guest access is frozen
    - `is_muted` (boolean, default false) - Controls if guest can participate in chat

  2. Changes
    - Add is_frozen column with default false
    - Add is_muted column with default false
    - These columns are used for guest access control in shared claims
*/

-- Add is_frozen column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_shares' AND column_name = 'is_frozen'
  ) THEN
    ALTER TABLE claim_shares ADD COLUMN is_frozen boolean DEFAULT false;
  END IF;
END $$;

-- Add is_muted column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_shares' AND column_name = 'is_muted'
  ) THEN
    ALTER TABLE claim_shares ADD COLUMN is_muted boolean DEFAULT false;
  END IF;
END $$;