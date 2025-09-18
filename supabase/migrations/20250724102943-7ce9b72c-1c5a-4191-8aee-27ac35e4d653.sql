-- Fix the function that has the wrong column reference
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
      WHERE case_number = case_num AND shared_with_id = user_id AND permission = 'edit'
    )
    ELSE false
  END;
$function$;