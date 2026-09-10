-- Allow guests to remove themselves from a shared claim (leave collaboration).
-- Hosts can already revoke shares via owner_id = auth.uid() policies.
CREATE POLICY "Guests can leave shared claims"
  ON public.claim_shares
  FOR DELETE
  USING (shared_with_id = auth.uid());
