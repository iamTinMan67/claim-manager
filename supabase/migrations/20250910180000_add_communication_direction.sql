-- Add inbound/outbound direction to communication logs.
-- Existing rows default to 'outbound' for backwards compatibility.

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound'
  CHECK (direction IN ('inbound', 'outbound'));

COMMENT ON COLUMN public.communication_logs.direction IS
  'Whether the communication was received (inbound) or sent (outbound)';

-- Allow shared-claim collaborators to read communication logs (mirrors todos/calendar_events pattern).
CREATE POLICY "Allow read communication_logs for shared claims"
  ON public.communication_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claim_shares cs
      WHERE cs.claim_id = communication_logs.claim_id
        AND (cs.owner_id = auth.uid() OR cs.shared_with_id = auth.uid())
    )
  );
