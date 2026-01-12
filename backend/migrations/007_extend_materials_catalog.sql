-- Extend materials catalog with additional fields
-- Add fields to default_price_items table
ALTER TABLE default_price_items
ADD COLUMN IF NOT EXISTS photo TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS min_stock_level DECIMAL(10,2);

-- Add fields to price_items table
ALTER TABLE price_items
ADD COLUMN IF NOT EXISTS photo TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS min_stock_level DECIMAL(10,2);

-- Note: category already exists in both tables
-- Note: supplier_url, supplier_name, last_price_update, auto_price_update already exist from migration 004
