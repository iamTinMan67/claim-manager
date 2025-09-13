-- Test Chat Messages Access
-- Run this in your Supabase SQL Editor to debug

-- Check if chat_messages table exists and has data
SELECT COUNT(*) as total_messages FROM chat_messages;

-- Check if there are any messages for the specific claim
SELECT COUNT(*) as messages_for_claim 
FROM chat_messages 
WHERE claim_id = 'KB2025LIV000075';

-- Check the current user's access to chat messages
SELECT 
  c.case_number,
  COUNT(cm.id) as message_count
FROM claims c
LEFT JOIN chat_messages cm ON c.case_number = cm.claim_id
WHERE c.case_number = 'KB2025LIV000075'
GROUP BY c.case_number;

-- Check if the current user has access to the claim
SELECT 
  c.case_number,
  c.user_id as claim_owner,
  cs.shared_with_id,
  cs.permission
FROM claims c
LEFT JOIN claim_shares cs ON c.case_number = cs.claim_id
WHERE c.case_number = 'KB2025LIV000075';
