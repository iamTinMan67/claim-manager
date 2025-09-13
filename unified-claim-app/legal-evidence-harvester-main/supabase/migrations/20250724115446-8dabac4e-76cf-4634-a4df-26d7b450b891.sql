-- Fix the ambiguous user_id reference in evidence queries by updating the RLS policies
-- The issue is that both evidence and evidence_claims tables have user_id fields, causing ambiguity

-- First, let's update the evidence table RLS policies to be more specific
DROP POLICY IF EXISTS "Users can view their own evidence and shared evidence" ON public.evidence;
DROP POLICY IF EXISTS "Users can update their own evidence and shared evidence" ON public.evidence;

-- Create new policies with fully qualified column names
CREATE POLICY "Users can view their own evidence and shared evidence" 
ON public.evidence 
FOR SELECT 
USING (
  (auth.uid() = evidence.user_id) OR 
  (EXISTS ( 
    SELECT 1 
    FROM evidence_claims ec 
    WHERE (ec.evidence_id = evidence.id) AND 
          has_evidence_permission(ec.claim_id, auth.uid(), 'view'::text)
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
    WHERE (ec.evidence_id = evidence.id) AND 
          has_evidence_permission(ec.claim_id, auth.uid(), 'edit'::text)
  ))
);