-- Allow a guest to remove a shared claim and revoke every share for that claim.
-- The claim record itself is preserved for its owner/private data.
CREATE OR REPLACE FUNCTION public.remove_shared_claim_for_guest(p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.claim_shares
    WHERE claim_id = p_claim_id
      AND shared_with_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only a guest on this claim can remove shared access';
  END IF;

  DELETE FROM public.claim_shares
  WHERE claim_id = p_claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_shared_claim_for_guest(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_shared_claim_for_guest(uuid) TO authenticated;
