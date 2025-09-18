-- Fix ambiguous user_id reference in evidence RLS policies
-- The issue is likely in the SELECT policy that references both evidence.user_id and claims.user_id

-- Drop and recreate the evidence SELECT policy to fix ambiguous reference
DROP POLICY IF EXISTS "Users can view their own evidence and shared evidence" ON public.evidence;

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

-- Also fix the UPDATE policy to be explicit about table references
DROP POLICY IF EXISTS "Users can update their own evidence and shared evidence" ON public.evidence;

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