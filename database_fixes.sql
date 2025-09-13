-- =====================================================
-- CLAIM MANAGER DATABASE FIXES
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 2. Create claims table if it doesn't exist
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  court text,
  plaintiff_name text,
  defendant_name text,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending', 'dismissed')),
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on claims
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Claims policies
DROP POLICY IF EXISTS "Users can view their own claims" ON claims;
DROP POLICY IF EXISTS "Users can create their own claims" ON claims;
DROP POLICY IF EXISTS "Users can update their own claims" ON claims;
DROP POLICY IF EXISTS "Users can delete their own claims" ON claims;

CREATE POLICY "Users can view their own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own claims"
  ON claims FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Create evidence table if it doesn't exist
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

-- Enable RLS on evidence
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Evidence policies
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

-- 4. Create claim_shares table if it doesn't exist
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

-- Enable RLS on claim_shares
ALTER TABLE claim_shares ENABLE ROW LEVEL SECURITY;

-- Claim shares policies
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

-- 5. Create evidence_claims table if it doesn't exist
CREATE TABLE IF NOT EXISTS evidence_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(evidence_id, claim_id)
);

-- Enable RLS on evidence_claims
ALTER TABLE evidence_claims ENABLE ROW LEVEL SECURITY;

-- Evidence claims policies
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

-- 6. Create pending_evidence table if it doesn't exist
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

-- Enable RLS on pending_evidence
ALTER TABLE pending_evidence ENABLE ROW LEVEL SECURITY;

-- Pending evidence policies
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

-- 7. Fix chat_messages policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can view messages for accessible claims" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages for accessible claims" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;

CREATE POLICY "Users can view messages for accessible claims"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can create messages for accessible claims"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (has_claim_access(claim_id, auth.uid()) AND auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_case_number ON claims(case_number);
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_case_number ON evidence(case_number);
CREATE INDEX IF NOT EXISTS idx_claim_shares_owner_id ON claim_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_claim_shares_shared_with_id ON claim_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_claim_shares_claim_id ON claim_shares(claim_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claims_evidence_id ON evidence_claims(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claims_claim_id ON evidence_claims(claim_id);
CREATE INDEX IF NOT EXISTS idx_pending_evidence_submitter_id ON pending_evidence(submitter_id);
CREATE INDEX IF NOT EXISTS idx_pending_evidence_claim_id ON pending_evidence(claim_id);

-- 9. Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. Add triggers for updated_at
DROP TRIGGER IF EXISTS update_claims_updated_at ON claims;
CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_evidence_updated_at ON evidence;
CREATE TRIGGER update_evidence_updated_at
    BEFORE UPDATE ON evidence
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_claim_shares_updated_at ON claim_shares;
CREATE TRIGGER update_claim_shares_updated_at
    BEFORE UPDATE ON claim_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- END OF FIXES
-- =====================================================
