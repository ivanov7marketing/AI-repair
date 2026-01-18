-- Convert desired_start_date and measurement_date from DATE to VARCHAR
-- This allows storing text values like "работает" instead of requiring date format

ALTER TABLE deals 
  ALTER COLUMN desired_start_date TYPE VARCHAR(255) USING COALESCE(desired_start_date::text, NULL);

ALTER TABLE deals 
  ALTER COLUMN measurement_date TYPE VARCHAR(255) USING COALESCE(measurement_date::text, NULL);
