-- =====================================================
-- QUICK FIX FOR 400 ERRORS
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Ensure profiles table exists and has proper RLS
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

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles for sharing" ON profiles;

-- Create policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Allow viewing profiles for sharing (needed for guest access)
CREATE POLICY "Users can view all profiles for sharing"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Ensure claims table exists
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

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view their own claims" ON claims;
DROP POLICY IF EXISTS "Users can create their own claims" ON claims;
DROP POLICY IF EXISTS "Users can update their own claims" ON claims;
DROP POLICY IF EXISTS "Users can delete their own claims" ON claims;

-- Create policies
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

-- 3. Ensure todos table exists
CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_number text REFERENCES claims(case_number) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed boolean DEFAULT false,
  completed_at timestamptz,
  alarm_enabled boolean DEFAULT false,
  alarm_time time,
  responsible_user_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on todos
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view their own todos" ON todos;
DROP POLICY IF EXISTS "Users can create their own todos" ON todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON todos;
DROP POLICY IF EXISTS "Users can view assigned todos" ON todos;

-- Create policies
CREATE POLICY "Users can view their own todos"
  ON todos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view assigned todos"
  ON todos FOR SELECT
  TO authenticated
  USING (auth.uid() = responsible_user_id);

CREATE POLICY "Users can create their own todos"
  ON todos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON todos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON todos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Ensure evidence table exists
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_number text REFERENCES claims(case_number) ON DELETE CASCADE,
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

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can create their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can update their own evidence" ON evidence;
DROP POLICY IF EXISTS "Users can delete their own evidence" ON evidence;

-- Create policies
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

-- 5. Ensure chat_messages table exists
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image')),
  file_url text,
  file_name text,
  file_size integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view chat messages for their claims" ON chat_messages;
DROP POLICY IF EXISTS "Users can create chat messages for their claims" ON chat_messages;

-- Create policies
CREATE POLICY "Users can view chat messages for their claims"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims 
      WHERE case_number = chat_messages.claim_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chat messages for their claims"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM claims 
      WHERE case_number = chat_messages.claim_id 
      AND user_id = auth.uid()
    )
  );

-- 6. Ensure claim_shares table exists
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
  is_frozen boolean DEFAULT false,
  is_muted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(claim_id, shared_with_id)
);

-- Enable RLS on claim_shares
ALTER TABLE claim_shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view their claim shares" ON claim_shares;
DROP POLICY IF EXISTS "Users can create claim shares" ON claim_shares;
DROP POLICY IF EXISTS "Users can update their claim shares" ON claim_shares;
DROP POLICY IF EXISTS "Users can delete their claim shares" ON claim_shares;

-- Create policies
CREATE POLICY "Users can view their claim shares"
  ON claim_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);

CREATE POLICY "Users can create claim shares"
  ON claim_shares FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their claim shares"
  ON claim_shares FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their claim shares"
  ON claim_shares FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- 7. Ensure calendar_events table exists
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claim_id text REFERENCES claims(case_number) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean DEFAULT false,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view their own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can create their own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update their own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete their own calendar events" ON calendar_events;

-- Create policies
CREATE POLICY "Users can view their own calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_case_number ON claims(case_number);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_case_number ON todos(case_number);
CREATE INDEX IF NOT EXISTS idx_todos_responsible_user_id ON todos(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_case_number ON evidence(case_number);
CREATE INDEX IF NOT EXISTS idx_chat_messages_claim_id ON chat_messages(claim_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_claim_shares_owner_id ON claim_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_claim_shares_shared_with_id ON claim_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_claim_id ON calendar_events(claim_id);

-- 9. Insert missing profile for current user if needed
INSERT INTO profiles (id, email, full_name)
SELECT 
  auth.uid(),
  auth.email(),
  COALESCE(auth.raw_user_meta_data->>'full_name', split_part(auth.email(), '@', 1))
WHERE auth.uid() IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
ON CONFLICT (id) DO NOTHING;
