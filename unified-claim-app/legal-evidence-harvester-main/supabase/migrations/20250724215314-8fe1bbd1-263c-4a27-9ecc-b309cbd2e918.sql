-- First, let's add the case_number column if it doesn't exist
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS case_number text;

-- Update RLS policies to allow users to view and update their evidence
DROP POLICY IF EXISTS "Users can create their own evidence" ON public.evidence;
DROP POLICY IF EXISTS "Users can delete their own evidence" ON public.evidence;

-- Create comprehensive RLS policies for evidence
CREATE POLICY "Users can view their own evidence"
ON public.evidence
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evidence"
ON public.evidence
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evidence"
ON public.evidence
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evidence"
ON public.evidence
FOR DELETE
USING (auth.uid() = user_id);