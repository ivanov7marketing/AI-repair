import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Используем stealth плагин для обхода защиты от ботов
puppeteer.use(StealthPlugin());

export interface SupplierSearchResult {
  supplier: string;
  url: string;
  price: number;
  name: string;
}

export interface MaterialSearchResult {
  materialId: string;
  materialName: string;
  results: SupplierSearchResult[];
  bestPrice?: SupplierSearchResult;
}

/**
 * Извлечение названия поставщика из URL
 */
function getSupplierName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Убираем www. и региональные поддомены
    const parts = hostname.replace('www.', '').split('.');
    // Берем основное имя домена
    if (parts.length >= 2) {
      const mainPart = parts[parts.length - 2];
      // Капитализируем первую букву
      return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    }
    return hostname;
  } catch {
    return 'Неизвестный поставщик';
  }
}

/**
 * Генерация поискового URL для сайта
 */
function getSearchUrl(baseUrl: string, query: string): string {
  const encodedQuery = encodeURIComponent(query);
  const url = new URL(baseUrl);
  const hostname = url.hostname.toLowerCase();

  // Определяем формат поискового URL для известных сайтов
  if (hostname.includes('saturn.net')) {
    return `${baseUrl.replace(/\/$/, '')}/search/?q=${encodedQuery}`;
  }
  if (hostname.includes('lemanapro.ru') || hostname.includes('leroymerlin')) {
    return `${baseUrl.replace(/\/$/, '')}/search/?q=${encodedQuery}`;
  }
  if (hostname.includes('sdvor.com')) {
    return `${baseUrl.replace(/\/$/, '')}/search/?q=${encodedQuery}`;
  }
  if (hostname.includes('petrovich.ru')) {
    return `${baseUrl.replace(/\/$/, '')}/search/?q=${encodedQuery}`;
  }
  if (hostname.includes('maxidom.ru')) {
    return `${baseUrl.replace(/\/$/, '')}/search/?q=${encodedQuery}`;
  }
  if (hostname.includes('obi.ru')) {
    return `${baseUrl.replace(/\/$/, '')}/search/${encodedQuery}/`;
  }

  // Общий формат для неизвестных сайтов
  return `${baseUrl.replace(/\/$/, '')}/search?q=${encodedQuery}`;
}

/**
 * Парсинг результатов поиска с помощью Cheerio (для простых страниц)
 */
async function parseSearchResultsSimple(searchUrl: string): Promise<Array<{ name: string; price: number; url: string }>> {
  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const results: Array<{ name: string; price: number; url: string }> = [];

    // Универсальные селекторы для поиска товаров
    const productSelectors = [
      // Общие селекторы карточек товаров
      '[data-product]',
      '.product-card',
      '.product-item',
      '.catalog-item',
      '.goods-item',
      '.search-result-item',
      '.product',
      '[itemtype*="Product"]',
      '.card-product',
      '.product-tile',
    ];

    const priceSelectors = [
      '[data-price]',
      '.price',
      '.product-price',
      '.price-value',
      '.current-price',
      '.sale-price',
      '[itemprop="price"]',
      '.price-current',
      '.product__price',
      '.goods-price',
    ];

    const nameSelectors = [
      '[data-name]',
      '.product-name',
      '.product-title',
      '.goods-name',
      '.title',
      '[itemprop="name"]',
      '.card-title',
      'h3',
      'h4',
      '.name',
    ];

    const linkSelectors = [
      'a[href*="/product"]',
      'a[href*="/catalog"]',
      'a[href*="/goods"]',
      'a.product-link',
      'a.card-link',
      '.product-card a',
      'a[itemprop="url"]',
    ];

    // Пробуем найти товары по селекторам
    for (const productSelector of productSelectors) {
      const products = $(productSelector);
      if (products.length > 0) {
        products.slice(0, 5).each((_, el) => {
          const $product = $(el);
          
          let name = '';
          for (const nameSelector of nameSelectors) {
            const nameEl = $product.find(nameSelector).first();
            if (nameEl.length > 0) {
              name = nameEl.text().trim();
              if (name) break;
            }
          }

          let price = 0;
          for (const priceSelector of priceSelectors) {
            const priceEl = $product.find(priceSelector).first();
            if (priceEl.length > 0) {
              const priceText = priceEl.text().trim() || priceEl.attr('data-price') || priceEl.attr('content') || '';
              const priceMatch = priceText.replace(/\s/g, '').match(/[\d,.]+/);
              if (priceMatch) {
                price = parseFloat(priceMatch[0].replace(',', '.'));
                if (price > 0) break;
              }
            }
          }

          let url = '';
          for (const linkSelector of linkSelectors) {
            const linkEl = $product.find(linkSelector).first();
            if (linkEl.length > 0) {
              url = linkEl.attr('href') || '';
              if (url) break;
            }
          }
          // Если не нашли ссылку внутри, пробуем сам элемент
          if (!url && $product.is('a')) {
            url = $product.attr('href') || '';
          }

          if (name && price > 0) {
            // Нормализуем URL
            if (url && !url.startsWith('http')) {
              const baseUrl = new URL(searchUrl);
              url = `${baseUrl.origin}${url.startsWith('/') ? '' : '/'}${url}`;
            }
            results.push({ name, price, url: url || searchUrl });
          }
        });
        
        if (results.length > 0) break;
      }
    }

    return results;
  } catch (error) {
    console.error('Simple parsing error:', error);
    return [];
  }
}

