-- Create pending_evidence table for evidence awaiting approval
CREATE TABLE public.pending_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL,
  submitter_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  
  -- Evidence fields (same as evidence table)
  description TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  exhibit_id TEXT,
  method TEXT,
  url_link TEXT,
  book_of_deeds_ref TEXT,
  number_of_pages INTEGER,
  date_submitted DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pending_evidence
ALTER TABLE public.pending_evidence ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending_evidence
CREATE POLICY "Claim owners can view all pending evidence for their claims"
ON public.pending_evidence
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.claims 
    WHERE id = pending_evidence.claim_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Submitters can view their own pending evidence"
ON public.pending_evidence
FOR SELECT
USING (auth.uid() = submitter_id);

CREATE POLICY "Shared users can submit pending evidence"
ON public.pending_evidence
FOR INSERT
WITH CHECK (
  auth.uid() = submitter_id AND
  EXISTS (
    SELECT 1 FROM public.claim_shares
    WHERE claim_id = pending_evidence.claim_id 
    AND shared_with_id = auth.uid()
    AND can_view_evidence = true
  )
);

CREATE POLICY "Claim owners can update pending evidence status"
ON public.pending_evidence
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.claims 
    WHERE id = pending_evidence.claim_id AND user_id = auth.uid()
  )
);

-- Simplify claim_shares table by removing granular permissions we no longer need
ALTER TABLE public.claim_shares 
DROP COLUMN IF EXISTS can_edit_evidence,
DROP COLUMN IF EXISTS can_view_todos,
DROP COLUMN IF EXISTS can_edit_todos,
DROP COLUMN IF EXISTS can_view_notes,
DROP COLUMN IF EXISTS can_edit_notes;

-- Keep only can_view_evidence for basic evidence viewing permission
-- The permission column can be kept for future use but simplified workflow only uses can_view_evidence

-- Create function to approve pending evidence
CREATE OR REPLACE FUNCTION public.approve_pending_evidence(
  pending_id UUID,
  reviewer_notes_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pending_record RECORD;
  new_evidence_id UUID;
BEGIN
  -- Get the pending evidence record
  SELECT * INTO pending_record
  FROM public.pending_evidence
  WHERE id = pending_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending evidence not found';
  END IF;
  
  -- Check if user owns the claim
  IF NOT EXISTS (
    SELECT 1 FROM public.claims 
    WHERE id = pending_record.claim_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve this evidence';
  END IF;
  
  -- Create the evidence record
  INSERT INTO public.evidence (
    user_id,
    description,
    file_name,
    file_url,
    exhibit_id,
    method,
    url_link,
    book_of_deeds_ref,
    number_of_pages,
    date_submitted
  ) VALUES (
    (SELECT user_id FROM public.claims WHERE id = pending_record.claim_id),
    pending_record.description,
    pending_record.file_name,
    pending_record.file_url,
    pending_record.exhibit_id,
    pending_record.method,
    pending_record.url_link,
    pending_record.book_of_deeds_ref,
    pending_record.number_of_pages,
    pending_record.date_submitted
  ) RETURNING id INTO new_evidence_id;
  
  -- Link evidence to claim
  INSERT INTO public.evidence_claims (evidence_id, claim_id)
  VALUES (new_evidence_id, pending_record.claim_id);
  
  -- Update pending evidence status
  UPDATE public.pending_evidence
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewer_notes = reviewer_notes_param
  WHERE id = pending_id;
  
  RETURN new_evidence_id;
END;
$$;

-- Create function to reject pending evidence
CREATE OR REPLACE FUNCTION public.reject_pending_evidence(
  pending_id UUID,
  reviewer_notes_param TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pending_record RECORD;
BEGIN
  -- Get the pending evidence record
  SELECT * INTO pending_record
  FROM public.pending_evidence
  WHERE id = pending_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending evidence not found';
  END IF;
  
  -- Check if user owns the claim
  IF NOT EXISTS (
    SELECT 1 FROM public.claims 
    WHERE id = pending_record.claim_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to reject this evidence';
  END IF;
  
  -- Update pending evidence status
  UPDATE public.pending_evidence
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewer_notes = reviewer_notes_param
  WHERE id = pending_id;
END;
$$;

-- Add trigger for updating updated_at
CREATE TRIGGER update_pending_evidence_updated_at
BEFORE UPDATE ON public.pending_evidence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();