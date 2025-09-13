-- Update donation calculation functions for new tiered pricing

-- Create function to calculate donation amount based on collaborator count
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
    ELSE 4000 + (((SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) - 40) / 10) * 500 -- £5 increase per additional 10
  END;
$$;

-- Update the donation required function to use new logic
CREATE OR REPLACE FUNCTION public.is_donation_required_for_share(claim_id_param uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT (SELECT COUNT(*) FROM public.claim_shares WHERE claim_id = claim_id_param) >= 2;
$$;