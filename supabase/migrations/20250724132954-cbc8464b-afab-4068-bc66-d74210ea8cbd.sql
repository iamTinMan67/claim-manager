-- Complete the migration by adding the missing policies
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

-- Chat message policies  
CREATE POLICY "Users can view chat messages for claims they have access to" 
ON public.chat_messages 
FOR SELECT 
USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can create chat messages for claims they have access to" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK ((auth.uid() = sender_id) AND has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can update their own chat messages" 
ON public.chat_messages 
FOR UPDATE 
USING ((auth.uid() = sender_id) AND has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can delete their own chat messages" 
ON public.chat_messages 
FOR DELETE 
USING ((auth.uid() = sender_id) AND has_claim_access(claim_id, auth.uid()));

-- Pending evidence policies
CREATE POLICY "Claim owners can view all pending evidence for their claims" 
ON public.pending_evidence 
FOR SELECT 
USING (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = pending_evidence.claim_id AND user_id = auth.uid()
));

CREATE POLICY "Claim owners can update pending evidence status" 
ON public.pending_evidence 
FOR UPDATE 
USING (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = pending_evidence.claim_id AND user_id = auth.uid()
));

CREATE POLICY "Submitters can view their own pending evidence" 
ON public.pending_evidence 
FOR SELECT 
USING (auth.uid() = submitter_id);

CREATE POLICY "Shared users can submit pending evidence" 
ON public.pending_evidence 
FOR INSERT 
WITH CHECK ((auth.uid() = submitter_id) AND (EXISTS ( 
  SELECT 1 FROM claim_shares 
  WHERE claim_id = pending_evidence.claim_id AND shared_with_id = auth.uid() AND can_view_evidence = true
)));