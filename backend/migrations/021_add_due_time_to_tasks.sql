-- Add due_time field to tasks table for time specification
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS due_time TIME;

-- Update due_date to TIMESTAMP to support date and time together
-- First, we'll keep both fields for backward compatibility
-- due_date will remain DATE, due_time will be TIME
-- Frontend will combine them when needed
