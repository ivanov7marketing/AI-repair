-- Create price_items table for organization-specific price lists
CREATE TABLE IF NOT EXISTS price_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(255) NOT NULL,
  subcategory VARCHAR(255),
  type VARCHAR(50) NOT NULL CHECK (type IN ('work', 'rough', 'finish')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_price_items_organization ON price_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_price_items_type ON price_items(type);
CREATE INDEX IF NOT EXISTS idx_price_items_category ON price_items(category);
CREATE INDEX IF NOT EXISTS idx_price_items_deleted ON price_items(deleted_at) WHERE deleted_at IS NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_price_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_price_items_updated_at
  BEFORE UPDATE ON price_items
  FOR EACH ROW
  EXECUTE FUNCTION update_price_items_updated_at();