/**
 * Парсинг результатов поиска с помощью Puppeteer (для динамических страниц)
 * Получаем HTML после рендеринга JavaScript, затем парсим через Cheerio
 */
async function parseSearchResultsPuppeteer(searchUrl: string): Promise<Array<{ name: string; price: number; url: string }>> {
  // Пробуем разные пути к Chromium
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  
  let browser;
  let lastError: Error | null = null;
  
  // Пробуем запустить с разными путями
  for (const executablePath of possiblePaths) {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: executablePath || undefined,
      });
      break; // Успешно запустили
    } catch (error: any) {
      lastError = error;
      console.log(`Failed to launch with ${executablePath}, trying next...`);
      continue;
    }
  }
  
  // Если не удалось запустить ни с одним путем, пробуем без указания пути
  if (!browser) {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    } catch (error: any) {
      console.error('Failed to launch Puppeteer with all paths:', lastError || error);
      return [];
    }
  }
  
  try {

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Ждем загрузки контента
    await page.waitForSelector('body', { timeout: 5000 });

    // Получаем HTML после рендеринга JavaScript
    const html = await page.content();
    
    // Парсим через Cheerio
    const $ = cheerio.load(html);
    const results: Array<{ name: string; price: number; url: string }> = [];
    const baseUrl = new URL(searchUrl);

    // Универсальные селекторы для поиска товаров
    const productSelectors = [
      '[data-product]',
      '.product-card',
      '.product-item',
      '.catalog-item',
      '.goods-item',
      '.search-result-item',
      '.product',
      '[itemtype*="Product"]',
      '.card-product',
      '.product-tile',
    ];

    const priceSelectors = [
      '[data-price]',
      '.price',
      '.product-price',
      '.price-value',
      '.current-price',
      '.sale-price',
      '[itemprop="price"]',
      '.price-current',
      '.product__price',
      '.goods-price',
    ];

    const nameSelectors = [
      '[data-name]',
      '.product-name',
      '.product-title',
      '.goods-name',
      '.title',
      '[itemprop="name"]',
      '.card-title',
      'h3',
      'h4',
      '.name',
    ];

    const linkSelectors = [
      'a[href*="/product"]',
      'a[href*="/catalog"]',
      'a[href*="/goods"]',
      'a.product-link',
      'a.card-link',
      '.product-card a',
      'a[itemprop="url"]',
    ];

    // Пробуем найти товары по селекторам
    for (const productSelector of productSelectors) {
      const products = $(productSelector);
      if (products.length > 0) {
        products.slice(0, 5).each((_, el) => {
          const $product = $(el);
          
          let name = '';
          for (const nameSelector of nameSelectors) {
            const nameEl = $product.find(nameSelector).first();
            if (nameEl.length > 0) {
              name = nameEl.text().trim();
              if (name) break;
            }
          }

          let price = 0;
          for (const priceSelector of priceSelectors) {
            const priceEl = $product.find(priceSelector).first();
            if (priceEl.length > 0) {
              const priceText = priceEl.text().trim() || priceEl.attr('data-price') || priceEl.attr('content') || '';
              const priceMatch = priceText.replace(/\s/g, '').match(/[\d,.]+/);
              if (priceMatch) {
                price = parseFloat(priceMatch[0].replace(',', '.'));
                if (price > 0) break;
              }
            }
          }

          let url = '';
          for (const linkSelector of linkSelectors) {
            const linkEl = $product.find(linkSelector).first();
            if (linkEl.length > 0) {
              url = linkEl.attr('href') || '';
              if (url) break;
            }
          }
          // Если не нашли ссылку внутри, пробуем сам элемент
          if (!url && $product.is('a')) {
            url = $product.attr('href') || '';
          }

          if (name && price > 0) {
            // Нормализуем URL
            if (url && !url.startsWith('http')) {
              url = `${baseUrl.origin}${url.startsWith('/') ? '' : '/'}${url}`;
            }
            results.push({ name, price, url: url || searchUrl });
          }
        });
        
        if (results.length > 0) break;
      }
    }

    return results;
  } catch (error) {
    console.error('Puppeteer parsing error:', error);
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

/**
 * Проверка, является ли URL прямой ссылкой на товар (а не на поиск)
 */
function isProductUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  // Исключаем страницы поиска
  if (urlLower.includes('/search') || urlLower.includes('?q=') || urlLower.includes('&q=')) {
    return false;
  }
  
  // Проверяем индикаторы товара
  const productIndicators = [
    '/product/',
    '/goods/',
    '/catalog/',
    '/item/',
    '/p/',
    '/tovar/',
    '/product-',
    '/goods-',
    'product_id=',
    'item_id=',
    'goods_id=',
    'id=',
    'art=',
    'article=',
  ];
  
  return productIndicators.some(indicator => urlLower.includes(indicator));
}

