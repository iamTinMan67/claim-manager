-- Grant exclusive privileges to the application creator/developer
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from the auth.users table

-- First, let's see what users exist
SELECT id, email, created_at FROM auth.users ORDER BY created_at ASC;

-- To grant exclusive privileges, run this command with your actual user ID:
-- UPDATE public.subscribers 
-- SET exclusive_privileges = true, 
--     subscribed = true, 
--     subscription_tier = 'exclusive',
--     updated_at = now()
-- WHERE user_id = 'YOUR_USER_ID_HERE';

-- If you don't have a record in subscribers table yet, create one:
-- INSERT INTO public.subscribers (user_id, email, exclusive_privileges, subscribed, subscription_tier, updated_at)
-- SELECT id, email, true, true, 'exclusive', now()
-- FROM auth.users 
-- WHERE email = 'YOUR_EMAIL_HERE';
