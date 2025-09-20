-- Remove exclusive privileges functionality
-- This reverts the changes made in 20250120_add_exclusive_privileges.sql

-- Drop the functions first
DROP FUNCTION IF EXISTS public.has_exclusive_privileges(UUID);
DROP FUNCTION IF EXISTS public.has_valid_access(UUID);

-- Remove the exclusive_privileges column from subscribers table
ALTER TABLE public.subscribers 
DROP COLUMN IF EXISTS exclusive_privileges;
