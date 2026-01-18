-- Create sales tables: pipeline stages, deal sources, deals, timeline, files, tasks

-- 1. Pipeline stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_index INT NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
  stage_type VARCHAR(20) NOT NULL CHECK (stage_type IN ('active', 'won', 'lost', 'system')) DEFAULT 'active',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_organization ON pipeline_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(organization_id, order_index);

-- 2. Deal sources table
CREATE TABLE IF NOT EXISTS deal_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  lead_cost DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_sources_organization ON deal_sources(organization_id);

-- 3. Deals table (main table)
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  source_id UUID REFERENCES deal_sources(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  object_id UUID NULL, -- Will be linked to objects table later
  
  -- Contact information
  lead_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  telegram VARCHAR(100),
  whatsapp VARCHAR(20),
  
  -- Object information
  address TEXT,
  building_type VARCHAR(50),
  area DECIMAL(10,2),
  rooms_count VARCHAR(10),
  bathroom_type VARCHAR(50),
  ceiling_height DECIMAL(4,2),
  has_elevator BOOLEAN DEFAULT false,
  
  -- Repair parameters
  repair_type VARCHAR(50),
  object_condition VARCHAR(50),
  budget_from DECIMAL(12,2),
  budget_to DECIMAL(12,2),
  needs_design BOOLEAN DEFAULT false,
  needs_demolition BOOLEAN DEFAULT false,
  material_purchase_type VARCHAR(50),
  desired_start_date DATE,
  urgency VARCHAR(20),
  
  -- Sales process
  responsible_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lead_temperature VARCHAR(10) CHECK (lead_temperature IN ('hot', 'warm', 'cold')) DEFAULT 'warm',
  days_on_stage INT DEFAULT 0,
  stage_entered_at TIMESTAMP DEFAULT NOW(),
  
  -- Measurement
  measurer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  measurement_date DATE,
  measurement_time TIME,
  measurement_completed BOOLEAN DEFAULT false,
  measurement_notes TEXT,
  
  -- Documents
  contract_file_url TEXT,
  contract_signed_date DATE,
  prepayment_amount DECIMAL(12,2),
  prepayment_date DATE,
  
  -- Metadata
  is_realized BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  closed_reason TEXT,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deals_organization_stage ON deals(organization_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_responsible_manager ON deals(responsible_manager_id);
CREATE INDEX IF NOT EXISTS idx_deals_project ON deals(project_id);
CREATE INDEX IF NOT EXISTS idx_deals_source ON deals(source_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);

-- 4. Deal timeline table
CREATE TABLE IF NOT EXISTS deal_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('comment', 'stage_change', 'call', 'email', 'task', 'file_upload', 'field_change', 'deal_created')),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_deal ON deal_timeline(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON deal_timeline(event_type);

-- 5. Deal files table
CREATE TABLE IF NOT EXISTS deal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('photo', 'drawing', 'document', 'reference')),
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_files_deal ON deal_files(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_files_type ON deal_files(file_type);

-- 6. Deal tasks table
CREATE TABLE IF NOT EXISTS deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal ON deal_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_assigned ON deal_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_due_date ON deal_tasks(due_date) WHERE completed = false;

-- Function to create default pipeline stages for a new organization
CREATE OR REPLACE FUNCTION create_default_pipeline_stages(org_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO pipeline_stages (organization_id, name, order_index, color, stage_type, is_default) VALUES
    (org_id, 'Квалифицировать', 1, '#3B82F6', 'active', true),
    (org_id, 'Записать на замер', 2, '#06B6D4', 'active', true),
    (org_id, 'Провести замер', 3, '#14B8A6', 'active', true),
    (org_id, 'Подготовить смету', 4, '#10B981', 'active', true),
    (org_id, 'Презентовать КП', 5, '#84CC16', 'active', true),
    (org_id, 'Дожать в договор', 6, '#F59E0B', 'active', true),
    (org_id, 'Договор подписан', 7, '#059669', 'won', true),
    (org_id, 'Нереализованные', 8, '#6B7280', 'lost', true)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to create default deal sources for a new organization
CREATE OR REPLACE FUNCTION create_default_deal_sources(org_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO deal_sources (organization_id, name, icon, is_active) VALUES
    (org_id, 'Сайт', '🌐', true),
    (org_id, 'Телеграм', '✈️', true),
    (org_id, 'Email', '📧', true),
    (org_id, 'Телефония', '☎️', true),
    (org_id, 'Instagram', '📱', true),
    (org_id, 'Рекомендации', '👥', true),
    (org_id, 'Повторное обращение', '🔄', true),
    (org_id, 'Контекстная реклама', '🎯', true),
    (org_id, 'Другое', '❓', true)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default stages and sources when organization is created
-- Note: This will be called manually or via application logic when organization is created
-- as we can't easily detect new organization insertions in a migration
