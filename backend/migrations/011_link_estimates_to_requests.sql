-- Link estimates to purchase requests
-- This migration adds fields that were already included in migration 008, but we keep it for clarity
-- The fields estimate_project_id, estimate_room_id, estimate_item_path are already in purchase_request_items

-- Add any additional indexes if needed for estimate linking
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_estimate_project ON purchase_request_items(estimate_project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_from_estimate ON purchase_request_items(from_estimate) WHERE from_estimate = true;
