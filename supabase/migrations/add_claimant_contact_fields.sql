-- Add Claimant Email and Claimant Contact Number to claims table.
-- Existing columns contact_number and email are displayed as "Court Number" and "Court Email".
-- Run this in the Supabase SQL editor if your claims table does not yet have these columns.

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS claimant_email TEXT,
  ADD COLUMN IF NOT EXISTS claimant_contact_number TEXT;

COMMENT ON COLUMN claims.contact_number IS 'Court contact number (displayed as Court Number)';
COMMENT ON COLUMN claims.email IS 'Court email (displayed as Court Email)';
COMMENT ON COLUMN claims.claimant_email IS 'Claimant email';
COMMENT ON COLUMN claims.claimant_contact_number IS 'Claimant contact number';
