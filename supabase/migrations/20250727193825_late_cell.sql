/*
  # Fix RLS policy for todos table

  1. Security
    - Add INSERT policy for todos table to allow authenticated users to create their own todos
    - Ensure the policy allows users to insert todos where user_id matches their auth.uid()

  This fixes the 403 error when trying to create new todos.
*/

-- Create INSERT policy for todos table
CREATE POLICY "Users can create their own todos"
  ON todos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);