-- Fix shared todos visibility for claim owners
-- This allows claim owners to see todos created by guests for their shared claims

-- First, let's check if there's a has_claim_access function we can use
-- If not, we'll create a simple one for this purpose

CREATE OR REPLACE FUNCTION public.has_claim_access(claim_case_number text, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.claims 
    WHERE case_number = claim_case_number AND user_id = claim_case_number
    UNION
    SELECT 1 FROM public.claim_shares 
    WHERE claim_id = claim_case_number AND shared_with_id = user_id
  );
$function$;

-- Update the todos SELECT policy to include claim owners
DROP POLICY IF EXISTS "Users can view own or assigned todos" ON public.todos;

CREATE POLICY "Users can view own, assigned, or shared claim todos"
ON public.todos
FOR SELECT
USING (
  auth.uid() = user_id OR 
  auth.uid() = responsible_user_id OR
  (case_number IS NOT NULL AND public.has_claim_access(case_number, auth.uid()))
);

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.has_claim_access(text, uuid) TO authenticated;
