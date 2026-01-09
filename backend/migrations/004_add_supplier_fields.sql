-- Add supplier-related fields to default_price_items table
ALTER TABLE default_price_items
ADD COLUMN IF NOT EXISTS supplier_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_price_update BOOLEAN DEFAULT false;

-- Add supplier-related fields to price_items table
ALTER TABLE price_items
ADD COLUMN IF NOT EXISTS supplier_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_price_update BOOLEAN DEFAULT false;

-- Create indexes for supplier_url for faster lookups
CREATE INDEX IF NOT EXISTS idx_default_price_items_supplier_url ON default_price_items(supplier_url) WHERE supplier_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_items_supplier_url ON price_items(supplier_url) WHERE supplier_url IS NOT NULL;

