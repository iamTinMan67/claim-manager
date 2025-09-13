-- Recreate missing database functions that were lost during migration

-- Function to check collaborator limits
CREATE OR REPLACE FUNCTION public.check_collaborator_limit(
  claim_id_param text,
  new_collaborator_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- For now, allow unlimited collaborators (can be modified later)
  -- Return success response
  result := jsonb_build_object(
    'allowed', true,
    'message', 'Collaborator addition allowed'
  );
  
  RETURN result;
END;
$$;

-- Function to check if donation is required for sharing
CREATE OR REPLACE FUNCTION public.is_donation_required_for_share(
  claim_id_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For now, no donation required (can be modified later)
  RETURN false;
END;
$$;

-- Function to approve pending evidence
CREATE OR REPLACE FUNCTION public.approve_pending_evidence(
  pending_id uuid,
  reviewer_notes_param text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record record;
  new_evidence_id uuid;
BEGIN
  -- Get the pending evidence record
  SELECT * INTO pending_record 
  FROM public.pending_evidence 
  WHERE id = pending_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending evidence not found';
  END IF;
  
  -- Create new evidence record
  INSERT INTO public.evidence (
    user_id,
    description,
    file_name,
    file_url,
    exhibit_id,
    number_of_pages,
    date_submitted,
    method,
    url_link,
    book_of_deeds_ref
  ) VALUES (
    pending_record.submitter_id,
    pending_record.description,
    pending_record.file_name,
    pending_record.file_url,
    pending_record.exhibit_id,
    pending_record.number_of_pages,
    pending_record.date_submitted,
    pending_record.method,
    pending_record.url_link,
    pending_record.book_of_deeds_ref
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

-- Function to reject pending evidence
CREATE OR REPLACE FUNCTION public.reject_pending_evidence(
  pending_id uuid,
  reviewer_notes_param text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update pending evidence status
  UPDATE public.pending_evidence 
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewer_notes = reviewer_notes_param
  WHERE id = pending_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending evidence not found';
  END IF;
END;
$$;