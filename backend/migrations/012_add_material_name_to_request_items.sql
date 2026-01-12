-- Add material_name field to purchase_request_items for custom materials
ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS material_name VARCHAR(255);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_material_name ON purchase_request_items(material_name) WHERE material_name IS NOT NULL;
