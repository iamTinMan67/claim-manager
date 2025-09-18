-- Fix pending evidence functions by dropping all existing versions first
-- Run this in your Supabase SQL editor

-- 1) Drop all existing versions of the functions
DROP FUNCTION IF EXISTS public.promote_pending_evidence(uuid, text[]);
DROP FUNCTION IF EXISTS public.reject_pending_evidence(uuid, text);
DROP FUNCTION IF EXISTS public.reject_pending_evidence(text, text);
DROP FUNCTION IF EXISTS public.reject_pending_evidence(uuid, varchar);
DROP FUNCTION IF EXISTS public.reject_pending_evidence(text, varchar);

-- 2) Create evidence_claims junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.evidence_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  claim_id text NOT NULL REFERENCES public.claims(case_number) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Add unique constraint to prevent duplicate links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evidence_claims_unique_evidence_claim'
  ) THEN
    ALTER TABLE public.evidence_claims
      ADD CONSTRAINT evidence_claims_unique_evidence_claim UNIQUE (evidence_id, claim_id);
  END IF;
END $$;

-- 4) Backfill existing evidence links
INSERT INTO public.evidence_claims (evidence_id, claim_id)
SELECT e.id, e.case_number
FROM public.evidence e
WHERE e.case_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.evidence_claims ec
    WHERE ec.evidence_id = e.id AND ec.claim_id = e.case_number
  );

-- 5) Create promote function
CREATE OR REPLACE FUNCTION public.promote_pending_evidence(p_pending_id uuid, p_claim_ids text[])
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_pending RECORD;
  v_evidence_id uuid;
  v_title text;
BEGIN
  SELECT * INTO v_pending
  FROM public.pending_evidence
  WHERE id = p_pending_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending evidence not found or not in pending status';
  END IF;

  -- Derive title (fallbacks)
  v_title := COALESCE(NULLIF(v_pending.description, ''), NULLIF(v_pending.file_name, ''), 'Evidence Item');

  -- Create evidence row
  INSERT INTO public.evidence (
    user_id,
    title,
    file_name,
    file_url,
    exhibit_id,
    method,
    url_link,
    book_of_deeds_ref,
    number_of_pages,
    date_submitted,
    display_order
  )
  VALUES (
    v_pending.submitter_id,
    v_title,
    v_pending.file_name,
    v_pending.file_url,
    v_pending.exhibit_id,
    v_pending.method,
    v_pending.url_link,
    v_pending.book_of_deeds_ref,
    v_pending.number_of_pages,
    v_pending.date_submitted,
    0
  )
  RETURNING id INTO v_evidence_id;

  -- Link to all provided claims
  INSERT INTO public.evidence_claims (evidence_id, claim_id)
  SELECT v_evidence_id, unnest(p_claim_ids);

  -- Mark pending as approved
  UPDATE public.pending_evidence
  SET status = 'approved',
      reviewer_notes = COALESCE(reviewer_notes, '') || ' Approved and promoted.',
      reviewed_at = now()
  WHERE id = v_pending.id;

  RETURN v_evidence_id;
END $$;

-- 6) Create reject function
CREATE OR REPLACE FUNCTION public.reject_pending_evidence(p_pending_id uuid, p_reason text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.pending_evidence
  SET status = 'rejected',
      reviewer_notes = COALESCE(reviewer_notes, '') || ' Rejected: ' || COALESCE(p_reason, 'No reason given'),
      reviewed_at = now()
  WHERE id = p_pending_id;
$$;

-- 7) Grant execute permissions
GRANT EXECUTE ON FUNCTION public.promote_pending_evidence(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pending_evidence(uuid, text) TO authenticated;
