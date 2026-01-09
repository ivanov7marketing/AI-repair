import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Используем stealth плагин для обхода защиты от ботов
puppeteer.use(StealthPlugin());

export interface ParsedPrice {
  price: number;
  currency?: string;
  supplierName?: string;
}

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
  
  // Удаляем все символы кроме цифр, точки, запятой и пробелов
  let cleaned = priceText.replace(/[^\d.,\s]/g, '');
  
  // Удаляем пробелы (они используются как разделители тысяч в русском формате)
  cleaned = cleaned.replace(/\s/g, '');
  
  // Заменяем запятую на точку (если есть)
  const normalized = cleaned.replace(',', '.');
  const price = parseFloat(normalized);
  return isNaN(price) ? null : price;
}

/**
 * Попытка парсинга цены через HTTP запрос и cheerio
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
    const urlObj = new URL(url);
    const isSaturn = urlObj.hostname.includes('saturn');
    
    let priceText: string | null = null;

    // Специфичные селекторы для Saturn
    if (isSaturn) {
      // Ищем цену "С картой" (приоритет) или "Без карты"
      const cardPrice = $('.price-card, [class*="price"][class*="card"], .product-price-card').first();
      if (cardPrice.length > 0) {
        priceText = cardPrice.text().trim();
      }
      
      // Если не нашли, ищем в секции с ценой
      if (!priceText) {
        const priceSection = $('[class*="price"], [class*="cost"], [data-price]');
        priceSection.each((_, el) => {
          const text = $(el).text().trim();
          // Ищем цену с пробелами (например "2 359 ₽")
          const priceMatch = text.match(/(\d+[\s.,]?\d*)\s*[₽руб]/);
          if (priceMatch && parseFloat(priceMatch[1].replace(/\s/g, '')) > 100) {
            priceText = priceMatch[1];
            return false; // break
          }
        });
      }
    }
    
    // Распространенные селекторы для цен (для всех сайтов)
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
        const element = $(selector).first();
        if (element.length > 0) {
          const text = element.text().trim();
          const dataPrice = element.attr('data-price');
          const content = element.attr('content');
          priceText = text || dataPrice || content || null;
          if (priceText) {
            // Проверяем, что это похоже на цену (больше 10)
            const priceNum = normalizePrice(priceText);
            if (priceNum && priceNum > 10) {
              break;
            } else {
              priceText = null; // Продолжаем поиск
            }
          }
        }
      }
    }

    // Если не нашли по селекторам, ищем по тексту "₽" или "руб" (только большие цены)
    if (!priceText) {
      const priceRegex = /(\d{1,3}(?:\s?\d{3})*)\s*[₽руб]/g;
      const matches = response.data.matchAll(priceRegex);
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

    // Пытаемся определить название поставщика из URL
    const urlObj = new URL(url);
    let supplierName = '';
    if (urlObj.hostname.includes('saturn')) {
      supplierName = 'Сатурн';
    } else if (urlObj.hostname.includes('lemanapro')) {
      supplierName = 'Лемана Про';
    } else if (urlObj.hostname.includes('sdvor')) {
      supplierName = 'Стройдвор';
    }

    return {
      price,
      currency: 'RUB',
      supplierName
    };
  } catch (error) {
    console.error('HTTP parsing failed:', error);
    return null;
  }
}

/**
 * Парсинг цены через Puppeteer для динамических сайтов
 */
async function parseWithPuppeteer(url: string): Promise<ParsedPrice | null> {
  let browser;
  try {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(executablePath ? { executablePath } : {})
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    const urlObj = new URL(url);
    const isSaturn = urlObj.hostname.includes('saturn');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Ждем загрузки цены (особенно важно для динамических сайтов)
    await page.waitForTimeout(3000);

    let priceText: string | null = null;

    // Специфичная логика для Saturn
    if (isSaturn) {
      try {
        // Ищем цену через JavaScript в браузере
        priceText = await page.evaluate(() => {
          // Ищем элементы с ценой
          const priceSelectors = [
            '[class*="price"]',
            '[data-price]',
            '.product-price',
            '.price-value',
            '[itemprop="price"]'
          ];
          
          for (const selector of priceSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const text = el.textContent?.trim() || '';
              // Ищем цену с пробелами (например "2 359 ₽")
              const match = text.match(/(\d{1,3}(?:\s?\d{3})*)\s*[₽руб]/);
              if (match) {
                const priceNum = parseFloat(match[1].replace(/\s/g, ''));
                if (priceNum > 100) {
                  return match[1];
                }
              }
            }
          }
          
          // Если не нашли, ищем в тексте страницы
          const bodyText = document.body.innerText;
          const priceRegex = /(\d{1,3}(?:\s?\d{3})*)\s*[₽руб]/g;
          const matches = Array.from(bodyText.matchAll(priceRegex));
          let maxPrice = 0;
          let bestMatch = null;
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

    // Общие селекторы для всех сайтов
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
              // Проверяем, что это похоже на цену
              const priceNum = normalizePrice(priceText);
              if (priceNum && priceNum > 10) {
                break;
              } else {
                priceText = null;
              }
            }
          }
        } catch (e) {
          // Продолжаем поиск
        }
      }
    }

    // Если не нашли, ищем в тексте страницы (только большие цены)
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

    // Определяем название поставщика
    const urlObj = new URL(url);
    let supplierName = '';
    if (urlObj.hostname.includes('saturn')) {
      supplierName = 'Сатурн';
    } else if (urlObj.hostname.includes('lemanapro')) {
      supplierName = 'Лемана Про';
    } else if (urlObj.hostname.includes('sdvor')) {
      supplierName = 'Стройдвор';
    }

    return {
      price,
      currency: 'RUB',
      supplierName
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

/**
 * Гибридный парсинг цены: сначала HTTP, затем Puppeteer при необходимости
 */
export async function parsePrice(url: string): Promise<ParsedPrice> {
  // Валидация URL
  if (!validateUrl(url)) {
    throw new Error(`URL не разрешен для парсинга: ${url}`);
  }

  const urlObj = new URL(url);
  const isSaturn = urlObj.hostname.includes('saturn');
  
  // Для Saturn сразу используем Puppeteer, так как сайт динамический
  if (isSaturn) {
    const puppeteerResult = await parseWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.price > 100) {
      return puppeteerResult;
    }
    // Если Puppeteer не сработал, пробуем HTTP как fallback
    const httpResult = await parseWithHttp(url);
    if (httpResult && httpResult.price > 100) {
      return httpResult;
    }
  } else {
    // Для других сайтов сначала пробуем HTTP (быстрее)
    const httpResult = await parseWithHttp(url);
    if (httpResult && httpResult.price > 10) {
      return httpResult;
    }

    // Если HTTP не сработал, используем Puppeteer
    const puppeteerResult = await parseWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.price > 10) {
      return puppeteerResult;
    }
  }

  throw new Error('Не удалось извлечь цену со страницы');
}

