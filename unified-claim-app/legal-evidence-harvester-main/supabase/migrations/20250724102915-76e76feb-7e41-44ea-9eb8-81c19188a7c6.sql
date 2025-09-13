-- Fix the migration by handling dependencies properly

-- Phase 1: Drop existing policies that depend on id column
DROP POLICY IF EXISTS "Users can view their own claims and shared claims" ON claims;
DROP POLICY IF EXISTS "Users can create their own claims" ON claims;
DROP POLICY IF EXISTS "Users can update their own claims" ON claims;
DROP POLICY IF EXISTS "Users can delete their own claims" ON claims;

-- Phase 2: Prepare case_number to be primary identifier
-- First, ensure all existing claims have unique case_numbers
UPDATE claims 
SET case_number = CONCAT('CASE-', EXTRACT(EPOCH FROM created_at)::bigint, '-', SUBSTRING(id::text, 1, 8))
WHERE case_number IS NULL OR case_number = '' OR LENGTH(case_number) < 5;

-- Make case_number unique and not null
ALTER TABLE claims ALTER COLUMN case_number SET NOT NULL;
ALTER TABLE claims ADD CONSTRAINT claims_case_number_unique UNIQUE (case_number);

-- Phase 3: Create new tables with case_number as foreign key
-- Create new evidence_claims table
CREATE TABLE evidence_claims_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evidence_id uuid NOT NULL,
  case_number text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create new claim_shares table  
CREATE TABLE claim_shares_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number text NOT NULL,
  owner_id uuid NOT NULL,
  shared_with_id uuid NOT NULL,
  permission share_permission NOT NULL DEFAULT 'view'::share_permission,
  can_view_evidence boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  donation_required boolean NOT NULL DEFAULT false,
  donation_paid boolean NOT NULL DEFAULT false,
  donation_amount integer,
  donation_paid_at timestamp with time zone,
  stripe_payment_intent_id text
);

-- Create new pending_evidence table
CREATE TABLE pending_evidence_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number text NOT NULL,
  submitter_id uuid NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  number_of_pages integer,
  date_submitted date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  file_name text,
  file_url text,
  exhibit_id text,
  method text,
  url_link text,
  book_of_deeds_ref text,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewer_notes text,
  description text NOT NULL
);

-- Create new chat_messages table
CREATE TABLE chat_messages_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number text NOT NULL,
  sender_id uuid NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'text'::text
);

-- Phase 4: Migrate data from old tables to new tables
INSERT INTO evidence_claims_new (id, evidence_id, case_number, created_at)
SELECT ec.id, ec.evidence_id, c.case_number, ec.created_at
FROM evidence_claims ec
JOIN claims c ON ec.claim_id = c.id;

INSERT INTO claim_shares_new (
  id, case_number, owner_id, shared_with_id, permission, can_view_evidence,
  created_at, updated_at, donation_required, donation_paid, donation_amount,
  donation_paid_at, stripe_payment_intent_id
)
SELECT 
  cs.id, c.case_number, cs.owner_id, cs.shared_with_id, cs.permission, cs.can_view_evidence,
  cs.created_at, cs.updated_at, cs.donation_required, cs.donation_paid, cs.donation_amount,
  cs.donation_paid_at, cs.stripe_payment_intent_id
FROM claim_shares cs
JOIN claims c ON cs.claim_id = c.id;

INSERT INTO pending_evidence_new (
  id, case_number, submitter_id, submitted_at, reviewed_at, number_of_pages,
  date_submitted, created_at, updated_at, file_name, file_url, exhibit_id,
  method, url_link, book_of_deeds_ref, status, reviewer_notes, description
)
SELECT 
  pe.id, c.case_number, pe.submitter_id, pe.submitted_at, pe.reviewed_at, pe.number_of_pages,
  pe.date_submitted, pe.created_at, pe.updated_at, pe.file_name, pe.file_url, pe.exhibit_id,
  pe.method, pe.url_link, pe.book_of_deeds_ref, pe.status, pe.reviewer_notes, pe.description
FROM pending_evidence pe
JOIN claims c ON pe.claim_id = c.id;

INSERT INTO chat_messages_new (
  id, case_number, sender_id, metadata, created_at, updated_at, message, message_type
)
SELECT 
  cm.id, c.case_number, cm.sender_id, cm.metadata, cm.created_at, cm.updated_at, cm.message, cm.message_type
FROM chat_messages cm
JOIN claims c ON cm.claim_id = c.id;

-- Phase 5: Drop old tables and rename new ones
DROP TABLE evidence_claims CASCADE;
DROP TABLE claim_shares CASCADE;
DROP TABLE pending_evidence CASCADE;
DROP TABLE chat_messages CASCADE;

ALTER TABLE evidence_claims_new RENAME TO evidence_claims;
ALTER TABLE claim_shares_new RENAME TO claim_shares;
ALTER TABLE pending_evidence_new RENAME TO pending_evidence;
ALTER TABLE chat_messages_new RENAME TO chat_messages;

-- Phase 6: Update claims table to use case_number as primary key
-- Remove the old primary key and create new one
ALTER TABLE claims DROP CONSTRAINT claims_pkey;
ALTER TABLE claims DROP COLUMN id;
ALTER TABLE claims ADD PRIMARY KEY (case_number);

