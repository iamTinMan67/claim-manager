-- =====================================================
-- FIX EVIDENCE TABLE 400 ERROR
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Ensure evidence table exists with proper structure
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_number text REFERENCES claims(case_number) ON DELETE CASCADE,
  exhibit_id text,
  title text NOT NULL,
  description text,
  file_name text,
  file_url text,
  file_size integer,
  file_type text,
  method text DEFAULT 'upload',
  url_link text,
  book_of_deeds_ref text,
  number_of_pages integer,
  date_submitted date,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS on evidence table
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- 3. Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can create their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can update their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can delete their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can view evidence from their claims and shared claims" ON evidence;
DROP POLICY IF EXISTS "Users can create evidence for their claims" ON evidence;
DROP POLICY IF EXISTS "Users can update evidence they created or own the claim" ON evidence;
DROP POLICY IF EXISTS "Users can delete evidence they created or own the claim" ON evidence;

-- 4. Create comprehensive RLS policies for evidence
-- Policy for viewing evidence
CREATE POLICY "Users can view evidence from their claims and shared claims"
  ON evidence FOR SELECT
  TO authenticated
  USING (
    -- User can view their own evidence
    auth.uid() = user_id
    OR
    -- User can view evidence from claims they own
    EXISTS (
      SELECT 1 FROM claims 
      WHERE case_number = evidence.case_number 
      AND user_id = auth.uid()
    )
    OR
    -- User can view evidence from claims they have access to via claim_shares
    EXISTS (
      SELECT 1 FROM claim_shares 
      WHERE claim_id = evidence.case_number 
      AND shared_with_id = auth.uid()
    )
  );

-- Policy for creating evidence
CREATE POLICY "Users can create evidence for their claims"
  ON evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can create evidence for their own claims
    auth.uid() = user_id
    AND
    (
      -- Either the case_number is null (general evidence)
      case_number IS NULL
      OR
      -- Or the user owns the claim
      EXISTS (
        SELECT 1 FROM claims 
        WHERE case_number = evidence.case_number 
        AND user_id = auth.uid()
      )
      OR
      -- Or the user has access to the claim via claim_shares
      EXISTS (
        SELECT 1 FROM claim_shares 
        WHERE claim_id = evidence.case_number 
        AND shared_with_id = auth.uid()
      )
    )
  );

-- Policy for updating evidence
CREATE POLICY "Users can update evidence they created or own the claim"
  ON evidence FOR UPDATE
  TO authenticated
  USING (
    -- User can update evidence they created
    auth.uid() = user_id
    OR
    -- User can update evidence from claims they own
    EXISTS (
      SELECT 1 FROM claims 
      WHERE case_number = evidence.case_number 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same conditions for the new values
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM claims 
      WHERE case_number = evidence.case_number 
      AND user_id = auth.uid()
    )
  );

-- Policy for deleting evidence
CREATE POLICY "Users can delete evidence they created or own the claim"
  ON evidence FOR DELETE
  TO authenticated
  USING (
    -- User can delete evidence they created
    auth.uid() = user_id
    OR
    -- User can delete evidence from claims they own
    EXISTS (
      SELECT 1 FROM claims 
      WHERE case_number = evidence.case_number 
      AND user_id = auth.uid()
    )
  );

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_case_number ON evidence(case_number);
CREATE INDEX IF NOT EXISTS idx_evidence_display_order ON evidence(display_order);

-- 6. Test the evidence table access
SELECT 
  'Evidence table test' as test_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM evidence LIMIT 1) THEN '✅ EVIDENCE ACCESSIBLE'
    ELSE '❌ EVIDENCE NOT ACCESSIBLE'
  END as evidence_test;

-- 7. Check if there are any foreign key constraint issues
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'evidence'
ORDER BY tc.table_name;
