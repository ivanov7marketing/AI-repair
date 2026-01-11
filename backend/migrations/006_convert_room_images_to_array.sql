-- Convert room_images from Record<string, string> to Record<string, string[]>
-- Each room image becomes an array with a single element

DO $$
DECLARE
  proj_record RECORD;
  updated_images jsonb;
  room_key text;
  room_value jsonb;
BEGIN
  FOR proj_record IN SELECT id, room_images FROM projects WHERE room_images IS NOT NULL AND room_images != '{}'::jsonb
  LOOP
    updated_images := '{}'::jsonb;
    
    FOR room_key, room_value IN SELECT * FROM jsonb_each(proj_record.room_images)
    LOOP
      IF jsonb_typeof(room_value) = 'array' THEN
        updated_images := updated_images || jsonb_build_object(room_key, room_value);
      ELSE
        updated_images := updated_images || jsonb_build_object(room_key, jsonb_build_array(room_value));
      END IF;
    END LOOP;
    
    UPDATE projects
    SET room_images = updated_images
    WHERE id = proj_record.id;
  END LOOP;
END $$;

