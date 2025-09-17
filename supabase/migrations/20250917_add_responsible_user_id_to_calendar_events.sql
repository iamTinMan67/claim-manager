-- Add responsible_user_id to calendar_events for shared assignments
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS responsible_user_id UUID NULL;

-- Create FK to profiles.id if profiles table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD CONSTRAINT calendar_events_responsible_user_fk
    FOREIGN KEY (responsible_user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Index for quicker lookups by assignee
CREATE INDEX IF NOT EXISTS idx_calendar_events_responsible_user
  ON public.calendar_events (responsible_user_id);

-- Broaden SELECT policy to allow assignees to view events
DO $$
BEGIN
  -- Drop and recreate SELECT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_events' AND policyname = 'Users can view their own calendar events'
  ) THEN
    DROP POLICY "Users can view their own calendar events" ON public.calendar_events;
  END IF;

  CREATE POLICY "Users can view own or assigned events"
  ON public.calendar_events
  FOR SELECT
  USING (
    auth.uid() = user_id OR auth.uid() = responsible_user_id
  );
END $$;

-- Keep INSERT/UPDATE/DELETE policies as owner-only; adjust names if needed
-- If previous policies exist with old names, we leave them intact to avoid disruptions.


