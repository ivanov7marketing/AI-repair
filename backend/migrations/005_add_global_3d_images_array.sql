-- Добавляем колонку для массива глобальных 3D изображений
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS global_3d_images JSONB DEFAULT '[]'::jsonb;

-- Мигрируем существующие данные из global_3d_image в global_3d_images
UPDATE projects 
SET global_3d_images = CASE 
  WHEN global_3d_image IS NOT NULL AND global_3d_image != '' THEN jsonb_build_array(global_3d_image)
  ELSE '[]'::jsonb
END
WHERE global_3d_images IS NULL OR jsonb_array_length(global_3d_images) = 0;

