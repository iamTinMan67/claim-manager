-- Fix Chat Messages RLS Policies ONLY
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
