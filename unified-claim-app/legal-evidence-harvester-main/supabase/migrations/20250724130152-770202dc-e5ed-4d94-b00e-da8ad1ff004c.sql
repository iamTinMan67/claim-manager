-- Drop the last remaining policy
DROP POLICY IF EXISTS "Shared users can submit pending evidence" ON pending_evidence;

-- Now change the column types
ALTER TABLE claim_shares ALTER COLUMN claim_id TYPE text USING claim_id::text;
ALTER TABLE evidence_claims ALTER COLUMN claim_id TYPE text USING claim_id::text;
ALTER TABLE pending_evidence ALTER COLUMN claim_id TYPE text USING claim_id::text;
ALTER TABLE chat_messages ALTER COLUMN claim_id TYPE text USING claim_id::text;

-- Recreate the policy
CREATE POLICY "Shared users can submit pending evidence" 
ON public.pending_evidence 
FOR INSERT 
WITH CHECK ((auth.uid() = submitter_id) AND (EXISTS ( 
  SELECT 1 FROM claim_shares 
  WHERE claim_id = pending_evidence.claim_id AND shared_with_id = auth.uid() AND can_view_evidence = true
)));

-- Now add the foreign key constraints
ALTER TABLE claim_shares ADD CONSTRAINT claim_shares_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE evidence_claims ADD CONSTRAINT evidence_claims_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE pending_evidence ADD CONSTRAINT pending_evidence_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;