-- Fix the search path issue in the user_owns_evidence function
CREATE OR REPLACE FUNCTION public.user_owns_evidence(evidence_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.evidence 
    WHERE id = user_owns_evidence.evidence_id AND user_id = user_owns_evidence.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO '';