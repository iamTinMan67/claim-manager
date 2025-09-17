-- Add responsible_user_id to todos for shared assignments
ALTER TABLE public.todos
ADD COLUMN IF NOT EXISTS responsible_user_id UUID NULL;

-- Create FK to profiles.id if profiles table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.todos
    ADD CONSTRAINT todos_responsible_user_fk
    FOREIGN KEY (responsible_user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Index for quicker lookups by assignee
CREATE INDEX IF NOT EXISTS idx_todos_responsible_user
  ON public.todos (responsible_user_id);

-- Broaden SELECT policy to allow assignees to view todos
DO $$
BEGIN
  -- If there is a policy named similarly, replace it with a broader one
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'todos' AND policyname = 'Users can view their own todos'
  ) THEN
    DROP POLICY "Users can view their own todos" ON public.todos;
  END IF;

  CREATE POLICY "Users can view own or assigned todos"
  ON public.todos
  FOR SELECT
  USING (
    auth.uid() = user_id OR auth.uid() = responsible_user_id
  );
END $$;


