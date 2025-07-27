/*
  # Add foreign key constraint between todos and profiles tables

  1. Foreign Key Constraint
    - Add constraint linking `todos.user_id` to `profiles.id`
    - Ensures data integrity for user references in todos
    - Enables Supabase queries with joins between tables

  2. Safety
    - Uses conditional check to avoid errors if constraint already exists
    - Includes CASCADE delete to maintain referential integrity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'todos_user_id_fkey' 
    AND table_name = 'todos'
  ) THEN
    ALTER TABLE todos 
    ADD CONSTRAINT todos_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;