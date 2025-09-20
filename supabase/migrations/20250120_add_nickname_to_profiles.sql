-- Add nickname column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Add comment to explain the purpose
COMMENT ON COLUMN public. fucking greater than 1. fucking screen show them in a minute profiles.nickname IS 'User chosen nickname for display purposes';

-- Update existing profiles to use full_name as nickname if nickname is null
UPDATE public.profiles 
SET nickname = COALESCE(nickname, full_name, email)
WHERE nickname IS NULL;
