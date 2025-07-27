/*
  # Add case_number column to todos table

  1. Changes
    - Add `case_number` column to `todos` table (text, nullable)
    - Add foreign key constraint to reference `claims.case_number`
    - Add index for better query performance

  2. Security
    - No changes to existing RLS policies needed
*/

-- Add case_number column to todos table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'todos' AND column_name = 'case_number'
  ) THEN
    ALTER TABLE todos ADD COLUMN case_number text;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'todos_case_number_fkey'
  ) THEN
    ALTER TABLE todos 
    ADD CONSTRAINT todos_case_number_fkey 
    FOREIGN KEY (case_number) REFERENCES claims(case_number) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for better query performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_todos_case_number'
  ) THEN
    CREATE INDEX idx_todos_case_number ON todos(case_number);
  END IF;
END $$;