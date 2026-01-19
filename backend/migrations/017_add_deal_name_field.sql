-- Add deal_name field to deals table
-- This field stores the deal title/name (shown in header), separate from lead_name (client name)

ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS deal_name VARCHAR(255);

-- Set initial deal_name based on existing lead_name or generate "Сделка 001" format
-- For existing deals, use lead_name if exists, otherwise generate sequential number per organization
DO $$
DECLARE
  org_record RECORD;
  deal_record RECORD;
  deal_counter INT;
BEGIN
  FOR org_record IN SELECT DISTINCT organization_id FROM deals WHERE deal_name IS NULL LOOP
    deal_counter := 1;
    FOR deal_record IN 
      SELECT id, lead_name 
      FROM deals 
      WHERE organization_id = org_record.organization_id AND deal_name IS NULL
      ORDER BY created_at
    LOOP
      UPDATE deals 
      SET deal_name = COALESCE(
        deal_record.lead_name,
        'Сделка ' || LPAD(deal_counter::text, 3, '0')
      )
      WHERE id = deal_record.id;
      deal_counter := deal_counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Make it NOT NULL after setting values
ALTER TABLE deals 
  ALTER COLUMN deal_name SET NOT NULL;
