-- Fix the has_evidence_permission function to avoid ambiguous user_id references

DROP FUNCTION IF EXISTS public.has_evidence_permission(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.has_evidence_permission(claim_id_param uuid, user_id_param uuid, permission_type text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.claims WHERE id = claim_id_param AND user_id = user_id_param) THEN true
    WHEN permission_type = 'view' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id_param AND shared_with_id = user_id_param AND can_view_evidence = true
    )
    WHEN permission_type = 'edit' THEN EXISTS (
      SELECT 1 FROM public.claim_shares 
      WHERE claim_id = claim_id_param AND shared_with_id = user_id_param AND can_edit_evidence = true
    )
    ELSE false
  END;
$function$;