-- Add missing description column to evidence table
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS description text;