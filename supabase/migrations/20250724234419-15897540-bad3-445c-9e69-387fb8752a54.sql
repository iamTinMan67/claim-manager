-- Fix the user_owns_evidence function by dropping dependent policies, recreating function, then recreating policies
-- Drop policies that depend on the function
DROP POLICY IF EXISTS "Users can view their evidence-claim links" ON evidence_claims;
DROP POLICY IF EXISTS "Users can create their evidence-claim links" ON evidence_claims;
DROP POLICY IF EXISTS "Users can update their evidence-claim links" ON evidence_claims;
DROP POLICY IF EXISTS "Users can delete their evidence-claim links" ON evidence_claims;

-- Drop the function
DROP FUNCTION IF EXISTS user_owns_evidence(uuid, uuid);

-- Recreate the function with proper parameter names
CREATE OR REPLACE FUNCTION user_owns_evidence(evidence_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.evidence 
    WHERE id = evidence_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the policies using the fixed function
CREATE POLICY "Users can view their evidence-claim links" 
ON evidence_claims 
FOR SELECT 
USING (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can create their evidence-claim links" 
ON evidence_claims 
FOR INSERT 
WITH CHECK (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can update their evidence-claim links" 
ON evidence_claims 
FOR UPDATE 
USING (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can delete their evidence-claim links" 
ON evidence_claims 
FOR DELETE 
USING (user_owns_evidence(evidence_id, auth.uid()));