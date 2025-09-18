-- Fix the infinite recursion in evidence_claims policies
-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view their evidence-claim links" ON evidence_claims;
DROP POLICY IF EXISTS "Users can view their own evidence claims" ON evidence_claims;

-- Create a security definer function to check evidence ownership
CREATE OR REPLACE FUNCTION public.user_owns_evidence(evidence_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM evidence 
    WHERE id = evidence_id AND evidence.user_id = user_owns_evidence.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate the policies using the security definer function
CREATE POLICY "Users can view their evidence-claim links" 
ON evidence_claims 
FOR SELECT 
USING (user_owns_evidence(evidence_id, auth.uid()));

-- Remove duplicate policies and consolidate
DROP POLICY IF EXISTS "Users can create their evidence-claim links" ON evidence_claims;
DROP POLICY IF EXISTS "Users can create their own evidence claims" ON evidence_claims;
DROP POLICY IF EXISTS "Users can delete their evidence-claim links" ON evidence_claims;
DROP POLICY IF EXISTS "Users can delete their own evidence claims" ON evidence_claims;
DROP POLICY IF EXISTS "Users can update their own evidence claims" ON evidence_claims;

CREATE POLICY "Users can create their evidence-claim links" 
ON evidence_claims 
FOR INSERT 
WITH CHECK (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can delete their evidence-claim links" 
ON evidence_claims 
FOR DELETE 
USING (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can update their evidence-claim links" 
ON evidence_claims 
FOR UPDATE 
USING (user_owns_evidence(evidence_id, auth.uid()));