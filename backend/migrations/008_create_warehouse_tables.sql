-- Create warehouse and purchase request tables

-- 0. Suppliers table (must be created first as it's referenced by other tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    CREATE TABLE suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      contacts TEXT,
      address TEXT,
      return_conditions TEXT,
      discounts TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  ELSE
    -- Extend existing suppliers table if needed
    ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS return_conditions TEXT,
    ADD COLUMN IF NOT EXISTS discounts TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppliers_organization ON suppliers(organization_id);

-- 1. Materials catalog (extended reference)
CREATE TABLE IF NOT EXISTS materials_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  photo TEXT,
  average_price DECIMAL(10,2),
  notes TEXT,
  min_stock_level DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- 2. Warehouse stock (central warehouse)
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials_catalog(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, material_id)
);

-- 3. Purchase requests
CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  request_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('new', 'in_progress', 'approved', 'purchased', 'rejected')) DEFAULT 'new',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  urgency VARCHAR(20) NOT NULL CHECK (urgency IN ('normal', 'urgent')) DEFAULT 'normal',
  total_amount DECIMAL(12,2) DEFAULT 0,
  estimate_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP NULL,
  rejected_reason TEXT,
  needs_reorder BOOLEAN DEFAULT false,
  UNIQUE(organization_id, request_number)
);

-- 4. Purchase request items
CREATE TABLE IF NOT EXISTS purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials_catalog(id) ON DELETE SET NULL,
  quantity_requested DECIMAL(10,2) NOT NULL,
  quantity_approved DECIMAL(10,2),
  quantity_purchased DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2),
  note TEXT,
  from_estimate BOOLEAN DEFAULT false,
  estimate_item_id UUID,
  estimate_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  estimate_room_id VARCHAR(255),
  estimate_item_path TEXT
);

-- 5. Purchase info (after approval)
CREATE TABLE IF NOT EXISTS purchase_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  responsible_person UUID REFERENCES users(id) ON DELETE SET NULL,
  planned_date DATE,
  actual_date DATE,
  document_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Purchase request log
CREATE TABLE IF NOT EXISTS purchase_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  performed_at TIMESTAMP DEFAULT NOW(),
  comment TEXT,
  old_status VARCHAR(20),
  new_status VARCHAR(20)
);

-- 7. Project materials (materials on objects)
CREATE TABLE IF NOT EXISTS project_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials_catalog(id) ON DELETE CASCADE,
  quantity_planned DECIMAL(10,2) DEFAULT 0,
  quantity_purchased DECIMAL(10,2) DEFAULT 0,
  quantity_on_site DECIMAL(10,2) DEFAULT 0,
  quantity_used DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('excess', 'normal', 'low')) DEFAULT 'normal',
  last_movement_date TIMESTAMP,
  UNIQUE(project_id, material_id)
);

-- 8. Material movements
CREATE TABLE IF NOT EXISTS material_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES materials_catalog(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('arrival', 'writeoff', 'return', 'transfer')),
  quantity DECIMAL(10,2) NOT NULL,
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  document_url TEXT,
  comment TEXT,
  work_stage VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Material returns
CREATE TABLE IF NOT EXISTS material_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials_catalog(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  return_amount DECIMAL(10,2),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('planned', 'returned', 'money_received')) DEFAULT 'planned',
  reason TEXT,
  planned_date DATE,
  actual_date DATE,
  document_url TEXT,
  initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  responsible_person UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. Suppliers table already created at the beginning

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_materials_catalog_organization ON materials_catalog(organization_id);
CREATE INDEX IF NOT EXISTS idx_materials_catalog_category ON materials_catalog(category);
CREATE INDEX IF NOT EXISTS idx_materials_catalog_deleted ON materials_catalog(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_organization ON warehouse_stock(organization_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_material ON warehouse_stock(material_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_organization ON purchase_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_project ON purchase_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_by ON purchase_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_number ON purchase_requests(organization_id, request_number);

CREATE INDEX IF NOT EXISTS idx_purchase_request_items_request ON purchase_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_material ON purchase_request_items(material_id);

CREATE INDEX IF NOT EXISTS idx_purchase_info_request ON purchase_info(request_id);

CREATE INDEX IF NOT EXISTS idx_purchase_request_log_request ON purchase_request_log(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_log_performed_by ON purchase_request_log(performed_by);

CREATE INDEX IF NOT EXISTS idx_project_materials_organization ON project_materials(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_project ON project_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_material ON project_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_status ON project_materials(status);

CREATE INDEX IF NOT EXISTS idx_material_movements_organization ON material_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_project ON material_movements(project_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_material ON material_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_type ON material_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_material_movements_created_at ON material_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_material_returns_organization ON material_returns(organization_id);
CREATE INDEX IF NOT EXISTS idx_material_returns_project ON material_returns(project_id);
CREATE INDEX IF NOT EXISTS idx_material_returns_status ON material_returns(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_materials_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_materials_catalog_updated_at
  BEFORE UPDATE ON materials_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_materials_catalog_updated_at();

CREATE OR REPLACE FUNCTION update_purchase_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_info_updated_at
  BEFORE UPDATE ON purchase_info
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_info_updated_at();

CREATE OR REPLACE FUNCTION update_material_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_material_returns_updated_at
  BEFORE UPDATE ON material_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_material_returns_updated_at();
