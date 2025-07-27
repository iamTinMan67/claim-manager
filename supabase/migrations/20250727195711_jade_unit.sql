/*
  # Add color column to claims table

  1. Changes
    - Add `color` column to `claims` table
    - Column type: text (nullable)
    - Default value: '#3B82F6' (blue color)
    - Used for visual differentiation of claims in the UI

  2. Notes
    - This column stores hex color codes for claim visualization
    - Nullable to allow existing claims without colors
    - Default blue color matches existing UI expectations
*/

-- Add color column to claims table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'color'
  ) THEN
    ALTER TABLE claims ADD COLUMN color text DEFAULT '#3B82F6';
  END IF;
END $$;