-- Phase 7: Create updated database functions that work with case_number
CREATE OR REPLACE FUNCTION public.has_claim_access_by_case(case_num text, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.claims WHERE case_number = case_num AND user_id = user_id
    UNION
    SELECT 1 FROM public.claim_shares WHERE case_number = case_num AND shared_with_id = user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_evidence_permission_by_case(case_num text, user_id uuid, permission_type text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.claims WHERE case_number = case_num AND user_id = user_id) THEN true
    WHEN permission_type = 'view' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE case_number = case_num AND shared_with_id = user_id AND can_view_evidence = true
    )
    WHEN permission_type = 'edit' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE case_number = case_num AND shared_with_id = user_id AND can_edit_evidence = true
    )
    ELSE false
  END;
$function$;

-- Phase 8: Enable RLS and create policies for all tables
ALTER TABLE evidence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Claims policies (updated to use case_number)
CREATE POLICY "Users can view their own claims and shared claims" ON claims
FOR SELECT USING (
  (auth.uid() = user_id) OR has_claim_access_by_case(case_number, auth.uid())
);

CREATE POLICY "Users can create their own claims" ON claims
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own claims" ON claims
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own claims" ON claims
FOR DELETE USING (auth.uid() = user_id);

-- Evidence Claims policies
CREATE POLICY "Users can view their evidence-claim links" ON evidence_claims
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM evidence e 
    WHERE e.id = evidence_claims.evidence_id AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their evidence-claim links" ON evidence_claims
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM evidence e 
    WHERE e.id = evidence_claims.evidence_id AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their evidence-claim links" ON evidence_claims
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM evidence e 
    WHERE e.id = evidence_claims.evidence_id AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their evidence-claim links" ON evidence_claims
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM evidence e 
    WHERE e.id = evidence_claims.evidence_id AND e.user_id = auth.uid()
  )
);

-- Claim Shares policies
CREATE POLICY "Users can view shares where they are owner or shared_with" ON claim_shares
FOR SELECT USING (
  (auth.uid() = owner_id) OR (auth.uid() = shared_with_id)
);

CREATE POLICY "Users can create shares for their own claims" ON claim_shares
FOR INSERT WITH CHECK (
  (auth.uid() = owner_id) AND 
  (EXISTS (
    SELECT 1 FROM claims 
    WHERE claims.case_number = claim_shares.case_number AND claims.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can update shares for their own claims" ON claim_shares
FOR UPDATE USING (
  (auth.uid() = owner_id) AND 
  (EXISTS (
    SELECT 1 FROM claims 
    WHERE claims.case_number = claim_shares.case_number AND claims.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can delete shares for their own claims" ON claim_shares
FOR DELETE USING (
  (auth.uid() = owner_id) AND 
  (EXISTS (
    SELECT 1 FROM claims 
    WHERE claims.case_number = claim_shares.case_number AND claims.user_id = auth.uid()
  ))
);

-- Pending Evidence policies
CREATE POLICY "Claim owners can view all pending evidence for their claims" ON pending_evidence
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM claims 
    WHERE claims.case_number = pending_evidence.case_number AND claims.user_id = auth.uid()
  )
);

CREATE POLICY "Submitters can view their own pending evidence" ON pending_evidence
FOR SELECT USING (auth.uid() = submitter_id);

CREATE POLICY "Shared users can submit pending evidence" ON pending_evidence
FOR INSERT WITH CHECK (
  (auth.uid() = submitter_id) AND 
  (EXISTS (
    SELECT 1 FROM claim_shares 
    WHERE claim_shares.case_number = pending_evidence.case_number 
    AND claim_shares.shared_with_id = auth.uid() 
    AND claim_shares.can_view_evidence = true
  ))
);

CREATE POLICY "Claim owners can update pending evidence status" ON pending_evidence
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM claims 
    WHERE claims.case_number = pending_evidence.case_number AND claims.user_id = auth.uid()
  )
);

-- Chat Messages policies
CREATE POLICY "Users can view chat messages for claims they have access to" ON chat_messages
FOR SELECT USING (has_claim_access_by_case(case_number, auth.uid()));

CREATE POLICY "Users can create chat messages for claims they have access to" ON chat_messages
FOR INSERT WITH CHECK (
  (auth.uid() = sender_id) AND has_claim_access_by_case(case_number, auth.uid())
);

CREATE POLICY "Users can update their own chat messages" ON chat_messages
FOR UPDATE USING (
  (auth.uid() = sender_id) AND has_claim_access_by_case(case_number, auth.uid())
);

CREATE POLICY "Users can delete their own chat messages" ON chat_messages
FOR DELETE USING (
  (auth.uid() = sender_id) AND has_claim_access_by_case(case_number, auth.uid())
);

-- Update evidence policies to work with new case_number structure
DROP POLICY IF EXISTS "Users can view their own evidence and shared evidence" ON evidence;
DROP POLICY IF EXISTS "Users can update their own evidence and shared evidence" ON evidence;

CREATE POLICY "Users can view their own evidence and shared evidence" ON evidence
FOR SELECT USING (
  (auth.uid() = user_id) OR 
  (EXISTS (
    SELECT 1 FROM evidence_claims ec 
    WHERE ec.evidence_id = evidence.id AND has_evidence_permission_by_case(ec.case_number, auth.uid(), 'view')
  ))
);

CREATE POLICY "Users can update their own evidence and shared evidence" ON evidence
FOR UPDATE USING (
  (auth.uid() = user_id) OR 
  (EXISTS (
    SELECT 1 FROM evidence_claims ec 
    WHERE ec.evidence_id = evidence.id AND has_evidence_permission_by_case(ec.case_number, auth.uid(), 'edit')
  ))
);