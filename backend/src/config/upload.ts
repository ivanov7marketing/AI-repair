import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Определяем путь для сохранения файлов
// В Railway Volume монтируется в /app/uploads
// В локальной разработке используем ./uploads/images
export const getUploadsDir = (): string => {
  const railwayVolumePath = '/app/uploads/images';
  const localPath = path.join(process.cwd(), 'uploads', 'images');
  
  // Проверяем, существует ли Railway Volume путь
  if (fs.existsSync('/app/uploads')) {
    // Убеждаемся, что директория images существует
    if (!fs.existsSync(railwayVolumePath)) {
      fs.mkdirSync(railwayVolumePath, { recursive: true });
    }
    return railwayVolumePath;
  }
  
  // Используем локальный путь
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }
  return localPath;
};

// Конфигурация хранилища
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = getUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

// Фильтр файлов - только изображения
const fileFilter = (_req: any, file: any, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены для загрузки'));
  }
};

// Настройка multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум
  }
});

