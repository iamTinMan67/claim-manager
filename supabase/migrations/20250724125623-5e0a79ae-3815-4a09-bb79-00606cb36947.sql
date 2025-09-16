-- Remove invalid foreign key references that don't match existing case numbers
DELETE FROM evidence_claims WHERE claim_id NOT IN (SELECT case_number FROM claims);
DELETE FROM claim_shares WHERE claim_id NOT IN (SELECT case_number FROM claims);
DELETE FROM pending_evidence WHERE claim_id NOT IN (SELECT case_number FROM claims);
DELETE FROM chat_messages WHERE claim_id NOT IN (SELECT case_number FROM claims);

-- Now re-add foreign key constraints with case_number
ALTER TABLE claim_shares ADD CONSTRAINT claim_shares_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE evidence_claims ADD CONSTRAINT evidence_claims_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE pending_evidence ADD CONSTRAINT pending_evidence_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;