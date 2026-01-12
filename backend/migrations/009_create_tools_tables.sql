-- Create tools and tool movements tables

-- 1. Tools
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  category VARCHAR(50) CHECK (category IN ('электроинструмент', 'ручной', 'измерительный')),
  photo TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('working', 'repair', 'disposed')) DEFAULT 'working',
  current_location VARCHAR(50) NOT NULL CHECK (current_location IN ('base', 'project', 'employee')) DEFAULT 'base',
  current_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  current_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_since TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,
  UNIQUE(organization_id, inventory_number)
);

-- 2. Tool movements
CREATE TABLE IF NOT EXISTS tool_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('issue', 'return')),
  employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  returned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMP,
  returned_at TIMESTAMP,
  planned_return_date DATE,
  condition_on_return VARCHAR(20) CHECK (condition_on_return IN ('working', 'repair', 'disposed')),
  photo_on_issue TEXT,
  photo_on_return TEXT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tools_organization ON tools(organization_id);
CREATE INDEX IF NOT EXISTS idx_tools_inventory_number ON tools(organization_id, inventory_number);
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_condition ON tools(condition);
CREATE INDEX IF NOT EXISTS idx_tools_location ON tools(current_location);
CREATE INDEX IF NOT EXISTS idx_tools_project ON tools(current_project_id);
CREATE INDEX IF NOT EXISTS idx_tools_employee ON tools(current_employee_id);
CREATE INDEX IF NOT EXISTS idx_tools_deleted ON tools(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tool_movements_tool ON tool_movements(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_movements_employee ON tool_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_tool_movements_project ON tool_movements(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_movements_type ON tool_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_tool_movements_created_at ON tool_movements(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_updated_at();
