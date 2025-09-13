-- Fix security warnings by setting search_path for functions
CREATE OR REPLACE FUNCTION public.has_claim_access(claim_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.claims WHERE id = claim_id AND user_id = user_id
    UNION
    SELECT 1 FROM public.claim_shares WHERE claim_id = claim_id AND shared_with_id = user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_evidence_permission(claim_id UUID, user_id UUID, permission_type TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
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