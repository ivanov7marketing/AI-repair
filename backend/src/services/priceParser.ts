import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

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
  // Удаляем все символы кроме цифр, точки и запятой
  const cleaned = priceText.replace(/[^\d.,]/g, '');
  // Заменяем запятую на точку
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
    
    // Распространенные селекторы для цен
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
      '.price__value'
    ];

    let priceText: string | null = null;

    // Пробуем найти цену по различным селекторам
    for (const selector of priceSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        priceText = element.text().trim() || element.attr('data-price') || element.attr('content');
        if (priceText) break;
      }
    }

    // Если не нашли по селекторам, ищем по тексту "₽" или "руб"
    if (!priceText) {
      const priceRegex = /(\d+[\s.,]?\d*)\s*[₽руб]/i;
      const match = response.data.match(priceRegex);
      if (match) {
        priceText = match[1];
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
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Ждем загрузки цены
    await page.waitForTimeout(2000);

    // Пробуем найти цену через различные селекторы
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
      '.price__value'
    ];

    let priceText: string | null = null;

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
          if (priceText) break;
        }
      } catch (e) {
        // Продолжаем поиск
      }
    }

    // Если не нашли, ищем в тексте страницы
    if (!priceText) {
      const pageContent = await page.content();
      const priceRegex = /(\d+[\s.,]?\d*)\s*[₽руб]/i;
      const match = pageContent.match(priceRegex);
      if (match) {
        priceText = match[1];
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

  // Сначала пробуем HTTP парсинг
  const httpResult = await parseWithHttp(url);
  if (httpResult) {
    return httpResult;
  }

  // Если HTTP не сработал, используем Puppeteer
  const puppeteerResult = await parseWithPuppeteer(url);
  if (puppeteerResult) {
    return puppeteerResult;
  }

  throw new Error('Не удалось извлечь цену со страницы');
}

