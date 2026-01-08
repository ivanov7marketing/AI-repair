import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const createPriceItemSchema = z.object({
  name: z.string(), // Allow empty string for new items that will be edited later
  unit: z.string().min(1),
  price: z.number().min(0), // Allow 0 for new items that will be edited later
  category: z.string().min(1),
  subcategory: z.string().optional(),
  type: z.enum(['work', 'rough', 'finish']),
});

const updatePriceItemSchema = z.object({
  name: z.string().optional(), // Allow empty string for editing
  unit: z.string().min(1).optional(),
  price: z.number().min(0).optional(), // Allow 0 for editing
  category: z.string().min(1).optional(),
  subcategory: z.string().optional(),
  type: z.enum(['work', 'rough', 'finish']).optional(),
});

// Default prices to initialize for new organizations
const DEFAULT_PRICES = [
  // === РАБОТЫ ===
  // Подготовительные работы (10)
  { name: 'Грунтовка стен', unit: 'м2', price: 150, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Грунтовка потолка', unit: 'м2', price: 180, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Грунтовка пола', unit: 'м2', price: 120, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Обеспыливание поверхностей', unit: 'м2', price: 80, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Укрытие полов плёнкой', unit: 'м2', price: 50, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Заделка трещин', unit: 'п.м', price: 200, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Армирование сеткой', unit: 'м2', price: 250, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Обработка антисептиком', unit: 'м2', price: 100, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Установка маяков', unit: 'п.м', price: 150, category: 'Подготовительные работы', type: 'work' as const },
  { name: 'Вынос мусора', unit: 'меш', price: 300, category: 'Подготовительные работы', type: 'work' as const },
  
  // Демонтажные работы (10)
  { name: 'Демонтаж обоев', unit: 'м2', price: 100, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж плитки', unit: 'м2', price: 350, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж ламината', unit: 'м2', price: 150, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж паркета', unit: 'м2', price: 200, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж стяжки', unit: 'м2', price: 450, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж штукатурки', unit: 'м2', price: 300, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж перегородки', unit: 'м2', price: 600, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж дверного блока', unit: 'шт', price: 800, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж подвесного потолка', unit: 'м2', price: 250, category: 'Демонтажные работы', type: 'work' as const },
  { name: 'Демонтаж сантехники', unit: 'шт', price: 500, category: 'Демонтажные работы', type: 'work' as const },
  
  // Черновая электрика (10)
  { name: 'Штробление стен под кабель', unit: 'п.м', price: 250, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Штробление потолка под кабель', unit: 'п.м', price: 300, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Прокладка кабеля в штробе', unit: 'п.м', price: 80, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Прокладка кабеля в гофре', unit: 'п.м', price: 100, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Установка подрозетника', unit: 'шт', price: 200, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Монтаж распределительной коробки', unit: 'шт', price: 350, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Сборка щита (до 12 модулей)', unit: 'шт', price: 3500, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Сборка щита (до 24 модулей)', unit: 'шт', price: 5500, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Прокладка слаботочки', unit: 'п.м', price: 70, category: 'Черновая электрика', type: 'work' as const },
  { name: 'Заземление', unit: 'точка', price: 1500, category: 'Черновая электрика', type: 'work' as const },
  
  // Черновая сантехника (10)
  { name: 'Штробление под трубы', unit: 'п.м', price: 400, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Монтаж водопровода (полипропилен)', unit: 'точка', price: 1500, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Монтаж канализации', unit: 'точка', price: 1200, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Установка коллектора', unit: 'шт', price: 2500, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Монтаж гидроизоляции пола', unit: 'м2', price: 450, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Монтаж трапа', unit: 'шт', price: 2000, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Установка счётчиков воды', unit: 'шт', price: 1000, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Опрессовка системы', unit: 'шт', price: 2000, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Монтаж полотенцесушителя', unit: 'шт', price: 2500, category: 'Черновая сантехника', type: 'work' as const },
  { name: 'Подключение бойлера', unit: 'шт', price: 3000, category: 'Черновая сантехника', type: 'work' as const },
  
  // Черновые отделочные работы - Стены
  { name: 'Штукатурка по маякам', unit: 'м2', price: 550, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Шпаклёвка стен (под обои)', unit: 'м2', price: 350, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Шпаклёвка стен (под покраску)', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Монтаж ГКЛ на стены', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Грунтовка стен', unit: 'м2', price: 80, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  
  // Черновые отделочные работы - Пол
  { name: 'Стяжка пола (до 5 см)', unit: 'м2', price: 500, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Стяжка пола (от 5 см)', unit: 'м2', price: 650, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Наливной пол', unit: 'м2', price: 350, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Гидроизоляция пола', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Грунтовка пола', unit: 'м2', price: 60, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  
  // Черновые отделочные работы - Потолок
  { name: 'Штукатурка потолка', unit: 'м2', price: 650, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  { name: 'Шпаклёвка потолка', unit: 'м2', price: 500, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  { name: 'Монтаж ГКЛ на потолок', unit: 'м2', price: 550, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  { name: 'Грунтовка потолка', unit: 'м2', price: 80, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  
  // Чистовые отделочные работы - Стены
  { name: 'Укладка плитки на стены', unit: 'м2', price: 1400, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Поклейка обоев', unit: 'м2', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Покраска стен (2 слоя)', unit: 'м2', price: 300, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Декоративная штукатурка', unit: 'м2', price: 800, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  { name: 'Монтаж стеновых панелей', unit: 'м2', price: 600, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' as const },
  
  // Чистовые отделочные работы - Пол
  { name: 'Укладка ламината', unit: 'м2', price: 450, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Укладка паркетной доски', unit: 'м2', price: 600, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Укладка плитки на пол', unit: 'м2', price: 1200, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Установка плинтуса', unit: 'п.м', price: 200, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  { name: 'Установка порожка', unit: 'шт', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' as const },
  
  // Чистовые отделочные работы - Потолок
  { name: 'Покраска потолка (2 слоя)', unit: 'м2', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  { name: 'Монтаж натяжного потолка', unit: 'м2', price: 800, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  { name: 'Монтаж потолочного плинтуса', unit: 'п.м', price: 150, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  { name: 'Монтаж реечного потолка', unit: 'м2', price: 700, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' as const },
  
  // Чистовая сантехника (10)
  { name: 'Установка унитаза', unit: 'шт', price: 2500, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Установка раковины', unit: 'шт', price: 2000, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Установка ванны', unit: 'шт', price: 4000, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Установка душевой кабины', unit: 'шт', price: 5000, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Установка смесителя', unit: 'шт', price: 1200, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Установка биде', unit: 'шт', price: 2500, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Подключение стиральной машины', unit: 'шт', price: 1500, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Подключение посудомоечной машины', unit: 'шт', price: 1500, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Установка инсталляции', unit: 'шт', price: 4500, category: 'Чистовая сантехника', type: 'work' as const },
  { name: 'Герметизация сантехники', unit: 'шт', price: 500, category: 'Чистовая сантехника', type: 'work' as const },
  
  // Чистовая электрика (10)
  { name: 'Установка розетки', unit: 'шт', price: 350, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка выключателя', unit: 'шт', price: 350, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка светильника накладного', unit: 'шт', price: 500, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка светильника встраиваемого', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка люстры', unit: 'шт', price: 1500, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Монтаж светодиодной ленты', unit: 'п.м', price: 300, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка терморегулятора', unit: 'шт', price: 800, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка датчика движения', unit: 'шт', price: 600, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка TV-розетки', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work' as const },
  { name: 'Установка интернет-розетки', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work' as const },
  
  // === ЧЕРНОВЫЕ МАТЕРИАЛЫ (20) ===
  { name: 'Грунтовка Ceresit CT 17', unit: 'л', price: 350, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Бетон-контакт Knauf', unit: 'кг', price: 200, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Штукатурка Knauf MP-75', unit: 'меш', price: 450, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Штукатурка Knauf Rotband', unit: 'меш', price: 550, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Шпаклёвка Vetonit LR+', unit: 'меш', price: 850, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Шпаклёвка Knauf Fugen', unit: 'меш', price: 450, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Пескобетон М300', unit: 'меш', price: 200, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Наливной пол Vetonit 3000', unit: 'меш', price: 650, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'ГКЛ Knauf 12.5мм', unit: 'лист', price: 450, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'ГКЛВ Knauf 12.5мм', unit: 'лист', price: 550, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Профиль ПН 27х28', unit: 'шт', price: 120, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Профиль ПП 60х27', unit: 'шт', price: 180, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Подвес прямой', unit: 'шт', price: 15, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Кабель ВВГнг 3х2.5', unit: 'м', price: 80, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Кабель ВВГнг 3х1.5', unit: 'м', price: 55, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Гофра ПВХ 20мм', unit: 'м', price: 25, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Труба PPR 20мм', unit: 'м', price: 80, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Труба канализационная 50мм', unit: 'м', price: 150, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Гидроизоляция Ceresit CL 51', unit: 'кг', price: 450, category: 'Черновые материалы', type: 'rough' as const },
  { name: 'Сетка армирующая', unit: 'м2', price: 120, category: 'Черновые материалы', type: 'rough' as const },
  
  // === ЧИСТОВЫЕ МАТЕРИАЛЫ (20) ===
  { name: 'Ламинат Tarkett 32 класс', unit: 'м2', price: 1200, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Ламинат Quick-Step 33 класс', unit: 'м2', price: 1800, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Паркетная доска дуб', unit: 'м2', price: 3500, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Керамогранит 60х60', unit: 'м2', price: 1500, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Плитка настенная', unit: 'м2', price: 1200, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Мозаика стеклянная', unit: 'м2', price: 3000, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Обои флизелиновые', unit: 'рул', price: 2500, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Обои виниловые', unit: 'рул', price: 1500, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Краска Dulux', unit: 'л', price: 800, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Краска Tikkurila', unit: 'л', price: 1200, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Плинтус МДФ 80мм', unit: 'шт', price: 350, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Плинтус ПВХ 70мм', unit: 'шт', price: 200, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Розетка Legrand Valena', unit: 'шт', price: 450, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Розетка Schneider Unica', unit: 'шт', price: 380, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Выключатель Legrand Valena', unit: 'шт', price: 500, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Светильник точечный LED', unit: 'шт', price: 650, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Светодиодная лента 14.4Вт/м', unit: 'м', price: 250, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Натяжной потолок матовый', unit: 'м2', price: 450, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Натяжной потолок глянцевый', unit: 'м2', price: 550, category: 'Чистовые материалы', type: 'finish' as const },
  { name: 'Дверь межкомнатная', unit: 'шт', price: 8500, category: 'Чистовые материалы', type: 'finish' as const },
];

// Get all price items for organization
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await pool.query(
      `SELECT id, name, unit, price, category, subcategory, type, created_at, updated_at
       FROM price_items
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY category, subcategory, name`,
      [req.user.organizationId]
    );

    // If no prices exist, initialize default prices for this organization from template
    if (result.rows.length === 0) {
      console.log(`Initializing default prices for organization ${req.user.organizationId}`);
      
      // Get default prices from template
      const defaultPricesResult = await pool.query(
        `SELECT name, unit, price, category, subcategory, type
         FROM default_price_items
         ORDER BY sort_order, category, subcategory, name`
      );
      
      if (defaultPricesResult.rows.length === 0) {
        console.warn('No default price items found in template, using hardcoded defaults');
        // Fallback to hardcoded defaults if template is empty
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          for (const price of DEFAULT_PRICES) {
            await client.query(
              `INSERT INTO price_items (organization_id, name, unit, price, category, subcategory, type)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [req.user.organizationId, price.name, price.unit, price.price, price.category, price.subcategory || null, price.type]
            );
          }
          
          await client.query('COMMIT');
          console.log(`✓ Initialized ${DEFAULT_PRICES.length} default prices (fallback)`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } else {
        // Copy from template
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          for (const price of defaultPricesResult.rows) {
            await client.query(
              `INSERT INTO price_items (organization_id, name, unit, price, category, subcategory, type)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [req.user.organizationId, price.name, price.unit, price.price, price.category, price.subcategory || null, price.type]
            );
          }
          
          await client.query('COMMIT');
          console.log(`✓ Initialized ${defaultPricesResult.rows.length} default prices from template`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
      
      // Fetch the newly created prices
      const newResult = await pool.query(
        `SELECT id, name, unit, price, category, subcategory, type, created_at, updated_at
         FROM price_items
         WHERE organization_id = $1 AND deleted_at IS NULL
         ORDER BY category, subcategory, name`,
        [req.user.organizationId]
      );
      
      res.json(newResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        price: parseFloat(row.price),
        category: row.category,
        subcategory: row.subcategory || undefined,
        type: row.type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    } else {
      res.json(result.rows.map(row => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        price: parseFloat(row.price),
        category: row.category,
        subcategory: row.subcategory || undefined,
        type: row.type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    }
  } catch (error) {
    console.error('Get price items error:', error);
    res.status(500).json({ error: 'Failed to fetch price items' });
  }
});

// Create price item (admin only, requires EDIT_PRICES permission)
router.post('/', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createPriceItemSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO price_items (organization_id, name, unit, price, category, subcategory, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, unit, price, category, subcategory, type, created_at, updated_at`,
      [
        req.user.organizationId, 
        body.name || '', 
        body.unit, 
        body.price, 
        body.category, 
        body.subcategory || null, 
        body.type
      ]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create price item error:', error);
    res.status(500).json({ error: 'Failed to create price item' });
  }
});

// Update price item
router.patch('/:id', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const priceItemId = req.params.id;
    const body = updatePriceItemSchema.parse(req.body);

    // Check if price item belongs to organization
    const checkResult = await pool.query(
      'SELECT id FROM price_items WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [priceItemId, req.user.organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }
    if (body.unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(body.unit);
    }
    if (body.price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(body.price);
    }
    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(body.category);
    }
    if (body.subcategory !== undefined) {
      updates.push(`subcategory = $${paramIndex++}`);
      values.push(body.subcategory || null);
    }
    if (body.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(body.type);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(priceItemId, req.user.organizationId);

    const result = await pool.query(
      `UPDATE price_items 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL
       RETURNING id, name, unit, price, category, subcategory, type, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update price item error:', error);
    res.status(500).json({ error: 'Failed to update price item' });
  }
});

// Delete price item (soft delete)
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const priceItemId = req.params.id;

    const result = await pool.query(
      `UPDATE price_items 
       SET deleted_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [priceItemId, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    res.json({ message: 'Price item deleted successfully' });
  } catch (error) {
    console.error('Delete price item error:', error);
    res.status(500).json({ error: 'Failed to delete price item' });
  }
});

export default router;

