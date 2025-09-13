/*
  # Add Responsible User Assignment to Todos

  1. Database Changes
    - Add `responsible_user_id` column to todos table
    - Add foreign key constraint to profiles table
    - Add index for better query performance
    - Update RLS policies to handle assigned tasks

  2. Security
    - Users can view tasks assigned to them
    - Users can view tasks they created (regardless of assignment)
    - Users can assign tasks to other users in shared claims

  3. Features
    - Tasks assigned to others show in their private calendar
    - Tasks assigned to others don't show in assignor's private todo list
    - All tasks show in shared todo list regardless of assignment
*/

-- Add responsible_user_id column to todos table
ALTER TABLE todos 
ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_todos_responsible_user_id ON todos(responsible_user_id);

-- Update RLS policies to handle assigned tasks
DROP POLICY IF EXISTS "Users can view their own todos" ON todos;
DROP POLICY IF EXISTS "Users can create their own todos" ON todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON todos;

-- Create new policies that handle task assignments
CREATE POLICY "Users can view their own todos and assigned tasks"
  ON todos FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    auth.uid() = responsible_user_id
  );

CREATE POLICY "Users can create todos"
  ON todos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos and assigned tasks"
  ON todos FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    auth.uid() = responsible_user_id
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() = responsible_user_id
  );

CREATE POLICY "Users can delete their own todos"
  ON todos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add policy for shared claim todos (all users with access can see all tasks)
CREATE POLICY "Users can view shared claim todos"
  ON todos FOR SELECT
  TO authenticated
  USING (
    case_number IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM claim_shares cs
      WHERE cs.claim_id = todos.case_number
      AND cs.shared_with_id = auth.uid()
    )
  );
