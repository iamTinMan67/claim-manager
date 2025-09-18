-- Drop the remaining pending evidence policies
DROP POLICY IF EXISTS "Shared users can submit pending evidence" ON pending_evidence;

-- Now update the column type
ALTER TABLE claim_shares ALTER COLUMN claim_id TYPE text;
ALTER TABLE evidence_claims ALTER COLUMN claim_id TYPE text;
ALTER TABLE pending_evidence ALTER COLUMN claim_id TYPE text;
ALTER TABLE chat_messages ALTER COLUMN claim_id TYPE text;

-- Now drop the claims id column and make case_number primary key
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_pkey;
ALTER TABLE claims DROP COLUMN IF EXISTS id;
ALTER TABLE claims ADD CONSTRAINT claims_pkey PRIMARY KEY (case_number);

-- Create the functions
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
      WHERE claim_id = claim_case_number AND shared_with_id = user_id AND can_view_evidence = true
    )
    ELSE false
  END;
$function$;

-- Recreate the remaining pending evidence policy
CREATE POLICY "Shared users can submit pending evidence" 
ON public.pending_evidence 
FOR INSERT 
WITH CHECK ((auth.uid() = submitter_id) AND (EXISTS ( 
  SELECT 1 FROM claim_shares 
  WHERE claim_id = pending_evidence.claim_id AND shared_with_id = auth.uid() AND can_view_evidence = true
)));

-- Re-add foreign key constraints with case_number
ALTER TABLE claim_shares ADD CONSTRAINT claim_shares_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE evidence_claims ADD CONSTRAINT evidence_claims_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE pending_evidence ADD CONSTRAINT pending_evidence_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;