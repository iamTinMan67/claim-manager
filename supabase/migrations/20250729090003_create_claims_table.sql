/*
  # Create Missing Claims Table

  1. Database Changes
    - Create the missing `claims` table that other tables reference
    - This resolves foreign key constraint errors
    - Ensures all table relationships work properly

  2. Security
    - Enable RLS on claims table
    - Add policies for user access control
    - Link claims to profiles for ownership

  3. Notes
    - This is a critical fix for the database schema
    - All existing foreign key constraints will now work properly
*/

-- Create claims table if it doesn't exist
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  court text,
  plaintiff_name text,
  defendant_name text,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending', 'dismissed')),
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own claims" ON claims;
DROP POLICY IF EXISTS "Users can create their own claims" ON claims;
DROP POLICY IF EXISTS "Users can update their own claims" ON claims;
DROP POLICY IF EXISTS "Users can delete their own claims" ON claims;

CREATE POLICY "Users can view their own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own claims"
  ON claims FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_case_number ON claims(case_number);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- Add trigger for updated_at
CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
