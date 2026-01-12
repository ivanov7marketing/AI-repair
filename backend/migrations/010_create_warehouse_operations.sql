-- Create warehouse operations log table

-- Warehouse operations (unified log of all operations)
CREATE TABLE IF NOT EXISTS warehouse_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('purchase', 'arrival', 'writeoff', 'return', 'tool_issue', 'tool_return', 'transfer')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials_catalog(id) ON DELETE SET NULL,
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2),
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  document_url TEXT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_operations_organization ON warehouse_operations(organization_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_operations_type ON warehouse_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_warehouse_operations_project ON warehouse_operations(project_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_operations_material ON warehouse_operations(material_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_operations_tool ON warehouse_operations(tool_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_operations_performed_by ON warehouse_operations(performed_by);
CREATE INDEX IF NOT EXISTS idx_warehouse_operations_created_at ON warehouse_operations(created_at);
