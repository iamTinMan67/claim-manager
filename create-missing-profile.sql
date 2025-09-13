-- Create missing profile for tomboyce@mail.com
-- This script should be run in the Supabase SQL Editor

-- First, let's check if the user exists in auth.users
SELECT id, email FROM auth.users WHERE email = 'tomboyce@mail.com';

-- If the user exists in auth.users, create the profile
-- Replace 'USER_ID_FROM_AUTH' with the actual UUID from the query above
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
VALUES (
  '6a16eec7-22d6-4fea-8cb9-8d6327c87985',  -- Replace with actual UUID from auth.users
  'tomboyce@mail.com',
  'Tom Boyce',  -- You can change this name
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = now();

-- Verify the profile was created
SELECT id, email, full_name FROM profiles WHERE email = 'tomboyce@mail.com';
