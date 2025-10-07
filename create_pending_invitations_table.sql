-- Create pending_invitations table if it doesn't exist
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
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pending_invitations' 
    AND policyname = 'view_own_pending_invites'
  ) THEN
    CREATE POLICY "view_own_pending_invites" ON public.pending_invitations
    FOR SELECT USING (invited_user_id = auth.uid() OR owner_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pending_invitations' 
    AND policyname = 'create_invites_as_owner'
  ) THEN
    CREATE POLICY "create_invites_as_owner" ON public.pending_invitations
    FOR INSERT WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pending_invitations' 
    AND policyname = 'update_own_invites'
  ) THEN
    CREATE POLICY "update_own_invites" ON public.pending_invitations
    FOR UPDATE USING (invited_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pending_invitations' 
    AND policyname = 'delete_own_sent_invites'
  ) THEN
    CREATE POLICY "delete_own_sent_invites" ON public.pending_invitations
    FOR DELETE USING (owner_id = auth.uid());
  END IF;
END $$;
