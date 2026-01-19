-- Add tags field to deals table
-- Tags will be stored as JSON array of strings

ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Create index for tags queries
CREATE INDEX IF NOT EXISTS idx_deals_tags ON deals USING GIN (tags);
