-- Step 1: Find your user ID and email
-- Run this first to see all users and find yours
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at ASC;

-- Step 2: Once you find your user ID, replace 'YOUR_ACTUAL_USER_ID' below with your real ID
-- Example: if your ID is '123e4567-e89b-12d3-a456-426614174000', use that instead

-- Option A: If you already have a record in subscribers table
-- UPDATE public.subscribers 
-- SET exclusive_privileges = true, 
--     subscribed = true, 
--     subscription_tier = 'exclusive',
--     updated_at = now()
-- WHERE user_id = 'YOUR_ACTUAL_USER_ID';

-- Option B: If you don't have a record in subscribers table yet
-- INSERT INTO public.subscribers (user_id, email, exclusive_privileges, subscribed, subscription_tier, updated_at)
-- SELECT id, email, true, true, 'exclusive', now()
-- FROM auth.users 
-- WHERE id = 'YOUR_ACTUAL_USER_ID';

-- Step 3: Verify the exclusive privileges were granted
-- SELECT user_id, email, exclusive_privileges, subscribed, subscription_tier 
-- FROM public.subscribers 
-- WHERE user_id = 'YOUR_ACTUAL_USER_ID';
