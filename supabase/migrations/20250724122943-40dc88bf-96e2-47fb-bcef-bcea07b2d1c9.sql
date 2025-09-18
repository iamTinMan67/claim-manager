-- Drop and recreate evidence policies and function to fix ambiguous user_id

-- First drop the policies that depend on the function
DROP POLICY IF EXISTS "Users can view their own evidence and shared evidence" ON public.evidence;
DROP POLICY IF EXISTS "Users can update their own evidence and shared evidence" ON public.evidence;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.has_evidence_permission(uuid, uuid, text);

-- Recreate the function with proper parameter naming
CREATE OR REPLACE FUNCTION public.has_evidence_permission(claim_id_param uuid, user_id_param uuid, permission_type text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.claims WHERE id = claim_id_param AND user_id = user_id_param) THEN true
    WHEN permission_type = 'view' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id_param AND shared_with_id = user_id_param AND can_view_evidence = true
    )
    WHEN permission_type = 'edit' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id_param AND shared_with_id = user_id_param AND can_edit_evidence = true
    )
    ELSE false
  END;
$function$;

-- Recreate the policies
CREATE POLICY "Users can view their own evidence and shared evidence" 
ON public.evidence 
FOR SELECT 
USING (
  (auth.uid() = evidence.user_id) OR 
  (EXISTS ( 
    SELECT 1
    FROM evidence_claims ec
    WHERE (ec.evidence_id = evidence.id) AND has_evidence_permission(ec.claim_id, auth.uid(), 'view'::text)
  ))
);

CREATE POLICY "Users can update their own evidence and shared evidence" 
ON public.evidence 
FOR UPDATE 
USING (
  (auth.uid() = evidence.user_id) OR 
  (EXISTS ( 
    SELECT 1
    FROM evidence_claims ec
    WHERE (ec.evidence_id = evidence.id) AND has_evidence_permission(ec.claim_id, auth.uid(), 'edit'::text)
  ))
);