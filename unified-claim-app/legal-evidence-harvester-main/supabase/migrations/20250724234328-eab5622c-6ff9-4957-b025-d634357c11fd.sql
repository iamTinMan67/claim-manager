-- Fix the user_owns_evidence function to resolve ambiguous column references
CREATE OR REPLACE FUNCTION user_owns_evidence(evidence_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.evidence 
    WHERE id = evidence_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;