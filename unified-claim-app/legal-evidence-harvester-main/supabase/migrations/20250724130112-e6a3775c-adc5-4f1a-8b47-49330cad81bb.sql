-- The column types didn't change earlier. Let's change them now that we've cleared the data
ALTER TABLE claim_shares ALTER COLUMN claim_id TYPE text USING claim_id::text;
ALTER TABLE evidence_claims ALTER COLUMN claim_id TYPE text USING claim_id::text;
ALTER TABLE pending_evidence ALTER COLUMN claim_id TYPE text USING claim_id::text;
ALTER TABLE chat_messages ALTER COLUMN claim_id TYPE text USING claim_id::text;

-- Now add the foreign key constraints
ALTER TABLE claim_shares ADD CONSTRAINT claim_shares_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE evidence_claims ADD CONSTRAINT evidence_claims_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE pending_evidence ADD CONSTRAINT pending_evidence_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;