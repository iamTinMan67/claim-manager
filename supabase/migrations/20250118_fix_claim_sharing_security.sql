-- Fix claim sharing security vulnerability
-- Guests should NOT be able to share claims they only have guest access to
-- Only claim owners should be able to create/update/delete shares

-- Create a function to check if user is the OWNER of a claim (not just has access)
CREATE OR REPLACE FUNCTION public.is_claim_owner(claim_id_param text, input_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.claims 
    WHERE case_number = claim_id_param AND user_id = input_user_id
  );
$function$;

-- Create a function to check if user has ANY access to a claim (owner OR guest)
CREATE OR REPLACE FUNCTION public.has_claim_access(claim_id_param text, input_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.claims WHERE case_number = claim_id_param AND user_id = input_user_id
    UNION
    SELECT 1 FROM public.claim_shares WHERE claim_id = claim_id_param AND shared_with_id = input_user_id
  );
$function$;

-- Update RLS policies for claim_shares to use ownership verification
-- Only claim OWNERS can create, update, or delete shares
DROP POLICY IF EXISTS "Users can create shares for their own claims" ON public.claim_shares;
DROP POLICY IF EXISTS "Users can update shares for their own claims" ON public.claim_shares;
DROP POLICY IF EXISTS "Users can delete shares for their own claims" ON public.claim_shares;

-- Create new secure policies
CREATE POLICY "Only claim owners can create shares" 
ON public.claim_shares 
FOR INSERT 
WITH CHECK (is_claim_owner(claim_id, auth.uid()));

CREATE POLICY "Only claim owners can update shares" 
ON public.claim_shares 
FOR UPDATE 
USING (is_claim_owner(claim_id, auth.uid()));

CREATE POLICY "Only claim owners can delete shares" 
ON public.claim_shares 
FOR DELETE 
USING (is_claim_owner(claim_id, auth.uid()));

-- Keep the view policy as is (both owners and guests can view shares)
-- This policy already exists and is correct
