-- Add overdue and future statuses to tasks table
ALTER TABLE tasks 
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks 
  ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('today', 'tomorrow', 'week', 'overdue', 'future'));
