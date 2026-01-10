const bcrypt = require('bcrypt');

/**
 * Initialize superadmin and default prices using existing DB connection
 * @param {import('pg').Client} client - PostgreSQL client
 */
async function initSuperadmin(client) {
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
    return;
  }

  // Default prices array
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
    
    // Simplified - just essential items to keep file small
    // Full list can be added later via superadmin panel
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

module.exports = initSuperadmin;

