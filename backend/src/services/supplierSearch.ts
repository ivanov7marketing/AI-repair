/**
 * Сервис поиска товаров на сайтах поставщиков
 * 
 * Использует AI для извлечения цен из результатов поиска
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { AI_CONFIG, isAIParsingEnabled } from '../config/aiConfig';
import { extractPriceWithAI, batchExtractPrices, AIExtractionResult } from './aiPriceExtractor';
import { simplifyHTML } from './htmlSimplifier';
import { parsePrice } from './priceParser';

export interface SupplierSearchResult {
  supplier: string;
  url: string;
  price: number;
  name: string;
  confidence?: number;
}

export interface MaterialSearchResult {
  materialId: string;
  materialName: string;
  results: SupplierSearchResult[];
  bestPrice?: SupplierSearchResult;
}

// ============================================================================
// УТИЛИТЫ
// ============================================================================

/**
 * Извлечение названия поставщика из URL
 */
function getSupplierName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    if (parts.length >= 2) {
      const mainPart = parts[parts.length - 2];
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

  return `${baseUrl.replace(/\/$/, '')}/search?q=${encodedQuery}`;
}

/**
 * Проверка, является ли URL прямой ссылкой на товар
 */
function isProductUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('/search') || urlLower.includes('?q=') || urlLower.includes('&q=')) {
    return false;
  }
  
  const productIndicators = [
    '/product/', '/goods/', '/catalog/', '/item/', '/p/',
    '/tovar/', '/product-', '/goods-',
    'product_id=', 'item_id=', 'goods_id=', 'id=', 'art=', 'article=',
  ];
  
  return productIndicators.some(indicator => urlLower.includes(indicator));
}

// ============================================================================
// AI ПАРСИНГ РЕЗУЛЬТАТОВ ПОИСКА
// ============================================================================

/**
 * Промпт для извлечения информации о товарах из результатов поиска
 */
function buildSearchResultsPrompt(html: string, materialName: string, supplierUrl: string): string {
  return `Задача: Найти товар "${materialName}" в результатах поиска интернет-магазина.

URL поиска: ${supplierUrl}

HTML страницы результатов поиска:
${html}

Инструкции:
1. Найди товар, который ЛУЧШЕ ВСЕГО соответствует запросу "${materialName}"
2. Извлеки цену этого товара (основную цену, не старую и не скидочную)
3. Извлеки название товара как оно указано на сайте
4. Если товар не найден - верни price: 0

ВАЖНО: Верни ТОЛЬКО JSON без дополнительного текста:
{
  "found": true или false,
  "name": "название товара с сайта",
  "price": число (например: 2359),
  "priceText": "оригинальный текст цены",
  "confidence": число от 0 до 100,
  "productUrl": "ссылка на товар если есть"
}`;
}

/**
 * Парсинг результатов поиска через AI
 */
async function parseSearchResultsWithAI(
  searchUrl: string,
  materialName: string
): Promise<SupplierSearchResult | null> {
  try {
    // Получаем HTML страницы поиска
    const response = await axios.get(searchUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
    });

    if (!response.data || typeof response.data !== 'string') {
      return null;
    }

    // Упрощаем HTML
    const simplifiedHTML = simplifyHTML(response.data);
    
    if (!simplifiedHTML || simplifiedHTML.length < 100) {
      return null;
    }

    // Формируем промпт и вызываем AI
    const prompt = buildSearchResultsPrompt(simplifiedHTML, materialName, searchUrl);
    
    const apiKey = process.env.ROUTERAI_API_KEY;
    if (!apiKey) {
      console.warn('ROUTERAI_API_KEY not set, skipping AI search');
      return null;
    }

    const aiResponse = await axios.post(
      `${AI_CONFIG.ROUTERAI_API_URL}/chat/completions`,
      {
        model: AI_CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: AI_CONFIG.REQUEST_TIMEOUT,
      }
    );

    const content = aiResponse.data.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    // Парсим результат
    let jsonText = content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    
    if (!parsed.found || !parsed.price || parsed.price <= 0) {
      return null;
    }

    const supplierName = getSupplierName(searchUrl);
    
    return {
      supplier: supplierName,
      url: parsed.productUrl || searchUrl,
      price: parsed.price,
      name: parsed.name || materialName,
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error('AI search parsing failed:', error);
    return null;
  }
}

