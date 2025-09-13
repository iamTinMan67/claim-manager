-- Create the missing functions first
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

-- Now create the policies
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