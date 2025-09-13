-- Add donation tracking fields to claim_shares table
ALTER TABLE public.claim_shares 
ADD COLUMN donation_required BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN donation_paid BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN donation_amount INTEGER DEFAULT NULL,
ADD COLUMN stripe_payment_intent_id TEXT DEFAULT NULL,
ADD COLUMN donation_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for querying shares by donation status
CREATE INDEX idx_claim_shares_donation_status ON public.claim_shares(claim_id, donation_required, donation_paid);

-- Create function to count free shares for a claim
CREATE OR REPLACE FUNCTION public.count_free_shares(claim_id_param uuid)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM public.claim_shares 
  WHERE claim_id = claim_id_param 
  AND donation_required = false;
$function$;

-- Create function to check if donation is required for new share
CREATE OR REPLACE FUNCTION public.is_donation_required_for_share(claim_id_param uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT count_free_shares(claim_id_param) >= 2;
$function$;