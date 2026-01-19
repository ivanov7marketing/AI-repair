-- Make lead_name nullable to allow deals without client name
-- Some leads may come without name information

ALTER TABLE deals 
  ALTER COLUMN lead_name DROP NOT NULL;
