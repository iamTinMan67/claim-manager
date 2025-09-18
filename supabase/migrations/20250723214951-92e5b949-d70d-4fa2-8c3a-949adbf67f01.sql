-- Add evidence_id column to todos table to link todos with evidence
ALTER TABLE public.todos 
ADD COLUMN evidence_id uuid REFERENCES public.evidence(id) ON DELETE SET NULL;