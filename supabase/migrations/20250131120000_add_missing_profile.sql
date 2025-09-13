/*
  # Add Missing Profile for tomboyce@mail.com

  1. Database Changes
    - Add missing profile record for user 6a16eec7-22d6-4fea-8cb9-8d6327c87985
    - This user exists in auth.users but not in profiles table
    - Required for claim sharing functionality

  2. Security
    - No RLS changes needed
    - Profile will inherit existing policies
*/

-- Add missing profile for tomboyce@mail.com
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
VALUES (
  '6a16eec7-22d6-4fea-8cb9-8d6327c87985',
  'tomboyce@mail.com',
  'Tom Boyce',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = now();

-- Verify the profile was created
SELECT id, email, full_name, created_at 
FROM profiles 
WHERE email = 'tomboyce@mail.com';
