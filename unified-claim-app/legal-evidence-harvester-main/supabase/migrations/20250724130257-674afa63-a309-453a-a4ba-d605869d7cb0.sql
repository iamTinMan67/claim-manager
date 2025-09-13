-- Make sure claims table has case_number as primary key
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_pkey;
ALTER TABLE claims ADD CONSTRAINT claims_pkey PRIMARY KEY (case_number);

-- Now add the foreign key constraints
ALTER TABLE claim_shares ADD CONSTRAINT claim_shares_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE evidence_claims ADD CONSTRAINT evidence_claims_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE pending_evidence ADD CONSTRAINT pending_evidence_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;