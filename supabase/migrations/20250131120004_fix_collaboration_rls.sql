/*
  # Fix Collaboration RLS Policies

  1. Database Changes
    - Replace has_claim_access function with direct claim_shares table check
    - Fix RLS policies for collaboration_sessions and whiteboard_data tables
    - Ensure users can only access collaboration features for claims they have access to

  2. Security
    - Users can view/create collaboration sessions for claims they own or are shared with
    - Users can view/create whiteboard data for claims they have access to
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view sessions for accessible claims" ON collaboration_sessions;
DROP POLICY IF EXISTS "Users can create sessions for accessible claims" ON collaboration_sessions;
DROP POLICY IF EXISTS "Session hosts can update their sessions" ON collaboration_sessions;

DROP POLICY IF EXISTS "Users can view whiteboard data for accessible claims" ON whiteboard_data;
DROP POLICY IF EXISTS "Users can create whiteboard data for accessible claims" ON whiteboard_data;
DROP POLICY IF EXISTS "Users can update their own whiteboard data" ON whiteboard_data;

-- Create new policies for collaboration_sessions
CREATE POLICY "Users can view sessions for accessible claims"
  ON collaboration_sessions FOR SELECT
  TO authenticated
  USING (
    -- User owns the claim OR is shared with the claim
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.case_number = collaboration_sessions.claim_id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM claim_shares cs
      WHERE cs.claim_id = collaboration_sessions.claim_id
      AND cs.shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sessions for accessible claims"
  ON collaboration_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND (
      -- User owns the claim OR is shared with the claim
      EXISTS (
        SELECT 1 FROM claims c
        WHERE c.case_number = collaboration_sessions.claim_id
        AND c.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM claim_shares cs
        WHERE cs.claim_id = collaboration_sessions.claim_id
        AND cs.shared_with_id = auth.uid()
      )
    )
  );

CREATE POLICY "Session hosts can update their sessions"
  ON collaboration_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

-- Create new policies for whiteboard_data
CREATE POLICY "Users can view whiteboard data for accessible claims"
  ON whiteboard_data FOR SELECT
  TO authenticated
  USING (
    -- User owns the claim OR is shared with the claim
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.case_number = whiteboard_data.claim_id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM claim_shares cs
      WHERE cs.claim_id = whiteboard_data.claim_id
      AND cs.shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can create whiteboard data for accessible claims"
  ON whiteboard_data FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- User owns the claim OR is shared with the claim
      EXISTS (
        SELECT 1 FROM claims c
        WHERE c.case_number = whiteboard_data.claim_id
        AND c.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM claim_shares cs
        WHERE cs.claim_id = whiteboard_data.claim_id
        AND cs.shared_with_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own whiteboard data"
  ON whiteboard_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
