/*
  # Add pending evidence system for guest upload verification

  1. New Tables
    - `pending_evidence`
      - `id` (uuid, primary key)
      - `submitter_id` (uuid, references profiles)
      - `claim_id` (text, references claims)
      - `file_name` (text)
      - `file_url` (text)
      - `exhibit_id` (text)
      - `method` (text)
      - `url_link` (text)
      - `book_of_deeds_ref` (text)
      - `number_of_pages` (integer)
      - `date_submitted` (date)
      - `status` (text, default 'pending')
      - `submitted_at` (timestamp)
      - `reviewed_at` (timestamp)
      - `reviewer_notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pending_evidence` table
    - Add policies for submitters and claim owners
    - Add trigger for updated_at

  3. Changes
    - Guests submit evidence to pending_evidence table
    - Hosts review and approve/reject submissions
    - Approved evidence moves to main evidence table
    - Host maintains legal responsibility for all approved content
*/

CREATE TABLE IF NOT EXISTS pending_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  file_name text,
  file_url text,
  exhibit_id text,
  method text CHECK (method IN ('Post', 'Email', 'Hand', 'Call', 'To-Do')),
  url_link text,
  book_of_deeds_ref text,
  number_of_pages integer,
  date_submitted date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pending_evidence ENABLE ROW LEVEL SECURITY;

-- Submitters can view their own pending evidence
CREATE POLICY "Submitters can view their own pending evidence"
  ON pending_evidence
  FOR SELECT
  TO public
  USING (auth.uid() = submitter_id);

-- Shared users can submit pending evidence
CREATE POLICY "Shared users can submit pending evidence"
  ON pending_evidence
  FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = submitter_id AND
    EXISTS (
      SELECT 1 FROM claim_shares 
      WHERE claim_shares.claim_id = pending_evidence.claim_id 
      AND claim_shares.shared_with_id = auth.uid()
      AND claim_shares.can_view_evidence = true
    )
  );

-- Claim owners can view pending evidence for their claims
CREATE POLICY "Claim owners can view pending evidence"
  ON pending_evidence
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM claims 
      WHERE claims.case_number = pending_evidence.claim_id 
      AND claims.user_id = auth.uid()
    )
  );

-- Claim owners can update pending evidence (approve/reject)
CREATE POLICY "Claim owners can update pending evidence"
  ON pending_evidence
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM claims 
      WHERE claims.case_number = pending_evidence.claim_id 
      AND claims.user_id = auth.uid()
    )
  );

-- Claim owners can delete pending evidence
CREATE POLICY "Claim owners can delete pending evidence"
  ON pending_evidence
  FOR DELETE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM claims 
      WHERE claims.case_number = pending_evidence.claim_id 
      AND claims.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_pending_evidence_updated_at
  BEFORE UPDATE ON pending_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();