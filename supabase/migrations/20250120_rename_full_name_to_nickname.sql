-- Rename full_name to nickname and clean up the profiles table
-- This consolidates the display name into a single field

-- First, if nickname column doesn't exist, create it
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Copy any existing full_name values to nickname (if nickname is null)
UPDATE public.profiles 
SET nickname = COALESCE(nickname, full_name, email)
WHERE nickname IS NULL OR nickname = '';

-- Drop the full_name column since we're using nickname
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS full_name;

-- Add comment to explain the purpose
COMMENT ON COLUMN public.profiles.nickname IS 'User chosen display name/nickname';

-- Create an index on nickname for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);