// ============================================================================
// FALLBACK: ПРОСТОЙ ПАРСИНГ СЕЛЕКТОРАМИ
// ============================================================================

/**
 * Простой парсинг результатов поиска через CSS селекторы (fallback)
 */
async function parseSearchResultsSimple(
  searchUrl: string
): Promise<Array<{ name: string; price: number; url: string }>> {
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
    const baseUrl = new URL(searchUrl);

    const productSelectors = [
      '[data-product]', '.product-card', '.product-item',
      '.catalog-item', '.goods-item', '.search-result-item',
      '.product', '[itemtype*="Product"]', '.card-product', '.product-tile',
    ];

    const priceSelectors = [
      '[data-price]', '.price', '.product-price', '.price-value',
      '.current-price', '.sale-price', '[itemprop="price"]',
      '.price-current', '.product__price', '.goods-price',
    ];

    const nameSelectors = [
      '[data-name]', '.product-name', '.product-title',
      '.goods-name', '.title', '[itemprop="name"]',
      '.card-title', 'h3', 'h4', '.name',
    ];

    const linkSelectors = [
      'a[href*="/product"]', 'a[href*="/catalog"]', 'a[href*="/goods"]',
      'a.product-link', 'a.card-link', '.product-card a', 'a[itemprop="url"]',
    ];

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
          if (!url && $product.is('a')) {
            url = $product.attr('href') || '';
          }

          if (name && price > 0) {
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
    console.error('Simple search parsing failed:', error);
    return [];
  }
}

// ============================================================================
// ПОИСК НА ПОСТАВЩИКЕ
// ============================================================================

/**
 * Поиск товара на сайте поставщика
 */
async function searchOnSupplier(
  materialName: string,
  supplierUrl: string
): Promise<SupplierSearchResult[]> {
  const supplierName = getSupplierName(supplierUrl);
  
  // Если это прямая ссылка на товар, используем parsePrice
  if (isProductUrl(supplierUrl)) {
    try {
      const parsed = await parsePrice(supplierUrl);
      
      if (parsed.price > 0) {
        return [{
          supplier: parsed.supplierName || supplierName,
          url: supplierUrl,
          price: parsed.price,
          name: materialName,
          confidence: parsed.confidence,
        }];
      }
    } catch (error) {
      // Продолжаем с поиском
    }
  }
  
  const searchUrl = getSearchUrl(supplierUrl, materialName);
  
  // ========================================
  // ЭТАП 1: AI парсинг результатов поиска
  // ========================================
  if (isAIParsingEnabled()) {
    try {
      const aiResult = await parseSearchResultsWithAI(searchUrl, materialName);
      if (aiResult && aiResult.price > 0) {
        return [aiResult];
      }
    } catch (error) {
      console.warn('AI search failed, trying simple parsing');
    }
  }
  
  // ========================================
  // ЭТАП 2: Простой парсинг (fallback)
  // ========================================
  const simpleResults = await parseSearchResultsSimple(searchUrl);
  
  return simpleResults.map(r => ({
    supplier: supplierName,
    url: r.url,
    price: r.price,
    name: r.name,
  }));
}

// ============================================================================
// МАССОВЫЙ ПОИСК
// ============================================================================

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

  for (let i = 0; i < total; i++) {
    const material = materials[i];
    
    try {
      const allResults: SupplierSearchResult[] = [];
      
      for (const supplierUrl of supplierUrls) {
        try {
          const supplierResults = await searchOnSupplier(material.name, supplierUrl);
          allResults.push(...supplierResults);
        } catch (error) {
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
      results.push({
        materialId: material.id,
        materialName: material.name,
        results: [],
        bestPrice: undefined
      });
    }

    // Callback прогресса (каждые 5 материалов)
    if (onProgress && (i % 5 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }

    // Задержка между запросами
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
