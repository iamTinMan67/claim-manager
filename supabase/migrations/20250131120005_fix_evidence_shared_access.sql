/*
  # Fix Evidence RLS for Shared Claims Access

  This migration updates the evidence table RLS policies to allow users to view
  evidence from shared claims, not just their own evidence.

  Changes:
  1. Update evidence SELECT policy to allow viewing evidence from shared claims
  2. Allow users to view evidence if they have access to the claim through claim_shares
  3. Maintain existing security for evidence creation/update/deletion
*/

-- Drop existing evidence policies
DROP POLICY IF EXISTS "Users can view their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can create their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can update their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can delete their own evidence" ON evidence;

-- Create new evidence policies that support shared claims
CREATE POLICY "Users can view evidence from their claims and shared claims"
  ON evidence FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own evidence
    auth.uid() = user_id
    OR
    -- Users can view evidence from claims they have access to through claim_shares
    EXISTS (
      SELECT 1 FROM claim_shares cs
      WHERE cs.claim_id = evidence.case_number
      AND cs.shared_with_id = auth.uid()
      AND cs.can_view_evidence = true
    )
    OR
    -- Claim owners can view evidence from their own claims
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.case_number = evidence.case_number
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create evidence for their claims and shared claims"
  ON evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can create evidence for their own claims
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.case_number = evidence.case_number
      AND c.user_id = auth.uid()
    )
    OR
    -- Users can create evidence for claims they have edit access to
    EXISTS (
      SELECT 1 FROM claim_shares cs
      WHERE cs.claim_id = evidence.case_number
      AND cs.shared_with_id = auth.uid()
      AND cs.permission = 'edit'
      AND cs.can_view_evidence = true
    )
  );

CREATE POLICY "Users can update evidence they created or have edit access to"
  ON evidence FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own evidence
    auth.uid() = user_id
    OR
    -- Claim owners can update evidence in their claims
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.case_number = evidence.case_number
      AND c.user_id = auth.uid()
    )
    OR
    -- Users with edit permission can update evidence in shared claims
    EXISTS (
      SELECT 1 FROM claim_shares cs
      WHERE cs.claim_id = evidence.case_number
      AND cs.shared_with_id = auth.uid()
      AND cs.permission = 'edit'
      AND cs.can_view_evidence = true
    )
  );

CREATE POLICY "Users can delete evidence they created or own the claim"
  ON evidence FOR DELETE
  TO authenticated
  USING (
    -- Users can delete their own evidence
    auth.uid() = user_id
    OR
    -- Claim owners can delete evidence from their claims
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.case_number = evidence.case_number
      AND c.user_id = auth.uid()
    )
  );
