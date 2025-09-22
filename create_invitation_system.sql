-- Create invitation system tables
-- This script creates the necessary tables for a proper invitation system

-- 1. Pending invitations table
CREATE TABLE IF NOT EXISTS pending_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(case_number) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'edit',
  can_view_evidence BOOLEAN NOT NULL DEFAULT true,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  donation_amount DECIMAL(10,2) DEFAULT 0,
  donation_required BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(claim_id, invited_user_id)
);

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('invitation', 'claim_updated', 'evidence_added', 'message')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_invitations_invited_user ON pending_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_owner ON pending_invitations(owner_id);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_claim ON pending_invitations(claim_id);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_status ON pending_invitations(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- 4. Create RLS policies for pending_invitations
ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see invitations sent to them
CREATE POLICY "Users can view their own invitations" ON pending_invitations
  FOR SELECT USING (invited_user_id = auth.uid());

-- Policy: Users can see invitations they sent
CREATE POLICY "Users can view invitations they sent" ON pending_invitations
  FOR SELECT USING (owner_id = auth.uid());

-- Policy: Users can update invitations sent to them (accept/decline)
CREATE POLICY "Users can update their own invitations" ON pending_invitations
  FOR UPDATE USING (invited_user_id = auth.uid());

-- Policy: Users can insert invitations (when they're the owner)
CREATE POLICY "Users can create invitations for their claims" ON pending_invitations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Policy: Users can delete invitations they sent
CREATE POLICY "Users can delete invitations they sent" ON pending_invitations
  FOR DELETE USING (owner_id = auth.uid());

-- 5. Create RLS policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: System can create notifications (we'll use service role for this)
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- 6. Create function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(invitation_id UUID)
RETURNS JSON AS $$
DECLARE
  invitation_record pending_invitations%ROWTYPE;
  share_record claim_shares%ROWTYPE;
BEGIN
  -- Get the invitation
  SELECT * INTO invitation_record
  FROM pending_invitations
  WHERE id = invitation_id AND invited_user_id = auth.uid() AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found or already processed');
  END IF;
  
  -- Check if invitation is expired
  IF invitation_record.expires_at < NOW() THEN
    UPDATE pending_invitations SET status = 'expired' WHERE id = invitation_id;
    RETURN json_build_object('success', false, 'error', 'Invitation has expired');
  END IF;
  
  -- Create the claim share
  INSERT INTO claim_shares (
    claim_id,
    owner_id,
    shared_with_id,
    permission,
    can_view_evidence,
    is_frozen,
    is_muted,
    donation_paid,
    donation_amount
  ) VALUES (
    invitation_record.claim_id,
    invitation_record.owner_id,
    invitation_record.invited_user_id,
    invitation_record.permission,
    invitation_record.can_view_evidence,
    invitation_record.is_frozen,
    invitation_record.is_muted,
    true, -- Mark as paid since invitation was accepted
    invitation_record.donation_amount
  ) RETURNING * INTO share_record;
  
  -- Update invitation status
  UPDATE pending_invitations SET status = 'accepted' WHERE id = invitation_id;
  
  -- Create notification for the owner
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    invitation_record.owner_id,
    'invitation',
    'Invitation Accepted',
    'Your invitation to join claim ' || invitation_record.claim_id || ' has been accepted.',
    json_build_object('claim_id', invitation_record.claim_id, 'invited_user_id', invitation_record.invited_user_id)
  );
  
  RETURN json_build_object('success', true, 'share_id', share_record.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to decline invitation
CREATE OR REPLACE FUNCTION decline_invitation(invitation_id UUID)
RETURNS JSON AS $$
DECLARE
  invitation_record pending_invitations%ROWTYPE;
BEGIN
  -- Get the invitation
  SELECT * INTO invitation_record
  FROM pending_invitations
  WHERE id = invitation_id AND invited_user_id = auth.uid() AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found or already processed');
  END IF;
  
  -- Update invitation status
  UPDATE pending_invitations SET status = 'declined' WHERE id = invitation_id;
  
  -- Create notification for the owner
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    invitation_record.owner_id,
    'invitation',
    'Invitation Declined',
    'Your invitation to join claim ' || invitation_record.claim_id || ' has been declined.',
    json_build_object('claim_id', invitation_record.claim_id, 'invited_user_id', invitation_record.invited_user_id)
  );
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to clean up expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE pending_invitations 
  SET status = 'expired' 
  WHERE status = 'pending' AND expires_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pending_invitations_updated_at
  BEFORE UPDATE ON pending_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON pending_invitations TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO authenticated;
