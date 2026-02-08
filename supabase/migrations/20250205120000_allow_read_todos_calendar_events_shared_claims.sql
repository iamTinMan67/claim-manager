-- Allow users to read todos and calendar_events for claims they have access to via claim_shares.
-- This ensures hosts see guest-created todos/events in alert counts and lists, and guests see host-created ones.
-- (Assumes RLS is already enabled on these tables; this adds SELECT access for shared-claim rows.)

-- Todos: allow SELECT when the todo belongs to a claim the user shares (as owner or shared_with).
-- (Existing policies typically allow SELECT where user_id = auth.uid(); this adds shared-claim access.)
CREATE POLICY "Allow read todos for shared claims"
  ON public.todos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      INNER JOIN public.claim_shares cs ON c.claim_id = cs.claim_id
      WHERE c.case_number = todos.case_number
        AND (cs.owner_id = auth.uid() OR cs.shared_with_id = auth.uid())
    )
  );

-- Calendar events: allow SELECT when the event is for a claim the user shares.
CREATE POLICY "Allow read calendar_events for shared claims"
  ON public.calendar_events
  FOR SELECT
  USING (
    claim_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.claim_shares cs
      WHERE cs.claim_id = calendar_events.claim_id
        AND (cs.owner_id = auth.uid() OR cs.shared_with_id = auth.uid())
    )
  );
