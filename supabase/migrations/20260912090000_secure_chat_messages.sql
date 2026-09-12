-- Restrict chat access to claim owners and active shared participants.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat participants can read messages" ON public.chat_messages;
CREATE POLICY "Chat participants can read messages"
  ON public.chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.claims c
      WHERE c.claim_id = chat_messages.claim_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.claim_shares cs
            WHERE cs.claim_id = c.claim_id
              AND (cs.owner_id = auth.uid() OR cs.shared_with_id = auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Chat participants can send messages" ON public.chat_messages;
CREATE POLICY "Chat participants can send messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.claims c
      WHERE c.claim_id = chat_messages.claim_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.claim_shares cs
            WHERE cs.claim_id = c.claim_id
              AND (cs.owner_id = auth.uid() OR cs.shared_with_id = auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Authors and claim owners can delete chat messages" ON public.chat_messages;
CREATE POLICY "Authors and claim owners can delete chat messages"
  ON public.chat_messages
  FOR DELETE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.claims c
      WHERE c.claim_id = chat_messages.claim_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors and claim owners can update chat messages" ON public.chat_messages;
CREATE POLICY "Authors and claim owners can update chat messages"
  ON public.chat_messages
  FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.claims c
      WHERE c.claim_id = chat_messages.claim_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.claims c
      WHERE c.claim_id = chat_messages.claim_id
        AND c.user_id = auth.uid()
    )
  );
