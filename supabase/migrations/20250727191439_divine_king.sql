/*
  # Add foreign key constraint for calendar_events to profiles

  1. Changes
    - Add foreign key constraint between calendar_events.user_id and profiles.id
    - Enable CASCADE deletion to maintain data integrity

  2. Security
    - Maintains referential integrity between calendar events and user profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calendar_events_user_id_fkey' 
    AND table_name = 'calendar_events'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD CONSTRAINT calendar_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;