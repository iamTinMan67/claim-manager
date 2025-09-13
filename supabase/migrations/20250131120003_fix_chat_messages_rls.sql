/*
  # Fix Chat Messages RLS Policies

  1. Database Changes
    - Replace has_claim_access function with direct claim_shares table check
    - Fix RLS policies for chat_messages table
    - Ensure users can only access chat for claims they have access to

  2. Security
    - Users can view chat messages for claims they own or are shared with
    - Users can create messages for claims they have access to
    - Users can delete their own messages
*/

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
