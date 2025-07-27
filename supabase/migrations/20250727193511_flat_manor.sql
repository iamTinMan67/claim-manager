/*
  # Add foreign key relationship between todos and profiles

  1. Changes
    - Add foreign key constraint linking todos.user_id to profiles.id
    - This enables Supabase queries to join todos with profiles table
  
  2. Security
    - No RLS changes needed as existing policies remain intact
*/

-- Add foreign key constraint between todos.user_id and profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'todos_user_id_profiles_fkey' 
    AND table_name = 'todos'
  ) THEN
    ALTER TABLE public.todos 
    ADD CONSTRAINT todos_user_id_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;