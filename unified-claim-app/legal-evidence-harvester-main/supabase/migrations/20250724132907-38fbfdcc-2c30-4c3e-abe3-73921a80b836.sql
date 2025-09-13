-- Just add the primary key constraint to claims table since the id column was dropped
ALTER TABLE claims ADD CONSTRAINT claims_pkey PRIMARY KEY (case_number);

-- Add the missing policies back to complete the migration
CREATE POLICY "Users can view their own claims and shared claims" 
ON public.claims 
FOR SELECT 
USING ((auth.uid() = user_id) OR has_claim_access(case_number, auth.uid()));

CREATE POLICY "Users can create their own claims" 
ON public.claims 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own claims" 
ON public.claims 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own claims" 
ON public.claims 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add policies for the recreated tables if they don't exist
CREATE POLICY "Users can view shares where they are owner or shared_with" 
ON public.claim_shares 
FOR SELECT 
USING ((auth.uid() = owner_id) OR (auth.uid() = shared_with_id));

CREATE POLICY "Users can create shares for their own claims" 
ON public.claim_shares 
FOR INSERT 
WITH CHECK ((auth.uid() = owner_id) AND (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = claim_shares.claim_id AND user_id = auth.uid()
)));

CREATE POLICY "Users can update shares for their own claims" 
ON public.claim_shares 
FOR UPDATE 
USING ((auth.uid() = owner_id) AND (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = claim_shares.claim_id AND user_id = auth.uid()
)));

CREATE POLICY "Users can delete shares for their own claims" 
ON public.claim_shares 
FOR DELETE 
USING ((auth.uid() = owner_id) AND (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = claim_shares.claim_id AND user_id = auth.uid()
)));

-- Evidence claim policies
CREATE POLICY "Users can view their evidence-claim links" 
ON public.evidence_claims 
FOR SELECT 
USING (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can create their evidence-claim links" 
ON public.evidence_claims 
FOR INSERT 
WITH CHECK (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can delete their evidence-claim links" 
ON public.evidence_claims 
FOR DELETE 
USING (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can update their evidence-claim links" 
ON public.evidence_claims 
FOR UPDATE 
USING (user_owns_evidence(evidence_id, auth.uid()));