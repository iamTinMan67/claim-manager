-- Add display_order column to evidence table
ALTER TABLE public.evidence 
ADD COLUMN display_order INTEGER;

-- Set initial display_order values based on current order
UPDATE public.evidence 
SET display_order = (
  SELECT row_number() OVER (
    PARTITION BY user_id 
    ORDER BY created_at ASC
  )
  FROM public.evidence e2 
  WHERE e2.id = evidence.id
);

-- Add index for better performance when ordering
CREATE INDEX idx_evidence_display_order ON public.evidence(user_id, display_order);