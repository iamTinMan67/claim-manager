/*
  # Create Missing Core Tables

  1. Database Changes
    - Create missing `evidence` table
    - Create missing `claim_shares` table  
    - Create missing `evidence_claims` table
    - Create missing `pending_evidence` table
    - This resolves all foreign key constraint errors

  2. Security
    - Enable RLS on all tables
    - Add policies for user access control
    - Ensure proper data isolation

  3. Notes
    - This is a critical fix for the database schema
    - All existing foreign key constraints will now work properly
*/

-- Create evidence table if it doesn't exist
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_number text,
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

-- Create claim_shares table if it doesn't exist
CREATE TABLE IF NOT EXISTS claim_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  can_view_evidence boolean NOT NULL DEFAULT false,
  donation_required boolean NOT NULL DEFAULT false,
  donation_paid boolean NOT NULL DEFAULT false,
  donation_amount integer,
  donation_paid_at timestamptz,
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(claim_id, shared_with_id)
);

-- Create evidence_claims table if it doesn't exist
CREATE TABLE IF NOT EXISTS evidence_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(evidence_id, claim_id)
);

-- Create pending_evidence table if it doesn't exist
CREATE TABLE IF NOT EXISTS pending_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  file_name text,
  file_url text,
  file_size integer,
  file_type text,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  review_notes text
);

-- Enable RLS on all tables
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_evidence ENABLE ROW LEVEL SECURITY;

-- Evidence table policies
DROP POLICY IF EXISTS "Users can view their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can create their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can update their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can delete their own evidence" ON evidence;

CREATE POLICY "Users can view their own evidence"
  ON evidence FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evidence"
  ON evidence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evidence"
  ON evidence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evidence"
  ON evidence FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Claim shares table policies
DROP POLICY IF EXISTS "Users can view claim shares they own or are shared with" ON claim_shares;
DROP POLICY IF EXISTS "Users can create claim shares for their claims" ON claim_shares;
DROP POLICY IF EXISTS "Users can update claim shares they own" ON claim_shares;
DROP POLICY IF EXISTS "Users can delete claim shares they own" ON claim_shares;

CREATE POLICY "Users can view claim shares they own or are shared with"
  ON claim_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);

CREATE POLICY "Users can create claim shares for their claims"
  ON claim_shares FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update claim shares they own"
  ON claim_shares FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete claim shares they own"
  ON claim_shares FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Evidence claims table policies
DROP POLICY IF EXISTS "Users can view evidence claims for their evidence" ON evidence_claims;
DROP POLICY IF EXISTS "Users can create evidence claims for their evidence" ON evidence_claims;
DROP POLICY IF EXISTS "Users can delete evidence claims for their evidence" ON evidence_claims;

CREATE POLICY "Users can view evidence claims for their evidence"
  ON evidence_claims FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM evidence e 
    WHERE e.id = evidence_claims.evidence_id 
    AND e.user_id = auth.uid()
  ));

CREATE POLICY "Users can create evidence claims for their evidence"
  ON evidence_claims FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM evidence e 
    WHERE e.id = evidence_claims.evidence_id 
    AND e.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete evidence claims for their evidence"
  ON evidence_claims FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM evidence e 
    WHERE e.id = evidence_claims.evidence_id 
    AND e.user_id = auth.uid()
  ));

-- Pending evidence table policies
DROP POLICY IF EXISTS "Users can view pending evidence for their claims" ON pending_evidence;
DROP POLICY IF EXISTS "Users can create pending evidence" ON pending_evidence;
DROP POLICY IF EXISTS "Users can update pending evidence they submitted" ON pending_evidence;
DROP POLICY IF EXISTS "Users can delete pending evidence they submitted" ON pending_evidence;

CREATE POLICY "Users can view pending evidence for their claims"
  ON pending_evidence FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM claims c 
    WHERE c.case_number = pending_evidence.claim_id 
    AND c.user_id = auth.uid()
  ) OR auth.uid() = submitter_id);

CREATE POLICY "Users can create pending evidence"
  ON pending_evidence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitter_id);

CREATE POLICY "Users can update pending evidence they submitted"
  ON pending_evidence FOR UPDATE
  TO authenticated
  USING (auth.uid() = submitter_id);

CREATE POLICY "Users can delete pending evidence they submitted"
  ON pending_evidence FOR DELETE
  TO authenticated
  USING (auth.uid() = submitter_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_case_number ON evidence(case_number);
CREATE INDEX IF NOT EXISTS idx_claim_shares_owner_id ON claim_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_claim_shares_shared_with_id ON claim_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_claim_shares_claim_id ON claim_shares(claim_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claims_evidence_id ON evidence_claims(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claims_claim_id ON evidence_claims(claim_id);
CREATE INDEX IF NOT EXISTS idx_pending_evidence_submitter_id ON pending_evidence(submitter_id);
CREATE INDEX IF NOT EXISTS idx_pending_evidence_claim_id ON pending_evidence(claim_id);

-- Add triggers for updated_at
CREATE TRIGGER update_evidence_updated_at
    BEFORE UPDATE ON evidence
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claim_shares_updated_at
    BEFORE UPDATE ON claim_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
