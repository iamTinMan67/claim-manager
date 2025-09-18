-- Complete migration from UUID-based claims to case_number-based claims (FIXED)

-- Step 1: Create new claims table with case_number as primary key
CREATE TABLE public.claims_new (
  case_number text NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  court text,
  plaintiff_name text,
  defendant_name text,
  description text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Step 2: Enable RLS on new table
ALTER TABLE public.claims_new ENABLE ROW LEVEL SECURITY;

-- Step 3: Migrate data from old table to new table
INSERT INTO public.claims_new (
  case_number, user_id, title, court, plaintiff_name, 
  defendant_name, description, status, created_at, updated_at
)
SELECT 
  case_number, user_id, title, court, plaintiff_name,
  defendant_name, description, status, created_at, updated_at
FROM public.claims;

-- Step 4: Create new claim_shares table that references case_number
CREATE TABLE public.claim_shares_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id text NOT NULL REFERENCES public.claims_new(case_number) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  shared_with_id uuid NOT NULL,
  permission share_permission NOT NULL DEFAULT 'view',
  can_view_evidence boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  donation_required boolean NOT NULL DEFAULT false,
  donation_paid boolean NOT NULL DEFAULT false,
  donation_amount integer,
  donation_paid_at timestamp with time zone,
  stripe_payment_intent_id text
);

-- Step 5: Enable RLS on new claim_shares table
ALTER TABLE public.claim_shares_new ENABLE ROW LEVEL SECURITY;

-- Step 6: Migrate claim_shares data (fixing the type casting issue)
INSERT INTO public.claim_shares_new (
  id, claim_id, owner_id, shared_with_id, permission, can_view_evidence,
  created_at, updated_at, donation_required, donation_paid, 
  donation_amount, donation_paid_at, stripe_payment_intent_id
)
SELECT 
  cs.id, c.case_number, cs.owner_id, cs.shared_with_id, cs.permission, cs.can_view_evidence,
  cs.created_at, cs.updated_at, cs.donation_required, cs.donation_paid,
  cs.donation_amount, cs.donation_paid_at, cs.stripe_payment_intent_id
FROM public.claim_shares cs
JOIN public.claims c ON cs.claim_id::uuid = c.id;

-- Step 7: Create new evidence_claims table that references case_number
CREATE TABLE public.evidence_claims_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evidence_id uuid NOT NULL,
  claim_id text NOT NULL REFERENCES public.claims_new(case_number) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Step 8: Enable RLS on new evidence_claims table
ALTER TABLE public.evidence_claims_new ENABLE ROW LEVEL SECURITY;

-- Step 9: Migrate evidence_claims data
INSERT INTO public.evidence_claims_new (id, evidence_id, claim_id, created_at)
SELECT 
  ec.id, ec.evidence_id, c.case_number, ec.created_at
FROM public.evidence_claims ec
JOIN public.claims c ON ec.claim_id = c.id;

-- Step 10: Update pending_evidence table to reference case_number
ALTER TABLE public.pending_evidence 
ADD COLUMN claim_case_number text;

-- Update the claim_case_number with actual case numbers
UPDATE public.pending_evidence pe
SET claim_case_number = c.case_number
FROM public.claims c
WHERE pe.claim_id::uuid = c.id;

-- Make the new column NOT NULL after data migration
ALTER TABLE public.pending_evidence 
ALTER COLUMN claim_case_number SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.pending_evidence 
ADD CONSTRAINT pending_evidence_claim_case_number_fkey 
FOREIGN KEY (claim_case_number) REFERENCES public.claims_new(case_number) ON DELETE CASCADE;

-- Step 11: Update chat_messages table to reference case_number
ALTER TABLE public.chat_messages 
ADD COLUMN claim_case_number text;

-- Update the claim_case_number with actual case numbers
UPDATE public.chat_messages cm
SET claim_case_number = c.case_number
FROM public.claims c
WHERE cm.claim_id::uuid = c.id;

-- Make the new column NOT NULL after data migration
ALTER TABLE public.chat_messages 
ALTER COLUMN claim_case_number SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_claim_case_number_fkey 
FOREIGN KEY (claim_case_number) REFERENCES public.claims_new(case_number) ON DELETE CASCADE;

-- Step 12: Drop old tables and rename new ones
DROP TABLE public.claim_shares CASCADE;
DROP TABLE public.evidence_claims CASCADE;
DROP TABLE public.claims CASCADE;

