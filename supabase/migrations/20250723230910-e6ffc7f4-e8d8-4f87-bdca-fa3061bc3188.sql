-- Create enum for sharing permissions
CREATE TYPE public.share_permission AS ENUM ('view', 'edit');

-- Create table for sharing claims between users
CREATE TABLE public.claim_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL, -- The user who owns the claim
  shared_with_id UUID NOT NULL, -- The user who has access
  permission public.share_permission NOT NULL DEFAULT 'view',
  can_view_evidence BOOLEAN NOT NULL DEFAULT false,
  can_edit_evidence BOOLEAN NOT NULL DEFAULT false,
  can_view_todos BOOLEAN NOT NULL DEFAULT false,
  can_edit_todos BOOLEAN NOT NULL DEFAULT false,
  can_view_notes BOOLEAN NOT NULL DEFAULT false,
  can_edit_notes BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(claim_id, shared_with_id)
);

-- Enable RLS on claim_shares
ALTER TABLE public.claim_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for claim_shares
CREATE POLICY "Users can view shares where they are owner or shared_with" 
ON public.claim_shares 
FOR SELECT 
USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);

CREATE POLICY "Users can create shares for their own claims" 
ON public.claim_shares 
FOR INSERT 
WITH CHECK (
  auth.uid() = owner_id AND 
  EXISTS (SELECT 1 FROM public.claims WHERE id = claim_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update shares for their own claims" 
ON public.claim_shares 
FOR UPDATE 
USING (
  auth.uid() = owner_id AND 
  EXISTS (SELECT 1 FROM public.claims WHERE id = claim_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete shares for their own claims" 
ON public.claim_shares 
FOR DELETE 
USING (
  auth.uid() = owner_id AND 
  EXISTS (SELECT 1 FROM public.claims WHERE id = claim_id AND user_id = auth.uid())
);

-- Create function to check if user has access to a claim
CREATE OR REPLACE FUNCTION public.has_claim_access(claim_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.claims WHERE id = claim_id AND user_id = user_id
    UNION
    SELECT 1 FROM public.claim_shares WHERE claim_id = claim_id AND shared_with_id = user_id
  );
$$;

-- Create function to check specific permissions
CREATE OR REPLACE FUNCTION public.has_evidence_permission(claim_id UUID, user_id UUID, permission_type TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.claims WHERE id = claim_id AND user_id = user_id) THEN true
    WHEN permission_type = 'view' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id AND shared_with_id = user_id AND can_view_evidence = true
    )
    WHEN permission_type = 'edit' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id AND shared_with_id = user_id AND can_edit_evidence = true
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_todo_permission(claim_id UUID, user_id UUID, permission_type TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.claims WHERE id = claim_id AND user_id = user_id) THEN true
    WHEN permission_type = 'view' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id AND shared_with_id = user_id AND can_view_todos = true
    )
    WHEN permission_type = 'edit' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id AND shared_with_id = user_id AND can_edit_todos = true
    )
    ELSE false
  END;
$$;

-- Update trigger for claim_shares
CREATE TRIGGER update_claim_shares_updated_at
BEFORE UPDATE ON public.claim_shares
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update claims RLS policies to include shared access
DROP POLICY IF EXISTS "Users can view their own claims" ON public.claims;
CREATE POLICY "Users can view their own claims and shared claims" 
ON public.claims 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  public.has_claim_access(id, auth.uid())
);

-- Update evidence RLS policies to include shared access
DROP POLICY IF EXISTS "Users can view their own evidence" ON public.evidence;
CREATE POLICY "Users can view their own evidence and shared evidence" 
ON public.evidence 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.evidence_claims ec
    WHERE ec.evidence_id = id AND public.has_evidence_permission(ec.claim_id, auth.uid(), 'view')
  )
);

DROP POLICY IF EXISTS "Users can update their own evidence" ON public.evidence;
CREATE POLICY "Users can update their own evidence and shared evidence" 
ON public.evidence 
FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.evidence_claims ec
    WHERE ec.evidence_id = id AND public.has_evidence_permission(ec.claim_id, auth.uid(), 'edit')
  )
);

-- Update todos RLS policies to include shared access
DROP POLICY IF EXISTS "Users can view their own todos" ON public.todos;
CREATE POLICY "Users can view their own todos and shared todos" 
ON public.todos 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  (evidence_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.evidence_claims ec
    JOIN public.evidence e ON e.id = ec.evidence_id
    WHERE e.id = evidence_id AND public.has_todo_permission(ec.claim_id, auth.uid(), 'view')
  ))
);

DROP POLICY IF EXISTS "Users can update their own todos" ON public.todos;
CREATE POLICY "Users can update their own todos and shared todos" 
ON public.todos 
FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  (evidence_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.evidence_claims ec
    JOIN public.evidence e ON e.id = ec.evidence_id
    WHERE e.id = evidence_id AND public.has_todo_permission(ec.claim_id, auth.uid(), 'edit')
  ))
);

DROP POLICY IF EXISTS "Users can create their own todos" ON public.todos;
CREATE POLICY "Users can create their own todos and shared todos" 
ON public.todos 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR 
  (evidence_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.evidence_claims ec
    JOIN public.evidence e ON e.id = ec.evidence_id
    WHERE e.id = evidence_id AND public.has_todo_permission(ec.claim_id, auth.uid(), 'edit')
  ))
);

DROP POLICY IF EXISTS "Users can delete their own todos" ON public.todos;
CREATE POLICY "Users can delete their own todos and shared todos" 
ON public.todos 
FOR DELETE 
USING (
  auth.uid() = user_id OR 
  (evidence_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.evidence_claims ec
    JOIN public.evidence e ON e.id = ec.evidence_id
    WHERE e.id = evidence_id AND public.has_todo_permission(ec.claim_id, auth.uid(), 'edit')
  ))
);