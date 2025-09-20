-- Quick setup for exclusive privileges
-- Run this in your Supabase SQL Editor

-- 1. Add the exclusive_privileges column
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS exclusive_privileges BOOLEAN NOT NULL DEFAULT false;

-- 2. Find your user ID
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at ASC;

-- 3. After you find your user ID, run this (replace YOUR_USER_ID with actual ID):
-- UPDATE public.subscribers 
-- SET exclusive_privileges = true, 
--     subscribed = true, 
--     subscription_tier = 'exclusive',
--     updated_at = now()
-- WHERE user_id = 'YOUR_USER_ID';

-- 4. If no subscribers record exists, create one:
-- INSERT INTO public.subscribers (user_id, email, exclusive_privileges, subscribed, subscription_tier, updated_at)
-- SELECT id, email, true, true, 'exclusive', now()
-- FROM auth.users 
-- WHERE id = 'YOUR_USER_ID';
