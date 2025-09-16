-- Now complete the migration to use case_number as primary key
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_pkey;
ALTER TABLE claims DROP COLUMN IF EXISTS id;
ALTER TABLE claims ADD CONSTRAINT claims_pkey PRIMARY KEY (case_number);

-- Update all related tables to use text instead of uuid for claim references
ALTER TABLE claim_shares ALTER COLUMN claim_id TYPE text;
ALTER TABLE evidence_claims ALTER COLUMN claim_id TYPE text;
ALTER TABLE pending_evidence ALTER COLUMN claim_id TYPE text;
ALTER TABLE chat_messages ALTER COLUMN claim_id TYPE text;

-- Create new functions that work with case_number (text)
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

-- Recreate all RLS policies for claims
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

-- Recreate claim_shares policies
CREATE POLICY "Users can view shares where they are owner or shared_with" 
ON public.claim_shares 
FOR SELECT 
USING ((auth.uid() = owner_id) OR (auth.uid() = shared_with_id));

CREATE POLICY "Users can create shares for their own claims" 
ON public.claim_shares 
FOR INSERT 
WITH CHECK ((auth.uid() = owner_id) AND (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = claim_shares.claim_id AND user_id = auth.uid()
)));

CREATE POLICY "Users can update shares for their own claims" 
ON public.claim_shares 
FOR UPDATE 
USING ((auth.uid() = owner_id) AND (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = claim_shares.claim_id AND user_id = auth.uid()
)));

CREATE POLICY "Users can delete shares for their own claims" 
ON public.claim_shares 
FOR DELETE 
USING ((auth.uid() = owner_id) AND (EXISTS ( 
  SELECT 1 FROM claims WHERE case_number = claim_shares.claim_id AND user_id = auth.uid()
)));

-- Recreate evidence policies
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

-- Recreate chat message policies
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

-- Recreate pending evidence policies
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

-- Recreate todos policies
CREATE POLICY "Users can view their own todos and shared todos" 
ON public.todos 
FOR SELECT 
USING ((auth.uid() = user_id) OR ((evidence_id IS NOT NULL) AND (EXISTS ( 
  SELECT 1
  FROM (evidence_claims ec JOIN evidence e ON ((e.id = ec.evidence_id)))
  WHERE ((e.id = ec.evidence_id) AND has_todo_permission(ec.claim_id, auth.uid(), 'view'::text))
))));

CREATE POLICY "Users can create their own todos and shared todos" 
ON public.todos 
FOR INSERT 
WITH CHECK ((auth.uid() = user_id) OR ((evidence_id IS NOT NULL) AND (EXISTS ( 
  SELECT 1
  FROM (evidence_claims ec JOIN evidence e ON ((e.id = ec.evidence_id)))
  WHERE ((e.id = ec.evidence_id) AND has_todo_permission(ec.claim_id, auth.uid(), 'edit'::text))
))));

CREATE POLICY "Users can update their own todos and shared todos" 
ON public.todos 
FOR UPDATE 
USING ((auth.uid() = user_id) OR ((evidence_id IS NOT NULL) AND (EXISTS ( 
  SELECT 1
  FROM (evidence_claims ec JOIN evidence e ON ((e.id = ec.evidence_id)))
  WHERE ((e.id = ec.evidence_id) AND has_todo_permission(ec.claim_id, auth.uid(), 'edit'::text))
))));

CREATE POLICY "Users can delete their own todos and shared todos" 
ON public.todos 
FOR DELETE 
USING ((auth.uid() = user_id) OR ((evidence_id IS NOT NULL) AND (EXISTS ( 
  SELECT 1
  FROM (evidence_claims ec JOIN evidence e ON ((e.id = ec.evidence_id)))
  WHERE ((e.id = ec.evidence_id) AND has_todo_permission(ec.claim_id, auth.uid(), 'edit'::text))
))));

-- Re-add foreign key constraints with case_number
ALTER TABLE claim_shares ADD CONSTRAINT claim_shares_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE evidence_claims ADD CONSTRAINT evidence_claims_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE pending_evidence ADD CONSTRAINT pending_evidence_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_claim_id_fkey 
  FOREIGN KEY (claim_id) REFERENCES claims(case_number) ON DELETE CASCADE;