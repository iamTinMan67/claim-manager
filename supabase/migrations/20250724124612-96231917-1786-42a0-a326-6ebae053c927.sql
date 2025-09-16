-- Drop all policies that reference the old functions
DROP POLICY IF EXISTS "Users can view chat messages for claims they have access to" ON chat_messages;
DROP POLICY IF EXISTS "Users can create chat messages for claims they have access to" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create shares for their own claims" ON claim_shares;
DROP POLICY IF EXISTS "Users can update shares for their own claims" ON claim_shares;  
DROP POLICY IF EXISTS "Users can delete shares for their own claims" ON claim_shares;
DROP POLICY IF EXISTS "Users can view their own claims and shared claims" ON claims;
DROP POLICY IF EXISTS "Claim owners can view all pending evidence for their claims" ON pending_evidence;
DROP POLICY IF EXISTS "Claim owners can update pending evidence status" ON pending_evidence;
DROP POLICY IF EXISTS "Users can view their own evidence and shared evidence" ON evidence;
DROP POLICY IF EXISTS "Users can update their own evidence and shared evidence" ON evidence;

-- Drop all policies that use the old todo permission function
DROP POLICY IF EXISTS "Users can view their own todos and shared todos" ON todos;
DROP POLICY IF EXISTS "Users can create their own todos and shared todos" ON todos;
DROP POLICY IF EXISTS "Users can update their own todos and shared todos" ON todos;
DROP POLICY IF EXISTS "Users can delete their own todos and shared todos" ON todos;

-- Drop foreign key constraints
ALTER TABLE claim_shares DROP CONSTRAINT IF EXISTS claim_shares_claim_id_fkey;
ALTER TABLE evidence_claims DROP CONSTRAINT IF EXISTS evidence_claims_claim_id_fkey;
ALTER TABLE pending_evidence DROP CONSTRAINT IF EXISTS pending_evidence_claim_id_fkey;
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_claim_id_fkey;

-- Now drop all the old functions
DROP FUNCTION IF EXISTS public.has_claim_access(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_todo_permission(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.has_evidence_permission(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.count_free_shares(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_donation_required_for_share(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_donation_amount(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_collaborator_limit(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_claim_owner_email(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.approve_pending_evidence(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.reject_pending_evidence(uuid, text) CASCADE;