/*
  # Add chat and collaboration system

  1. New Tables
    - `chat_messages` - Store text messages, file shares, and system notifications
    - `collaboration_sessions` - Track active video/whiteboard sessions
    - `whiteboard_data` - Store whiteboard drawings and annotations

  2. Security
    - Enable RLS on all new tables
    - Add policies for claim-based access control
    - Ensure only claim participants can access chat/collaboration

  3. Features
    - Real-time chat with file sharing
    - Video conference session management
    - Collaborative whiteboard with drawing/typing
    - Permission-based evidence submission from whiteboard
*/

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'audio', 'video', 'system', 'whiteboard_share')),
  file_url text,
  file_name text,
  file_size integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Collaboration sessions table
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_type text NOT NULL DEFAULT 'video' CHECK (session_type IN ('video', 'whiteboard', 'screen_share')),
  session_url text,
  is_active boolean DEFAULT true,
  participants jsonb DEFAULT '[]',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- Whiteboard data table
CREATE TABLE IF NOT EXISTS whiteboard_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  session_id uuid REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  element_type text NOT NULL CHECK (element_type IN ('drawing', 'text', 'image', 'file', 'sticky_note')),
  element_data jsonb NOT NULL,
  position_x integer DEFAULT 0,
  position_y integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_data ENABLE ROW LEVEL SECURITY;

-- Chat messages policies
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

-- Collaboration sessions policies
CREATE POLICY "Users can view sessions for accessible claims"
  ON collaboration_sessions FOR SELECT
  TO authenticated
  USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can create sessions for accessible claims"
  ON collaboration_sessions FOR INSERT
  TO authenticated
  WITH CHECK (has_claim_access(claim_id, auth.uid()) AND auth.uid() = host_id);

CREATE POLICY "Session hosts can update their sessions"
  ON collaboration_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

-- Whiteboard data policies
CREATE POLICY "Users can view whiteboard data for accessible claims"
  ON whiteboard_data FOR SELECT
  TO authenticated
  USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can create whiteboard data for accessible claims"
  ON whiteboard_data FOR INSERT
  TO authenticated
  WITH CHECK (has_claim_access(claim_id, auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Users can update their own whiteboard data"
  ON whiteboard_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whiteboard data"
  ON whiteboard_data FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_claim_id ON chat_messages(claim_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_claim_id ON collaboration_sessions(claim_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_data_claim_id ON whiteboard_data(claim_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_data_session_id ON whiteboard_data(session_id);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whiteboard_data_updated_at
    BEFORE UPDATE ON whiteboard_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();