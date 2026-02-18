-- Create tasks table for general task management
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  task_type VARCHAR(50),
  due_date DATE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('today', 'tomorrow', 'week')) DEFAULT 'today',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_organization ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE completed = false;
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
