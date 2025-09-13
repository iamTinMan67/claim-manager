-- Fix infinite recursion in evidence RLS policies
-- The issue is ec.evidence_id = ec.id should be ec.evidence_id = evidence.id

DROP POLICY IF EXISTS "Users can view their own evidence and shared evidence" ON public.evidence;
DROP POLICY IF EXISTS "Users can update their own evidence and shared evidence" ON public.evidence;

-- Create corrected policies
CREATE POLICY "Users can view their own evidence and shared evidence" 
ON public.evidence 
FOR SELECT 
USING ((auth.uid() = user_id) OR (EXISTS ( 
  SELECT 1
  FROM evidence_claims ec
  WHERE ((ec.evidence_id = evidence.id) AND has_evidence_permission(ec.claim_id, auth.uid(), 'view'::text))
)));

CREATE POLICY "Users can update their own evidence and shared evidence" 
ON public.evidence 
FOR UPDATE 
USING ((auth.uid() = user_id) OR (EXISTS ( 
  SELECT 1
  FROM evidence_claims ec
  WHERE ((ec.evidence_id = evidence.id) AND has_evidence_permission(ec.claim_id, auth.uid(), 'edit'::text))
)));