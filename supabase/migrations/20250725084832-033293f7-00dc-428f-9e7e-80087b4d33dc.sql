-- Remove description column from evidence table
ALTER TABLE public.evidence DROP COLUMN IF EXISTS description;

-- Remove description column from pending_evidence table  
ALTER TABLE public.pending_evidence DROP COLUMN IF EXISTS description;