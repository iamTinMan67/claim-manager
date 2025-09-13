-- Fix Chat Messages RLS Policies
-- Run this in your Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages for accessible claims" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages for accessible claims" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;

-- Create new policies that work with the actual database structure
CREATE POLICY "Users can view messages for accessible claims"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    -- User owns the claim OR is shared with the claim
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.case_number = chat_messages.claim_id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM claim_shares cs
      WHERE cs.claim_id = chat_messages.claim_id
      AND cs.shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages for accessible claims"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      -- User owns the claim OR is shared with the claim
      EXISTS (
        SELECT 1 FROM claims c
        WHERE c.case_number = chat_messages.claim_id
        AND c.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM claim_shares cs
        WHERE cs.claim_id = chat_messages.claim_id
        AND cs.shared_with_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Also fix collaboration_sessions policies
DROP POLICY IF EXISTS "Users can view sessions for accessible claims" ON collaboration_sessions;
DROP POLICY IF EXISTS "Users can create sessions for accessible claims" ON collaboration_sessions;
DROP POLICY IF EXISTS "Session hosts can update their sessions" ON collaboration_sessions;

CREATE POLICY "Users can view sessions for accessible claims"
  ON collaboration_sessions FOR SELECT
  TO authenticated
  USING (
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

-- Fix whiteboard_data policies
DROP POLICY IF EXISTS "Users can view whiteboard data for accessible claims" ON whiteboard_data;
DROP POLICY IF EXISTS "Users can create whiteboard data for accessible claims" ON whiteboard_data;
DROP POLICY IF EXISTS "Users can update their own whiteboard data" ON whiteboard_data;

CREATE POLICY "Users can view whiteboard data for accessible claims"
  ON whiteboard_data FOR SELECT
  TO authenticated
  USING (
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
