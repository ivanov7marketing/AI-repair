-- Create table for default price items template
CREATE TABLE IF NOT EXISTS default_price_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(255) NOT NULL,
  subcategory VARCHAR(255),
  type VARCHAR(50) NOT NULL CHECK (type IN ('work', 'rough', 'finish')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_default_price_items_type ON default_price_items(type);
CREATE INDEX IF NOT EXISTS idx_default_price_items_category ON default_price_items(category);
CREATE INDEX IF NOT EXISTS idx_default_price_items_sort ON default_price_items(sort_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_default_price_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_default_price_items_updated_at
  BEFORE UPDATE ON default_price_items
  FOR EACH ROW
  EXECUTE FUNCTION update_default_price_items_updated_at();

-- Create superadmin users table (separate from regular users)
CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Function to update updated_at timestamp for superadmins
CREATE OR REPLACE FUNCTION update_superadmins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_superadmins_updated_at
  BEFORE UPDATE ON superadmins
  FOR EACH ROW
  EXECUTE FUNCTION update_superadmins_updated_at();

