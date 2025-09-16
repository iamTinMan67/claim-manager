-- Drop and recreate the user_owns_evidence function to fix ambiguous column references
DROP FUNCTION IF EXISTS user_owns_evidence(uuid, uuid);

CREATE OR REPLACE FUNCTION user_owns_evidence(evidence_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.evidence 
    WHERE id = evidence_id_param AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;