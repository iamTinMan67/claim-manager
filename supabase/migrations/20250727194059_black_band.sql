/*
  # Fix RLS policies for todos table

  1. Security
    - Drop existing incomplete INSERT policy if it exists
    - Add comprehensive RLS policies for todos table:
      - INSERT policy for authenticated users to create their own todos
      - SELECT policy for authenticated users to view their own todos
      - UPDATE policy for authenticated users to update their own todos
      - DELETE policy for authenticated users to delete their own todos

  2. Changes
    - Ensures users can only access their own todo items
    - Uses auth.uid() to match user_id for all operations
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own todos" ON todos;
DROP POLICY IF EXISTS "Users can view their own todos" ON todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON todos;

-- Create comprehensive RLS policies for todos table
CREATE POLICY "Users can create their own todos"
  ON todos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own todos"
  ON todos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON todos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON todos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);