/**
 * Поиск товара на сайте поставщика
 */
async function searchOnSupplier(
  materialName: string,
  supplierUrl: string
): Promise<SupplierSearchResult[]> {
  const supplierName = getSupplierName(supplierUrl);
  
  // Если это прямая ссылка на товар, используем parsePrice (более надежный метод)
  if (isProductUrl(supplierUrl)) {
    try {
      const { parsePrice } = await import('./priceParser');
      const parsed = await parsePrice(supplierUrl);
      
      if (parsed.price > 0) {
        return [{
          supplier: parsed.supplierName || supplierName,
          url: supplierUrl,
          price: parsed.price,
          name: materialName
        }];
      }
    } catch (error) {
      // Если не удалось распарсить прямую ссылку, пробуем поиск
      // Но не логируем ошибку, чтобы не превысить лимит Railway
    }
  }
  
  // Если это не прямая ссылка или парсинг не удался, используем поиск
  const searchUrl = getSearchUrl(supplierUrl, materialName);
  
  // Сначала пробуем простой парсинг (быстрее)
  let results = await parseSearchResultsSimple(searchUrl);
  
  // Если не нашли, пробуем Puppeteer с stealth режимом (для динамических страниц и обхода защиты)
  if (results.length === 0) {
    results = await parseSearchResultsPuppeteer(searchUrl);
  }

  return results.map(r => ({
    supplier: supplierName,
    url: r.url,
    price: r.price,
    name: r.name
  }));
}

/**
 * Массовый поиск цен для списка материалов
 */
export async function bulkSearchPrices(
  materials: Array<{ id: string; name: string }>,
  supplierUrls: string[],
  onProgress?: (current: number, total: number) => void
): Promise<MaterialSearchResult[]> {
  const results: MaterialSearchResult[] = [];
  const total = materials.length;

  // Обрабатываем материалы последовательно (чтобы не перегружать сайты)
  for (let i = 0; i < total; i++) {
    const material = materials[i];
    
    try {
      const allResults: SupplierSearchResult[] = [];
      
      // Ищем на каждом сайте поставщика
      for (const supplierUrl of supplierUrls) {
        try {
          const supplierResults = await searchOnSupplier(material.name, supplierUrl);
          allResults.push(...supplierResults);
        } catch (error) {
          // Тихая ошибка для отдельных поставщиков (не логируем, чтобы не превысить лимит Railway)
          continue;
        }
      }

      // Выбираем лучшую цену (минимальную)
      const bestPrice = allResults.length > 0
        ? allResults.reduce((best, current) => 
            current.price < best.price ? current : best
          )
        : undefined;

      results.push({
        materialId: material.id,
        materialName: material.name,
        results: allResults,
        bestPrice
      });

    } catch (error) {
      // Тихая ошибка (не логируем)
      results.push({
        materialId: material.id,
        materialName: material.name,
        results: [],
        bestPrice: undefined
      });
    }

    // Вызываем callback прогресса (только каждые 5 материалов, чтобы не превысить лимит)
    if (onProgress && (i % 5 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }

    // Небольшая задержка между запросами
    if (i < total - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Поиск цены для одного материала
 */
export async function searchMaterialPrice(
  materialName: string,
  supplierUrls: string[]
): Promise<SupplierSearchResult[]> {
  const allResults: SupplierSearchResult[] = [];
  
  for (const supplierUrl of supplierUrls) {
    try {
      const results = await searchOnSupplier(materialName, supplierUrl);
      allResults.push(...results);
    } catch (error) {
      console.error(`Error searching on ${supplierUrl}:`, error);
    }
  }

  return allResults;
}