-- Rename new tables
ALTER TABLE public.claims_new RENAME TO claims;
ALTER TABLE public.claim_shares_new RENAME TO claim_shares;
ALTER TABLE public.evidence_claims_new RENAME TO evidence_claims;

-- Step 13: Drop old UUID columns from related tables
ALTER TABLE public.pending_evidence DROP COLUMN claim_id;
ALTER TABLE public.chat_messages DROP COLUMN claim_id;

-- Rename the new columns to the original names
ALTER TABLE public.pending_evidence RENAME COLUMN claim_case_number TO claim_id;
ALTER TABLE public.chat_messages RENAME COLUMN claim_case_number TO claim_id;

-- Step 14: Create updated functions
CREATE OR REPLACE FUNCTION public.user_owns_evidence(evidence_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.evidence 
    WHERE id = user_owns_evidence.evidence_id AND user_id = user_owns_evidence.user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_claim_access(claim_case_number text, input_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.claims WHERE case_number = claim_case_number AND user_id = input_user_id
    UNION
    SELECT 1 FROM public.claim_shares WHERE claim_id = claim_case_number AND shared_with_id = input_user_id
  );
$function$;

-- Step 15: Create RLS policies for claims table
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

-- Step 16: Create RLS policies for claim_shares table
CREATE POLICY "Users can view shares where they are owner or shared_with" 
ON public.claim_shares 
FOR SELECT 
USING ((auth.uid() = owner_id) OR (auth.uid() = shared_with_id));

CREATE POLICY "Users can create shares for their own claims" 
ON public.claim_shares 
FOR INSERT 
WITH CHECK (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can update shares for their own claims" 
ON public.claim_shares 
FOR UPDATE 
USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can delete shares for their own claims" 
ON public.claim_shares 
FOR DELETE 
USING (has_claim_access(claim_id, auth.uid()));

-- Step 17: Create RLS policies for evidence_claims table
CREATE POLICY "Users can view their evidence-claim links" 
ON public.evidence_claims 
FOR SELECT 
USING (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can create their evidence-claim links" 
ON public.evidence_claims 
FOR INSERT 
WITH CHECK (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can update their evidence-claim links" 
ON public.evidence_claims 
FOR UPDATE 
USING (user_owns_evidence(evidence_id, auth.uid()));

CREATE POLICY "Users can delete their evidence-claim links" 
ON public.evidence_claims 
FOR DELETE 
USING (user_owns_evidence(evidence_id, auth.uid()));

-- Step 18: Update RLS policies for pending_evidence table
DROP POLICY IF EXISTS "Shared users can submit pending evidence" ON public.pending_evidence;
DROP POLICY IF EXISTS "Submitters can view their own pending evidence" ON public.pending_evidence;
DROP POLICY IF EXISTS "Claim owners can view pending evidence" ON public.pending_evidence;

CREATE POLICY "Shared users can submit pending evidence" 
ON public.pending_evidence 
FOR INSERT 
WITH CHECK ((auth.uid() = submitter_id) AND (EXISTS ( 
  SELECT 1 FROM claim_shares 
  WHERE claim_shares.claim_id = pending_evidence.claim_id 
  AND claim_shares.shared_with_id = auth.uid() 
  AND claim_shares.can_view_evidence = true
)));

CREATE POLICY "Submitters can view their own pending evidence" 
ON public.pending_evidence 
FOR SELECT 
USING (auth.uid() = submitter_id);

CREATE POLICY "Claim owners can view pending evidence" 
ON public.pending_evidence 
FOR SELECT 
USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Claim owners can update pending evidence" 
ON public.pending_evidence 
FOR UPDATE 
USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Claim owners can delete pending evidence" 
ON public.pending_evidence 
FOR DELETE 
USING (has_claim_access(claim_id, auth.uid()));

-- Step 19: Update RLS policies for chat_messages table
DROP POLICY IF EXISTS "Users can view messages for accessible claims" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create messages for accessible claims" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.chat_messages;

CREATE POLICY "Users can view messages for accessible claims" 
ON public.chat_messages 
FOR SELECT 
USING (has_claim_access(claim_id, auth.uid()));

CREATE POLICY "Users can create messages for accessible claims" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (has_claim_access(claim_id, auth.uid()) AND auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" 
ON public.chat_messages 
FOR DELETE 
USING (auth.uid() = sender_id);

-- Step 20: Create triggers for updated_at columns
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_claim_shares_updated_at
  BEFORE UPDATE ON public.claim_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();