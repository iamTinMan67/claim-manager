-- Migrate from UUID-based claims to case reference-based claims
-- This will fix the "invalid input syntax for type uuid" errors

-- First, drop foreign key constraints that reference claims.id
ALTER TABLE claim_shares DROP CONSTRAINT IF EXISTS claim_shares_claim_id_fkey;
ALTER TABLE evidence_claims DROP CONSTRAINT IF EXISTS evidence_claims_claim_id_fkey;
ALTER TABLE pending_evidence DROP CONSTRAINT IF EXISTS pending_evidence_claim_id_fkey;
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_claim_id_fkey;

-- Update claims table to use case_number as primary key
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_pkey;
ALTER TABLE claims ADD CONSTRAINT claims_pkey PRIMARY KEY (case_number);
ALTER TABLE claims DROP COLUMN IF EXISTS id;

-- Update all related tables to use case_number (text) instead of claim_id (uuid)
ALTER TABLE claim_shares ALTER COLUMN claim_id TYPE text;
ALTER TABLE evidence_claims ALTER COLUMN claim_id TYPE text;
ALTER TABLE pending_evidence ALTER COLUMN claim_id TYPE text;
ALTER TABLE chat_messages ALTER COLUMN claim_id TYPE text;

-- Re-add foreign key constraints with case_number
ALTER TABLE claim_shares ADD CONSTRAINT claim_shares_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE evidence_claims ADD CONSTRAINT evidence_claims_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE pending_evidence ADD CONSTRAINT pending_evidence_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;

-- Update all functions to work with case_number instead of UUID
DROP FUNCTION IF EXISTS public.has_claim_access(uuid, uuid);
CREATE OR REPLACE FUNCTION public.has_claim_access(claim_case_number text, user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.claims WHERE case_number = claim_case_number AND user_id = user_id
    UNION
    SELECT 1 FROM public.claim_shares WHERE claim_id = claim_case_number AND shared_with_id = user_id
  );
$function$;

DROP FUNCTION IF EXISTS public.has_todo_permission(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.has_todo_permission(claim_case_number text, user_id uuid, permission_type text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.claims WHERE case_number = claim_case_number AND user_id = user_id) THEN true
    WHEN permission_type = 'view' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_case_number AND shared_with_id = user_id AND can_view_evidence = true
    )
    WHEN permission_type = 'edit' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_case_number AND shared_with_id = user_id AND can_edit_todos = true
    )
    ELSE false
  END;
$function$;

DROP FUNCTION IF EXISTS public.has_evidence_permission(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.has_evidence_permission(claim_case_number text, user_id_param uuid, permission_type text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.claims WHERE case_number = claim_case_number AND user_id = user_id_param) THEN true
    WHEN permission_type = 'view' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_case_number AND shared_with_id = user_id_param AND can_view_evidence = true
    )
    WHEN permission_type = 'edit' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_case_number AND shared_with_id = user_id_param AND can_view_evidence = true
    )
    ELSE false
  END;
$function$;

-- Update other functions that use claim_id parameters
DROP FUNCTION IF EXISTS public.count_free_shares(uuid);
CREATE OR REPLACE FUNCTION public.count_free_shares(claim_case_number text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM public.claim_shares 
  WHERE claim_id = claim_case_number 
  AND donation_required = false;
$function$;

DROP FUNCTION IF EXISTS public.is_donation_required_for_share(uuid);
CREATE OR REPLACE FUNCTION public.is_donation_required_for_share(claim_case_number text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) >= 2;
$function$;

DROP FUNCTION IF EXISTS public.calculate_donation_amount(uuid);
CREATE OR REPLACE FUNCTION public.calculate_donation_amount(claim_case_number text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE 
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) < 2 THEN 0
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) < 4 THEN 1000  -- £10 for 3rd and 4th
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) < 10 THEN 2500 -- £25 for 5-10
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) < 20 THEN 3000 -- £30 for 11-20
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) < 30 THEN 3500 -- £35 for 21-30
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) < 40 THEN 4000 -- £40 for 31-40
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) <= 50 THEN 4000 + (((SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) - 40) / 10) * 500 -- £5 increase per additional 10
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_case_number) <= 100 THEN 7000 -- £70 for 51-100
    ELSE 10000 -- £100 for 100+
  END;
$function$;

DROP FUNCTION IF EXISTS public.check_collaborator_limit(uuid, integer);
CREATE OR REPLACE FUNCTION public.check_collaborator_limit(claim_case_number text, new_collaborator_count integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE 
    WHEN new_collaborator_count <= 50 THEN jsonb_build_object('allowed', true, 'requires_donation', false, 'amount', 0)
    WHEN new_collaborator_count <= 100 THEN jsonb_build_object('allowed', false, 'requires_donation', true, 'amount', 7000, 'email_required', true) -- £70
    ELSE jsonb_build_object('allowed', false, 'requires_donation', true, 'amount', 10000, 'email_required', true) -- £100
  END;
$function$;

DROP FUNCTION IF EXISTS public.get_claim_owner_email(uuid);
CREATE OR REPLACE FUNCTION public.get_claim_owner_email(claim_case_number text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.email
  FROM public.claims c
  JOIN public.profiles p ON c.user_id = p.id
  WHERE c.case_number = claim_case_number;
$function$;

-- Update RLS policies to use case_number
DROP POLICY IF EXISTS "Users can view their own claims and shared claims" ON public.claims;
CREATE POLICY "Users can view their own claims and shared claims" 
ON public.claims 
FOR SELECT 
USING ((auth.uid() = user_id) OR has_claim_access(case_number, auth.uid()));

-- Update other policies that reference the old has_claim_access function
DROP POLICY IF EXISTS "Users can view chat messages for claims they have access to" ON public.chat_messages;
CREATE POLICY "Users can view chat messages for claims they have access to" 
ON public.chat_messages 
FOR SELECT 
USING (has_claim_access(claim_id, auth.uid()));

DROP POLICY IF EXISTS "Users can create chat messages for claims they have access to" ON public.chat_messages;
CREATE POLICY "Users can create chat messages for claims they have access to" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK ((auth.uid() = sender_id) AND has_claim_access(claim_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can update their own chat messages" 
ON public.chat_messages 
FOR UPDATE 
USING ((auth.uid() = sender_id) AND has_claim_access(claim_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own chat messages" 
ON public.chat_messages 
FOR DELETE 
USING ((auth.uid() = sender_id) AND has_claim_access(claim_id, auth.uid()));

-- Update evidence RLS policies
DROP POLICY IF EXISTS "Users can update their own evidence and shared evidence" ON public.evidence;
CREATE POLICY "Users can update their own evidence and shared evidence" 
ON public.evidence 
FOR UPDATE 
USING (
  (auth.uid() = evidence.user_id) OR 
  (EXISTS ( 
    SELECT 1
    FROM evidence_claims ec
    WHERE (ec.evidence_id = evidence.id) AND has_evidence_permission(ec.claim_id, auth.uid(), 'edit'::text)
  ))
);

DROP POLICY IF EXISTS "Users can view their own evidence and shared evidence" ON public.evidence;
CREATE POLICY "Users can view their own evidence and shared evidence" 
ON public.evidence 
FOR SELECT 
USING (
  (auth.uid() = evidence.user_id) OR 
  (EXISTS ( 
    SELECT 1
    FROM evidence_claims ec
    WHERE (ec.evidence_id = evidence.id) AND has_evidence_permission(ec.claim_id, auth.uid(), 'view'::text)
  ))
);