-- Clean up nickname usage and set up proper field structure
-- This migration ensures nickname is the primary display name field

-- First, ensure all profiles have a nickname (use full_name as fallback)
UPDATE public.profiles 
SET nickname = COALESCE(nickname, full_name, email)
WHERE nickname IS NULL OR nickname = '';

-- For existing profiles where full_name and nickname are the same, we can keep both
-- But going forward, we'll primarily use nickname for display

-- Add a comment to clarify the purpose of each field
COMMENT ON COLUMN public.profiles.full_name IS 'Full legal name (optional, kept for compatibility)';
COMMENT ON COLUMN public.profiles.nickname IS 'Display name/nickname (primary field for user identification)';

-- Create an index on nickname for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);

-- Update the migration that adds nickname to be more specific
-- (This is just for documentation - the actual column was added in the previous migration)
