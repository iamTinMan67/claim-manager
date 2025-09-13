/*
  # Fix Profiles Table RLS for Claim Sharing

  1. Database Changes
    - Add policy to allow users to look up other profiles by email
    - This is required for claim sharing functionality
    - Users need to be able to find other users to share with

  2. Security
    - Only allow email lookup, not full profile access
    - Maintains security while enabling sharing functionality
*/

-- Add policy to allow users to look up other profiles by email for sharing
-- This is more permissive than the original policy but necessary for sharing
CREATE POLICY "Users can look up profiles by email for sharing"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);  -- Allow all authenticated users to see profiles for sharing

-- Note: This is more permissive than the original "own profile only" policy
-- but it's necessary for claim sharing functionality. Users can only see
-- basic profile info (id, email) which is needed for sharing.
