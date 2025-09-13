
-- Add book_of_deeds_ref column to the evidence table
ALTER TABLE public.evidence 
ADD COLUMN book_of_deeds_ref TEXT;
