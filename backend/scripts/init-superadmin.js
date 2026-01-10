const { Client } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function initSuperadmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'interiorai'}`,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if superadmin already exists
    const existingSuperadmin = await client.query(
      'SELECT id FROM superadmins WHERE username = $1',
      ['ivanovmax']
    );

    if (existingSuperadmin.rows.length > 0) {
      console.log('Superadmin already exists, skipping creation');
    } else {
      // Create superadmin
      const passwordHash = await bcrypt.hash('i7755079', 10);
      await client.query(
        'INSERT INTO superadmins (username, password_hash) VALUES ($1, $2)',
        ['ivanovmax', passwordHash]
      );
      console.log('✓ Created superadmin: ivanovmax');
    }

    // Check if default prices already exist
    const existingPrices = await client.query('SELECT COUNT(*) FROM default_price_items');
    if (parseInt(existingPrices.rows[0].count) > 0) {
      console.log('Default prices already exist, skipping initialization');
    } else {
      // Load default prices from the prices route file
      // We'll insert them manually here
      const defaultPrices = [
        // === РАБОТЫ ===
        // Подготовительные работы (10)
        { name: 'Грунтовка стен', unit: 'м2', price: 150, category: 'Подготовительные работы', type: 'work', sort_order: 1 },
        { name: 'Грунтовка потолка', unit: 'м2', price: 180, category: 'Подготовительные работы', type: 'work', sort_order: 2 },
        { name: 'Грунтовка пола', unit: 'м2', price: 120, category: 'Подготовительные работы', type: 'work', sort_order: 3 },
        { name: 'Обеспыливание поверхностей', unit: 'м2', price: 80, category: 'Подготовительные работы', type: 'work', sort_order: 4 },
        { name: 'Укрытие полов плёнкой', unit: 'м2', price: 50, category: 'Подготовительные работы', type: 'work', sort_order: 5 },
        { name: 'Заделка трещин', unit: 'п.м', price: 200, category: 'Подготовительные работы', type: 'work', sort_order: 6 },
        { name: 'Армирование сеткой', unit: 'м2', price: 250, category: 'Подготовительные работы', type: 'work', sort_order: 7 },
        { name: 'Обработка антисептиком', unit: 'м2', price: 100, category: 'Подготовительные работы', type: 'work', sort_order: 8 },
        { name: 'Установка маяков', unit: 'п.м', price: 150, category: 'Подготовительные работы', type: 'work', sort_order: 9 },
        { name: 'Вынос мусора', unit: 'меш', price: 300, category: 'Подготовительные работы', type: 'work', sort_order: 10 },
        
        // Демонтажные работы (10)
        { name: 'Демонтаж обоев', unit: 'м2', price: 100, category: 'Демонтажные работы', type: 'work', sort_order: 11 },
        { name: 'Демонтаж плитки', unit: 'м2', price: 350, category: 'Демонтажные работы', type: 'work', sort_order: 12 },
        { name: 'Демонтаж ламината', unit: 'м2', price: 150, category: 'Демонтажные работы', type: 'work', sort_order: 13 },
        { name: 'Демонтаж паркета', unit: 'м2', price: 200, category: 'Демонтажные работы', type: 'work', sort_order: 14 },
        { name: 'Демонтаж стяжки', unit: 'м2', price: 450, category: 'Демонтажные работы', type: 'work', sort_order: 15 },
        { name: 'Демонтаж штукатурки', unit: 'м2', price: 300, category: 'Демонтажные работы', type: 'work', sort_order: 16 },
        { name: 'Демонтаж перегородки', unit: 'м2', price: 600, category: 'Демонтажные работы', type: 'work', sort_order: 17 },
        { name: 'Демонтаж дверного блока', unit: 'шт', price: 800, category: 'Демонтажные работы', type: 'work', sort_order: 18 },
        { name: 'Демонтаж подвесного потолка', unit: 'м2', price: 250, category: 'Демонтажные работы', type: 'work', sort_order: 19 },
        { name: 'Демонтаж сантехники', unit: 'шт', price: 500, category: 'Демонтажные работы', type: 'work', sort_order: 20 },
        
        // Черновая электрика (10)
        { name: 'Штробление стен под кабель', unit: 'п.м', price: 250, category: 'Черновая электрика', type: 'work', sort_order: 21 },
        { name: 'Штробление потолка под кабель', unit: 'п.м', price: 300, category: 'Черновая электрика', type: 'work', sort_order: 22 },
        { name: 'Прокладка кабеля в штробе', unit: 'п.м', price: 80, category: 'Черновая электрика', type: 'work', sort_order: 23 },
        { name: 'Прокладка кабеля в гофре', unit: 'п.м', price: 100, category: 'Черновая электрика', type: 'work', sort_order: 24 },
        { name: 'Установка подрозетника', unit: 'шт', price: 200, category: 'Черновая электрика', type: 'work', sort_order: 25 },
        { name: 'Монтаж распределительной коробки', unit: 'шт', price: 350, category: 'Черновая электрика', type: 'work', sort_order: 26 },
        { name: 'Сборка щита (до 12 модулей)', unit: 'шт', price: 3500, category: 'Черновая электрика', type: 'work', sort_order: 27 },
        { name: 'Сборка щита (до 24 модулей)', unit: 'шт', price: 5500, category: 'Черновая электрика', type: 'work', sort_order: 28 },
        { name: 'Прокладка слаботочки', unit: 'п.м', price: 70, category: 'Черновая электрика', type: 'work', sort_order: 29 },
        { name: 'Заземление', unit: 'точка', price: 1500, category: 'Черновая электрика', type: 'work', sort_order: 30 },
        
        // Черновая сантехника (10)
        { name: 'Штробление под трубы', unit: 'п.м', price: 400, category: 'Черновая сантехника', type: 'work', sort_order: 31 },
        { name: 'Монтаж водопровода (полипропилен)', unit: 'точка', price: 1500, category: 'Черновая сантехника', type: 'work', sort_order: 32 },
        { name: 'Монтаж канализации', unit: 'точка', price: 1200, category: 'Черновая сантехника', type: 'work', sort_order: 33 },
        { name: 'Установка коллектора', unit: 'шт', price: 2500, category: 'Черновая сантехника', type: 'work', sort_order: 34 },
        { name: 'Монтаж гидроизоляции пола', unit: 'м2', price: 450, category: 'Черновая сантехника', type: 'work', sort_order: 35 },
        { name: 'Монтаж трапа', unit: 'шт', price: 2000, category: 'Черновая сантехника', type: 'work', sort_order: 36 },
        { name: 'Установка счётчиков воды', unit: 'шт', price: 1000, category: 'Черновая сантехника', type: 'work', sort_order: 37 },
        { name: 'Опрессовка системы', unit: 'шт', price: 2000, category: 'Черновая сантехника', type: 'work', sort_order: 38 },
        { name: 'Монтаж полотенцесушителя', unit: 'шт', price: 2500, category: 'Черновая сантехника', type: 'work', sort_order: 39 },
        { name: 'Подключение бойлера', unit: 'шт', price: 3000, category: 'Черновая сантехника', type: 'work', sort_order: 40 },
        
        // Черновые отделочные работы - Стены
        { name: 'Штукатурка по маякам', unit: 'м2', price: 550, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 41 },
        { name: 'Шпаклёвка стен (под обои)', unit: 'м2', price: 350, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 42 },
        { name: 'Шпаклёвка стен (под покраску)', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 43 },
        { name: 'Монтаж ГКЛ на стены', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 44 },
        { name: 'Грунтовка стен', unit: 'м2', price: 80, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 45 },
        
        // Черновые отделочные работы - Пол
        { name: 'Стяжка пола (до 5 см)', unit: 'м2', price: 500, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 46 },
        { name: 'Стяжка пола (от 5 см)', unit: 'м2', price: 650, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 47 },
        { name: 'Наливной пол', unit: 'м2', price: 350, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 48 },
        { name: 'Гидроизоляция пола', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 49 },
        { name: 'Грунтовка пола', unit: 'м2', price: 60, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 50 },
        
        // Черновые отделочные работы - Потолок
        { name: 'Штукатурка потолка', unit: 'м2', price: 650, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 51 },
        { name: 'Шпаклёвка потолка', unit: 'м2', price: 500, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 52 },
        { name: 'Монтаж ГКЛ на потолок', unit: 'м2', price: 550, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 53 },
        { name: 'Грунтовка потолка', unit: 'м2', price: 80, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 54 },
        
        // Чистовые отделочные работы - Стены
        { name: 'Укладка плитки на стены', unit: 'м2', price: 1400, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 55 },
        { name: 'Поклейка обоев', unit: 'м2', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 56 },
        { name: 'Покраска стен (2 слоя)', unit: 'м2', price: 300, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 57 },
        { name: 'Декоративная штукатурка', unit: 'м2', price: 800, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 58 },
        { name: 'Монтаж стеновых панелей', unit: 'м2', price: 600, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work', sort_order: 59 },
        
        // Чистовые отделочные работы - Пол
        { name: 'Укладка ламината', unit: 'м2', price: 450, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 60 },
        { name: 'Укладка паркетной доски', unit: 'м2', price: 600, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 61 },
        { name: 'Укладка плитки на пол', unit: 'м2', price: 1200, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 62 },
        { name: 'Установка плинтуса', unit: 'п.м', price: 200, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 63 },
        { name: 'Установка порожка', unit: 'шт', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work', sort_order: 64 },
        
        // Чистовые отделочные работы - Потолок
        { name: 'Покраска потолка (2 слоя)', unit: 'м2', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 65 },
        { name: 'Монтаж натяжного потолка', unit: 'м2', price: 800, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 66 },
        { name: 'Монтаж потолочного плинтуса', unit: 'п.м', price: 150, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 67 },
        { name: 'Монтаж реечного потолка', unit: 'м2', price: 700, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work', sort_order: 68 },
        
        // Чистовая сантехника (10)
        { name: 'Установка унитаза', unit: 'шт', price: 2500, category: 'Чистовая сантехника', type: 'work', sort_order: 69 },
        { name: 'Установка раковины', unit: 'шт', price: 2000, category: 'Чистовая сантехника', type: 'work', sort_order: 70 },
        { name: 'Установка ванны', unit: 'шт', price: 4000, category: 'Чистовая сантехника', type: 'work', sort_order: 71 },
        { name: 'Установка душевой кабины', unit: 'шт', price: 5000, category: 'Чистовая сантехника', type: 'work', sort_order: 72 },
        { name: 'Установка смесителя', unit: 'шт', price: 1200, category: 'Чистовая сантехника', type: 'work', sort_order: 73 },
        { name: 'Установка биде', unit: 'шт', price: 2500, category: 'Чистовая сантехника', type: 'work', sort_order: 74 },
        { name: 'Подключение стиральной машины', unit: 'шт', price: 1500, category: 'Чистовая сантехника', type: 'work', sort_order: 75 },
        { name: 'Подключение посудомоечной машины', unit: 'шт', price: 1500, category: 'Чистовая сантехника', type: 'work', sort_order: 76 },
        { name: 'Установка инсталляции', unit: 'шт', price: 4500, category: 'Чистовая сантехника', type: 'work', sort_order: 77 },
        { name: 'Герметизация сантехники', unit: 'шт', price: 500, category: 'Чистовая сантехника', type: 'work', sort_order: 78 },
        
        // Чистовая электрика (10)
        { name: 'Установка розетки', unit: 'шт', price: 350, category: 'Чистовая электрика', type: 'work', sort_order: 79 },
        { name: 'Установка выключателя', unit: 'шт', price: 350, category: 'Чистовая электрика', type: 'work', sort_order: 80 },
        { name: 'Установка светильника накладного', unit: 'шт', price: 500, category: 'Чистовая электрика', type: 'work', sort_order: 81 },
        { name: 'Установка светильника встраиваемого', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work', sort_order: 82 },
        { name: 'Установка люстры', unit: 'шт', price: 1500, category: 'Чистовая электрика', type: 'work', sort_order: 83 },
        { name: 'Монтаж светодиодной ленты', unit: 'п.м', price: 300, category: 'Чистовая электрика', type: 'work', sort_order: 84 },
        { name: 'Установка терморегулятора', unit: 'шт', price: 800, category: 'Чистовая электрика', type: 'work', sort_order: 85 },
        { name: 'Установка датчика движения', unit: 'шт', price: 600, category: 'Чистовая электрика', type: 'work', sort_order: 86 },
        { name: 'Установка TV-розетки', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work', sort_order: 87 },
        { name: 'Установка интернет-розетки', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work', sort_order: 88 },
        
        // === ЧЕРНОВЫЕ МАТЕРИАЛЫ (20) ===
        { name: 'Грунтовка Ceresit CT 17', unit: 'л', price: 350, category: 'Черновые материалы', type: 'rough', sort_order: 89 },
        { name: 'Бетон-контакт Knauf', unit: 'кг', price: 200, category: 'Черновые материалы', type: 'rough', sort_order: 90 },
        { name: 'Штукатурка Knauf MP-75', unit: 'меш', price: 450, category: 'Черновые материалы', type: 'rough', sort_order: 91 },
        { name: 'Штукатурка Knauf Rotband', unit: 'меш', price: 550, category: 'Черновые материалы', type: 'rough', sort_order: 92 },
        { name: 'Шпаклёвка Vetonit LR+', unit: 'меш', price: 850, category: 'Черновые материалы', type: 'rough', sort_order: 93 },
        { name: 'Шпаклёвка Knauf Fugen', unit: 'меш', price: 450, category: 'Черновые материалы', type: 'rough', sort_order: 94 },
        { name: 'Пескобетон М300', unit: 'меш', price: 200, category: 'Черновые материалы', type: 'rough', sort_order: 95 },
        { name: 'Наливной пол Vetonit 3000', unit: 'меш', price: 650, category: 'Черновые материалы', type: 'rough', sort_order: 96 },
        { name: 'ГКЛ Knauf 12.5мм', unit: 'лист', price: 450, category: 'Черновые материалы', type: 'rough', sort_order: 97 },
        { name: 'ГКЛВ Knauf 12.5мм', unit: 'лист', price: 550, category: 'Черновые материалы', type: 'rough', sort_order: 98 },
        { name: 'Профиль ПН 27х28', unit: 'шт', price: 120, category: 'Черновые материалы', type: 'rough', sort_order: 99 },
        { name: 'Профиль ПП 60х27', unit: 'шт', price: 180, category: 'Черновые материалы', type: 'rough', sort_order: 100 },
        { name: 'Подвес прямой', unit: 'шт', price: 15, category: 'Черновые материалы', type: 'rough', sort_order: 101 },
        { name: 'Кабель ВВГнг 3х2.5', unit: 'м', price: 80, category: 'Черновые материалы', type: 'rough', sort_order: 102 },
        { name: 'Кабель ВВГнг 3х1.5', unit: 'м', price: 55, category: 'Черновые материалы', type: 'rough', sort_order: 103 },
        { name: 'Гофра ПВХ 20мм', unit: 'м', price: 25, category: 'Черновые материалы', type: 'rough', sort_order: 104 },
        { name: 'Труба PPR 20мм', unit: 'м', price: 80, category: 'Черновые материалы', type: 'rough', sort_order: 105 },
        { name: 'Труба канализационная 50мм', unit: 'м', price: 150, category: 'Черновые материалы', type: 'rough', sort_order: 106 },
        { name: 'Гидроизоляция Ceresit CL 51', unit: 'кг', price: 450, category: 'Черновые материалы', type: 'rough', sort_order: 107 },
        { name: 'Сетка армирующая', unit: 'м2', price: 120, category: 'Черновые материалы', type: 'rough', sort_order: 108 },
        
        // === ЧИСТОВЫЕ МАТЕРИАЛЫ (20) ===
        { name: 'Ламинат Tarkett 32 класс', unit: 'м2', price: 1200, category: 'Чистовые материалы', type: 'finish', sort_order: 109 },
        { name: 'Ламинат Quick-Step 33 класс', unit: 'м2', price: 1800, category: 'Чистовые материалы', type: 'finish', sort_order: 110 },
        { name: 'Паркетная доска дуб', unit: 'м2', price: 3500, category: 'Чистовые материалы', type: 'finish', sort_order: 111 },
        { name: 'Керамогранит 60х60', unit: 'м2', price: 1500, category: 'Чистовые материалы', type: 'finish', sort_order: 112 },
        { name: 'Плитка настенная', unit: 'м2', price: 1200, category: 'Чистовые материалы', type: 'finish', sort_order: 113 },
        { name: 'Мозаика стеклянная', unit: 'м2', price: 3000, category: 'Чистовые материалы', type: 'finish', sort_order: 114 },
        { name: 'Обои флизелиновые', unit: 'рул', price: 2500, category: 'Чистовые материалы', type: 'finish', sort_order: 115 },
        { name: 'Обои виниловые', unit: 'рул', price: 1500, category: 'Чистовые материалы', type: 'finish', sort_order: 116 },
        { name: 'Краска Dulux', unit: 'л', price: 800, category: 'Чистовые материалы', type: 'finish', sort_order: 117 },
        { name: 'Краска Tikkurila', unit: 'л', price: 1200, category: 'Чистовые материалы', type: 'finish', sort_order: 118 },
        { name: 'Плинтус МДФ 80мм', unit: 'шт', price: 350, category: 'Чистовые материалы', type: 'finish', sort_order: 119 },
        { name: 'Плинтус ПВХ 70мм', unit: 'шт', price: 200, category: 'Чистовые материалы', type: 'finish', sort_order: 120 },
        { name: 'Розетка Legrand Valena', unit: 'шт', price: 450, category: 'Чистовые материалы', type: 'finish', sort_order: 121 },
        { name: 'Розетка Schneider Unica', unit: 'шт', price: 380, category: 'Чистовые материалы', type: 'finish', sort_order: 122 },
        { name: 'Выключатель Legrand Valena', unit: 'шт', price: 500, category: 'Чистовые материалы', type: 'finish', sort_order: 123 },
        { name: 'Светильник точечный LED', unit: 'шт', price: 650, category: 'Чистовые материалы', type: 'finish', sort_order: 124 },
        { name: 'Светодиодная лента 14.4Вт/м', unit: 'м', price: 250, category: 'Чистовые материалы', type: 'finish', sort_order: 125 },
        { name: 'Натяжной потолок матовый', unit: 'м2', price: 450, category: 'Чистовые материалы', type: 'finish', sort_order: 126 },
        { name: 'Натяжной потолок глянцевый', unit: 'м2', price: 550, category: 'Чистовые материалы', type: 'finish', sort_order: 127 },
        { name: 'Дверь межкомнатная', unit: 'шт', price: 8500, category: 'Чистовые материалы', type: 'finish', sort_order: 128 },
      ];

      await client.query('BEGIN');
      for (const price of defaultPrices) {
        await client.query(
          `INSERT INTO default_price_items (name, unit, price, category, subcategory, type, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [price.name, price.unit, price.price, price.category, price.subcategory || null, price.type, price.sort_order]
        );
      }
      await client.query('COMMIT');
      console.log(`✓ Initialized ${defaultPrices.length} default price items`);
    }

    console.log('Superadmin initialization completed');
  } catch (error) {
    console.error('Error initializing superadmin:', error);
    throw error; // Re-throw to signal failure
  } finally {
    await client.end();
  }
}

// Run and handle errors
initSuperadmin().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

