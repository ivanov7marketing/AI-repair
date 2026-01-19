-- Add traffic source tracking fields to deals table
-- These fields track UTM parameters and other traffic source information

ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS traffic_source VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_content VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_device VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_region_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_id VARCHAR(255);
