-- Update donation system for collaborator caps

-- Create function to check if collaborator limit is reached
CREATE OR REPLACE FUNCTION public.check_collaborator_limit(claim_id_param uuid, new_collaborator_count integer)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE 
    WHEN new_collaborator_count <= 50 THEN jsonb_build_object('allowed', true, 'requires_donation', false, 'amount', 0)
    WHEN new_collaborator_count <= 100 THEN jsonb_build_object('allowed', false, 'requires_donation', true, 'amount', 7000, 'email_required', true) -- £70
    ELSE jsonb_build_object('allowed', false, 'requires_donation', true, 'amount', 10000, 'email_required', true) -- £100
  END;
$$;

-- Update calculate_donation_amount function for new cap system
CREATE OR REPLACE FUNCTION public.calculate_donation_amount(claim_id_param uuid)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE 
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) < 2 THEN 0
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) < 4 THEN 1000  -- £10 for 3rd and 4th
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) < 10 THEN 2500 -- £25 for 5-10
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) < 20 THEN 3000 -- £30 for 11-20
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) < 30 THEN 3500 -- £35 for 21-30
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) < 40 THEN 4000 -- £40 for 31-40
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) <= 50 THEN 4000 + (((SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) - 40) / 10) * 500 -- £5 increase per additional 10
    WHEN (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) <= 100 THEN 7000 -- £70 for 51-100
    ELSE 10000 -- £100 for 100+
  END;
$$;

-- Create function to get claim owner email
CREATE OR REPLACE FUNCTION public.get_claim_owner_email(claim_id_param uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.email
  FROM public.claims c
  JOIN public.profiles p ON c.user_id = p.id
  WHERE c.id = claim_id_param;
$$;