-- Upgrade account to frontend tier for testing
INSERT INTO public.subscribers (user_id, subscription_tier, subscribed)
VALUES ('29191813-91d1-454b-b6f1-6782a7237b89', 'frontend', true)
ON CONFLICT (user_id) 
DO UPDATE SET 
  subscription_tier = 'frontend',
  subscribed = true,
  updated_at = now();

-- Also create the pending_invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES public.claims(claim_id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  permission text NOT NULL DEFAULT 'edit',
  can_view_evidence boolean NOT NULL DEFAULT true,
  is_frozen boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  donation_amount numeric(10,2) DEFAULT 0,
  donation_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (claim_id, invited_user_id)
);

-- Enable RLS
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY IF NOT EXISTS "view_own_pending_invites" ON public.pending_invitations
FOR SELECT USING (invited_user_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS "create_invites_as_owner" ON public.pending_invitations
FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS "update_own_invites" ON public.pending_invitations
FOR UPDATE USING (invited_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "delete_own_sent_invites" ON public.pending_invitations
FOR DELETE USING (owner_id = auth.uid());
