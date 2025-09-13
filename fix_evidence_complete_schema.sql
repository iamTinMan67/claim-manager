-- =====================================================
-- COMPLETE EVIDENCE TABLE SCHEMA FOR EXPORT FUNCTIONALITY
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Drop and recreate the evidence table with ALL required fields for export
DROP TABLE IF EXISTS evidence CASCADE;

-- 2. Create evidence table with complete structure for export functionality
CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_number text REFERENCES claims(case_number) ON DELETE CASCADE,
  exhibit_id text,
  title text NOT NULL,
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

-- 3. Enable RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- 4. Create comprehensive RLS policies
DROP POLICY IF EXISTS "Users can view evidence from their claims and shared claims" ON evidence;
DROP POLICY IF EXISTS "Users can create evidence for their claims" ON evidence;
DROP POLICY IF EXISTS "Users can update evidence they created or own the claim" ON evidence;
DROP POLICY IF EXISTS "Users can delete evidence they created or own the claim" ON evidence;
DROP POLICY IF EXISTS "Guests can upload evidence to shared claims" ON evidence;

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

CREATE POLICY "Guests can upload evidence to shared claims"
  ON evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM claim_shares WHERE claim_id = evidence.case_number AND shared_with_id = auth.uid())
  );

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_case_number ON evidence(case_number);
CREATE INDEX IF NOT EXISTS idx_evidence_display_order ON evidence(display_order);
CREATE INDEX IF NOT EXISTS idx_evidence_exhibit_id ON evidence(exhibit_id);

-- 6. Insert sample data for testing export functionality
INSERT INTO evidence (
    user_id, 
    title, 
    case_number, 
    exhibit_id,
    file_name,
    method,
    number_of_pages,
    date_submitted,
    book_of_deeds_ref
) VALUES 
(
    (SELECT id FROM profiles LIMIT 1),
    'Contract Document',
    'KB2025LIV000075',
    '1',
    'contract_agreement.pdf',
    'upload',
    5,
    CURRENT_DATE,
    'BD-001'
),
(
    (SELECT id FROM profiles LIMIT 1),
    'Email Correspondence',
    'KB2025LIV000075',
    '2',
    'email_thread.pdf',
    'email',
    3,
    CURRENT_DATE - INTERVAL '1 day',
    'BD-002'
),
(
    (SELECT id FROM profiles LIMIT 1),
    'Photographic Evidence',
    'KB2025LIV000075',
    '3',
    'damage_photos.jpg',
    'upload',
    1,
    CURRENT_DATE - INTERVAL '2 days',
    'BD-003'
);

-- 7. Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'evidence' 
ORDER BY ordinal_position;

-- 8. Test the export query (same as used in ExportFeatures.tsx)
SELECT 
    *,
    date_submitted::text
FROM evidence 
WHERE case_number = 'KB2025LIV000075'
ORDER BY display_order ASC NULLS LAST, created_at ASC;

-- 9. Show success message
SELECT 'Evidence table created successfully with all export fields!' as status;
