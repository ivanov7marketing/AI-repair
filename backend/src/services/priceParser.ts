import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { AI_CONFIG, isAIParsingEnabled } from '../config/aiConfig';
import { extractPriceWithAI, AIExtractionResult } from './aiPriceExtractor';
import { simplifyHTML } from './htmlSimplifier';
import * as fs from 'fs';

// Используем stealth плагин для обхода защиты от ботов (для fallback)
puppeteer.use(StealthPlugin());

/**
 * Поиск пути к Chromium на системе (или использование bundled версии от Puppeteer)
 */
function findChromiumPath(): string | undefined {
  // Если указан путь в env - используем его
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      console.log(`[Puppeteer] Using env path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }
  
  // Puppeteer сам найдет свой bundled Chromium
  console.log('[Puppeteer] Using Puppeteer bundled Chromium');
  return undefined;
}

export interface ParsedPrice {
  price: number;
  currency?: string;
  supplierName?: string;
  confidence?: number;
  source?: 'ai' | 'http' | 'puppeteer';
}

// ============================================================================
// КЭШИРОВАНИЕ
// ============================================================================

interface CacheEntry {
  price: ParsedPrice;
  timestamp: number;
}

// In-memory кэш для цен
const priceCache = new Map<string, CacheEntry>();

/**
 * Получить цену из кэша (если не истекла)
 */
function getCachedPrice(url: string): ParsedPrice | null {
  const entry = priceCache.get(url);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > AI_CONFIG.CACHE_DURATION_MS) {
    // Кэш истек
    priceCache.delete(url);
    return null;
  }
  
  return entry.price;
}

/**
 * Сохранить цену в кэш
 */
function setCachedPrice(url: string, price: ParsedPrice): void {
  priceCache.set(url, {
    price,
    timestamp: Date.now(),
  });
}

/**
 * Очистить истекшие записи кэша (вызывать периодически)
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [url, entry] of priceCache.entries()) {
    if (now - entry.timestamp > AI_CONFIG.CACHE_DURATION_MS) {
      priceCache.delete(url);
    }
  }
}

// Периодическая очистка кэша (каждый час)
setInterval(clearExpiredCache, 60 * 60 * 1000);

// ============================================================================
// ВАЛИДАЦИЯ И УТИЛИТЫ
// ============================================================================

// Разрешенные домены для парсинга
const ALLOWED_DOMAINS = [
  'chel.saturn.net',
  'chelyabinsk.lemanapro.ru',
  'sdvor.com',
  'saturn.net',
  'lemanapro.ru'
];

/**
 * Валидация URL перед парсингом
 */
function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Нормализация цены - извлечение числа из строки
 */
function normalizePrice(priceText: string): number | null {
  if (!priceText) return null;
  
  // Ищем паттерн цены: число с возможными пробелами между тысячами
  // Примеры: "2 359", "2359", "2,359.00", "603"
  const priceMatch = priceText.match(/(\d{1,3}(?:[\s\u00a0]\d{3})*(?:[.,]\d{1,2})?)/);
  
  if (!priceMatch) {
    // Fallback: просто первое число
    const simpleMatch = priceText.match(/(\d+)/);
    if (simpleMatch) {
      return parseInt(simpleMatch[1], 10);
    }
    return null;
  }
  
  // Удаляем пробелы (разделители тысяч)
  let cleaned = priceMatch[1].replace(/[\s\u00a0]/g, '');
  
  // Заменяем запятую на точку
  cleaned = cleaned.replace(',', '.');
  
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

/**
 * Определение названия поставщика из URL
 */
function getSupplierNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('saturn')) {
      return 'Сатурн';
    } else if (urlObj.hostname.includes('lemanapro')) {
      return 'Лемана Про';
    } else if (urlObj.hostname.includes('sdvor')) {
      return 'Стройдвор';
    }
    return '';
  } catch {
    return '';
  }
}

// ============================================================================
// AI ПАРСИНГ (ОСНОВНОЙ МЕТОД)
// ============================================================================

/**
 * Парсинг цены через AI
 */
async function parseWithAI(url: string): Promise<ParsedPrice | null> {
  try {
    console.log(`[parseWithAI] Fetching URL: ${url}`);
    
    // Сначала получаем HTML через HTTP
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      }
    });

    if (!response.data || typeof response.data !== 'string') {
      console.warn('[parseWithAI] Empty or invalid HTML response');
      return null;
    }
    
    const html = response.data;
    console.log(`[parseWithAI] Received HTML: ${html.length} chars`);
    
    // Проверяем на блокировку (более точная проверка)
    const isBlocked = (
      html.includes('__qrator/qauth.js') ||
      html.includes('<title>Access denied</title>') ||
      html.includes('<title>Доступ запрещен</title>') ||
      (html.includes('captcha') && html.length < 5000)
    );
    
    if (isBlocked) {
      console.warn('[parseWithAI] Page blocked by anti-bot protection');
      return null;
    }
    
    // Ищем признаки того, что это страница товара
    const hasProductInfo = html.includes('itemprop="price"') || 
                          html.includes('data-price') ||
                          html.includes('product-price') ||
                          html.includes('В корзину') ||
                          html.includes('Купить');
    
    if (!hasProductInfo) {
      console.warn('[parseWithAI] Page does not appear to be a product page');
    }

    // Извлекаем цену через AI
    const aiResult = await extractPriceWithAI(html, url);
    
    if (aiResult && aiResult.price > 0 && aiResult.confidence >= AI_CONFIG.CONFIDENCE_THRESHOLD) {
      // Дополнительная проверка: цена должна быть разумной (больше 50 руб для стройматериалов)
      if (aiResult.price < 50) {
        console.warn(`[parseWithAI] Price too low (${aiResult.price}), might be incorrect`);
      }
      
      return {
        price: aiResult.price,
        currency: aiResult.currency,
        supplierName: getSupplierNameFromUrl(url),
        confidence: aiResult.confidence,
        source: 'ai',
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('[parseWithAI] Failed:', error.message);
    return null;
  }
}

// ============================================================================
// HTTP ПАРСИНГ (FALLBACK)
// ============================================================================

/**
 * Попытка парсинга цены через HTTP запрос и cheerio (fallback)
 */
async function parseWithHttp(url: string): Promise<ParsedPrice | null> {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const urlObjHttp = new URL(url);
    const isSaturn = urlObjHttp.hostname.includes('saturn');
    
    let priceText: string | null = null;

    // Специфичные селекторы для Saturn
    if (isSaturn) {
      // Saturn: ИСКЛЮЧАЕМ элементы с классом search (цены других товаров)
      // Ищем цену "с картой" в основном блоке товара
      
      // Ищем текст "С картой" рядом с ценой
      const fullText = $.html();
      const cardPriceMatch = fullText.match(/С\s*картой[^<]*?(\d{1,3}(?:[\s\u00a0]\d{3})*)\s*₽/i);
      if (cardPriceMatch) {
        const priceNum = parseFloat(cardPriceMatch[1].replace(/[\s\u00a0]/g, ''));
        if (priceNum > 100 && priceNum < 100000) {
          priceText = cardPriceMatch[1];
          console.log(`[HTTP Saturn] Found "С картой" price: ${priceNum}`);
        }
      }
      
      // Если не нашли, ищем в блоках НЕ связанных с поиском
      if (!priceText) {
        // Исключаем элементы с search в классе
        const priceElements = $('[data-price]').not('[class*="search"]').not('[class*="Search"]');
        
        // Собираем все цены и берем самую большую (основная цена товара обычно больше скидочных)
        const prices: number[] = [];
        
        priceElements.each((_, el) => {
          const dataPrice = $(el).attr('data-price');
          if (dataPrice) {
            const priceNum = parseFloat(dataPrice);
            if (priceNum > 500 && priceNum < 100000) { // Основная цена обычно > 500₽
              prices.push(priceNum);
            }
          }
        });
        
        if (prices.length > 0) {
          // Берем максимальную цену (основная цена товара)
          const maxPrice = Math.max(...prices);
          priceText = String(maxPrice);
          console.log(`[HTTP Saturn] Found prices without search: ${prices.join(', ')}. Selected max: ${maxPrice}`);
        }
      }
      
      // Последний fallback: ищем паттерн "X XXX ₽" с большой ценой
      if (!priceText) {
        const priceMatches = fullText.match(/(\d{1,2}\s?\d{3})\s*₽/g);
        if (priceMatches) {
          const prices = priceMatches
            .map(m => {
              const numMatch = m.match(/(\d{1,2}\s?\d{3})/);
              return numMatch ? parseFloat(numMatch[1].replace(/\s/g, '')) : 0;
            })
            .filter(p => p > 1000 && p < 50000); // Цены стройматериалов обычно 1000-50000₽
          
          if (prices.length > 0) {
            // Ищем цену около 2000-3000 (типичная цена для грунтовок)
            const mainPrice = prices.find(p => p > 2000 && p < 5000) || prices[0];
            priceText = String(mainPrice);
            console.log(`[HTTP Saturn] Fallback prices: ${prices.join(', ')}. Selected: ${mainPrice}`);
          }
        }
      }
    }
    
    // Распространенные селекторы для цен
    if (!priceText) {
      const priceSelectors = [
        '[itemprop="price"]',   // Microdata - самый надежный
        '[data-price]',         // Data-атрибут с ценой
        '.product-price__value',
        '.price-value',
        '.price__value',
        '.current-price',
        '.price-current',
        '.product-price',
        '.goods-price',
        '.product__price',
        '.price',
      ];

      for (const selector of priceSelectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          // Приоритет: data-price > content > text
          const dataPrice = element.attr('data-price');
          const content = element.attr('content');
          let text = element.text().trim();
          
          // Если текст слишком длинный, это не просто цена
          if (text.length > 50) {
            text = '';
          }
          
          const rawValue = dataPrice || content || text || null;
          
          if (rawValue) {
            const priceNum = normalizePrice(rawValue);
            // Проверяем разумный диапазон цены
            if (priceNum && priceNum > 10 && priceNum < 1000000) {
              priceText = rawValue;
              console.log(`[HTTP] Found price via selector "${selector}": ${priceNum}`);
              break;
            }
          }
        }
      }
    }

    // Поиск по тексту "₽" или "руб" - более строгий паттерн
    if (!priceText) {
      // Ищем цену в формате "XXX ₽" или "X XXX ₽" или "XX XXX руб"
      // НЕ захватываем артикулы и другие числа
      const priceRegex = /(\d{1,3}(?:[\s\u00a0]\d{3})*)\s*[₽р]/gi;
      const matches = Array.from(response.data.matchAll(priceRegex)) as RegExpMatchArray[];
      
      // Фильтруем и сортируем цены
      const prices = matches
        .map((m: RegExpMatchArray) => ({
          text: m[1],
          value: parseFloat(m[1].replace(/[\s\u00a0]/g, ''))
        }))
        .filter(p => p.value > 50 && p.value < 1000000) // Разумный диапазон цен
        .sort((a, b) => a.value - b.value); // Сортируем по возрастанию
      
      // Берем минимальную разумную цену (не самую маленькую, но и не артикул)
      if (prices.length > 0) {
        // Если есть цены < 10000, берем первую из них (вероятно основная цена товара)
        const reasonablePrice = prices.find(p => p.value < 10000) || prices[0];
        priceText = reasonablePrice.text;
        console.log(`[HTTP] Found prices: ${prices.map(p => p.value).join(', ')}. Selected: ${reasonablePrice.value}`);
      }
    }

    if (!priceText) {
      return null;
    }

    const price = normalizePrice(priceText);
    if (!price) {
      return null;
    }

    return {
      price,
      currency: 'RUB',
      supplierName: getSupplierNameFromUrl(url),
      source: 'http',
    };
  } catch (error) {
    console.error('HTTP parsing failed:', error);
    return null;
  }
}

// ============================================================================
// PUPPETEER ПАРСИНГ (ПОСЛЕДНИЙ FALLBACK)
// ============================================================================

/**
 * Парсинг цены через Puppeteer для динамических сайтов (последний fallback)
 */
async function parseWithPuppeteer(url: string): Promise<ParsedPrice | null> {
  let browser;
  try {
    // Ищем путь к Chromium
    const chromiumPath = findChromiumPath();
    
    const launchOptions: any = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    };
    
    if (chromiumPath) {
      launchOptions.executablePath = chromiumPath;
    }
    
    try {
      browser = await puppeteer.launch(launchOptions);
      console.log('[Puppeteer] Browser launched successfully');
    } catch (error: any) {
      console.error('[Puppeteer] Failed to launch with path, trying without:', error.message);
      // Пробуем без указания пути
      delete launchOptions.executablePath;
      try {
        browser = await puppeteer.launch(launchOptions);
        console.log('[Puppeteer] Browser launched with default path');
      } catch (error2: any) {
        console.error('[Puppeteer] Failed to launch browser:', error2.message);
        return null;
      }
    }

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.evaluateOnNewDocument(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
    
    const urlObjPuppeteer = new URL(url);
    const isSaturn = urlObjPuppeteer.hostname.includes('saturn');
    const isLemana = urlObjPuppeteer.hostname.includes('lemanapro');
    
    // Для Lemanapro нужно больше времени для прохождения Qrator защиты
    const timeout = isLemana ? 60000 : 30000;
    const waitTime = isLemana ? 5000 : 3000;
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout });
    await page.waitForTimeout(waitTime);
    
    // Для Lemanapro дополнительно ждём появления цены
    if (isLemana) {
      try {
        await page.waitForSelector('[data-testid="product-price"], .price, [class*="Price"]', { timeout: 10000 });
      } catch (e) {
        console.log('[Lemanapro] Price selector not found, continuing...');
      }
    }

    let priceText: string | null = null;

    // Специфичная логика для Lemanapro
    if (isLemana) {
      try {
        priceText = await page.evaluate(() => {
          // Lemanapro специфичные селекторы
          const priceSelectors = [
            '[data-testid="product-price"]',
            '[class*="Price"]',
            '[class*="price"]',
            '.product-price',
            '[itemprop="price"]'
          ];
          
          for (const selector of priceSelectors) {
            // @ts-ignore
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const text = el.textContent?.trim() || '';
              // Ищем цену в формате "205 ₽/шт" или "205₽" или просто "205"
              const match = text.match(/(\d{1,3}(?:[\s\u00a0]?\d{3})*)\s*[₽Р]?/);
              if (match) {
                const priceNum = parseFloat(match[1].replace(/[\s\u00a0]/g, ''));
                if (priceNum > 10 && priceNum < 1000000) {
                  return match[1];
                }
              }
            }
          }
          
          // Fallback: ищем в body текст
          // @ts-ignore
          const bodyText = document.body.innerText;
          const priceMatch = bodyText.match(/(\d{1,3}(?:[\s\u00a0]?\d{3})*)\s*[₽Р]\/шт/);
          if (priceMatch) {
            return priceMatch[1];
          }
          
          return null;
        });
        
        if (priceText) {
          console.log(`[Puppeteer Lemanapro] Found price: ${priceText}`);
        }
      } catch (e) {
        console.error('Lemanapro-specific parsing failed:', e);
      }
    }

    // Специфичная логика для Saturn
    if (isSaturn && !priceText) {
      try {
        priceText = await page.evaluate(() => {
          const priceSelectors = [
            '[class*="price"]',
            '[data-price]',
            '.product-price',
            '.price-value',
            '[itemprop="price"]'
          ];
          
          for (const selector of priceSelectors) {
            // @ts-ignore
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const text = el.textContent?.trim() || '';
              const match = text.match(/(\d{1,3}(?:\s?\d{3})*)\s*[₽руб]/);
              if (match) {
                const priceNum = parseFloat(match[1].replace(/\s/g, ''));
                if (priceNum > 100) {
                  return match[1];
                }
              }
            }
          }
          
          // @ts-ignore
          const bodyText = document.body.innerText;
          const priceRegex = /(\d{1,3}(?:\s?\d{3})*)\s*[₽руб]/g;
          // @ts-ignore
          const matches = Array.from(bodyText.matchAll(priceRegex)) as RegExpMatchArray[];
          let maxPrice = 0;
          let bestMatch: string | null = null;
          for (const match of matches) {
            const priceNum = parseFloat(match[1].replace(/\s/g, ''));
            if (priceNum > maxPrice && priceNum > 100) {
              maxPrice = priceNum;
              bestMatch = match[1];
            }
          }
          return bestMatch;
        });
      } catch (e) {
        console.error('Saturn-specific parsing failed:', e);
      }
    }

    // Общие селекторы
    if (!priceText) {
      const priceSelectors = [
        '.price',
        '[data-price]',
        '.product-price',
        '.price-value',
        '.cost',
        '.product-cost',
        '.price-current',
        '.current-price',
        '[itemprop="price"]',
        '.product__price',
        '.goods-price',
        '.price__value',
        '[class*="price"]',
        '[class*="cost"]'
      ];

      for (const selector of priceSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            priceText = await page.evaluate(el => {
              return el.textContent?.trim() || 
                     el.getAttribute('data-price') || 
                     el.getAttribute('content') || 
                     null;
            }, element);
            if (priceText) {
              const priceNum = normalizePrice(priceText);
              if (priceNum && priceNum > 10) {
                break;
              } else {
                priceText = null;
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }
    }

    // Поиск в тексте страницы
    if (!priceText) {
      const pageContent = await page.content();
      const priceRegex = /(\d{1,3}(?:\s?\d{3})*)\s*[₽руб]/g;
      const matches = Array.from(pageContent.matchAll(priceRegex));
      let maxPrice = 0;
      for (const match of matches) {
        const priceNum = parseFloat(match[1].replace(/\s/g, ''));
        if (priceNum > maxPrice && priceNum > 100) {
          maxPrice = priceNum;
          priceText = match[1];
        }
      }
    }

    if (!priceText) {
      return null;
    }

    const price = normalizePrice(priceText);
    if (!price) {
      return null;
    }

    return {
      price,
      currency: 'RUB',
      supplierName: getSupplierNameFromUrl(url),
      source: 'puppeteer',
    };
  } catch (error) {
    console.error('Puppeteer parsing failed:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================================

/**
 * Гибридный парсинг цены: AI → HTTP → Puppeteer
 * 
 * Стратегия:
 * 1. Проверяем кэш (12 часов TTL)
 * 2. Пробуем AI парсинг (основной метод)
 * 3. Если AI не сработал или confidence низкий - fallback на HTTP селекторы
 * 4. Если HTTP не сработал - fallback на Puppeteer
 */
export async function parsePrice(url: string): Promise<ParsedPrice> {
  // Валидация URL
  if (!validateUrl(url)) {
    throw new Error(`URL не разрешен для парсинга: ${url}`);
  }

  // Проверяем кэш
  const cached = getCachedPrice(url);
  if (cached) {
    console.log(`Cache hit for ${url}`);
    return cached;
  }

  const urlObj = new URL(url);
  const isSaturn = urlObj.hostname.includes('saturn');
  const isLemana = urlObj.hostname.includes('lemanapro');
  
  // ========================================
  // СПЕЦИАЛЬНАЯ ОБРАБОТКА: Lemanapro (защита Qrator блокирует HTTP)
  // ========================================
  if (isLemana) {
    console.log(`[Lemanapro] Using Puppeteer directly (Qrator protection)`);
    const puppeteerResult = await parseWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.price > 10) {
      console.log(`Puppeteer parsing success for ${url}: ${puppeteerResult.price}₽`);
      setCachedPrice(url, puppeteerResult);
      return puppeteerResult;
    }
    throw new Error('Не удалось извлечь цену со страницы Lemanapro');
  }
  
  // ========================================
  // ЭТАП 1: AI парсинг (основной метод)
  // ========================================
  if (isAIParsingEnabled()) {
    try {
      const aiResult = await parseWithAI(url);
      if (aiResult && aiResult.price > 0) {
        console.log(`AI parsing success for ${url}: ${aiResult.price}₽ (confidence: ${aiResult.confidence})`);
        setCachedPrice(url, aiResult);
        return aiResult;
      }
    } catch (error) {
      console.warn('AI parsing error, falling back to selectors:', error);
    }
  }

  // ========================================
  // ЭТАП 2: HTTP селекторы (fallback)
  // ========================================
  
  // Для Saturn сначала пробуем Puppeteer (динамический сайт)
  if (isSaturn) {
    const puppeteerResult = await parseWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.price > 100) {
      console.log(`Puppeteer parsing success for ${url}: ${puppeteerResult.price}₽`);
      setCachedPrice(url, puppeteerResult);
      return puppeteerResult;
    }
    
    // Fallback на HTTP
    const httpResult = await parseWithHttp(url);
    if (httpResult && httpResult.price > 100) {
      console.log(`HTTP parsing success for ${url}: ${httpResult.price}₽`);
      setCachedPrice(url, httpResult);
      return httpResult;
    }
  } else {
    // Для других сайтов сначала HTTP (быстрее)
    const httpResult = await parseWithHttp(url);
    if (httpResult && httpResult.price > 10) {
      console.log(`HTTP parsing success for ${url}: ${httpResult.price}₽`);
      setCachedPrice(url, httpResult);
      return httpResult;
    }

    // ========================================
    // ЭТАП 3: Puppeteer (последний fallback)
    // ========================================
    const puppeteerResult = await parseWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.price > 10) {
      console.log(`Puppeteer parsing success for ${url}: ${puppeteerResult.price}₽`);
      setCachedPrice(url, puppeteerResult);
      return puppeteerResult;
    }
  }

  throw new Error('Не удалось извлечь цену со страницы');
}

/**
 * Парсинг цены с использованием только AI (для тестирования)
 */
export async function parsePriceWithAIOnly(url: string): Promise<ParsedPrice | null> {
  if (!validateUrl(url)) {
    throw new Error(`URL не разрешен для парсинга: ${url}`);
  }
  
  return parseWithAI(url);
}
