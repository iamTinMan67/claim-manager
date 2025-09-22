-- Check if the claim exists in the database
-- This will help us understand why the claim isn't showing up

-- 1. Check if the claim exists by case_number
SELECT 
  claim_id,
  case_number,
  title,
  user_id,
  created_at
FROM claims 
WHERE case_number = '60EF0083825';

-- 2. Check if the claim exists by claim_id (if it's a UUID)
SELECT 
  claim_id,
  case_number,
  title,
  user_id,
  created_at
FROM claims 
WHERE claim_id = '60EF0083825';

-- 3. Check all claims for the current user
SELECT 
  claim_id,
  case_number,
  title,
  user_id,
  created_at
FROM claims 
WHERE user_id = '29191813-91d1-454b-b6f1-6782a7237b89'
ORDER BY created_at DESC;

-- 4. Check if there are any claims at all
SELECT COUNT(*) as total_claims FROM claims;

-- 5. Check the claims table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'claims' 
ORDER BY ordinal_position;
