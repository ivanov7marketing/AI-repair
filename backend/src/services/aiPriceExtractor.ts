/**
 * AI сервис для извлечения цен из HTML страниц
 * 
 * Использует RouterAI (OpenAI-совместимый API) для анализа HTML
 * и извлечения структурированной информации о ценах
 */

import axios from 'axios';
import { AI_CONFIG, getRouterAIKey, isAIParsingEnabled } from '../config/aiConfig';
import { simplifyHTML } from './htmlSimplifier';

/**
 * Результат извлечения цены через AI
 */
export interface AIExtractionResult {
  price: number;
  currency: string;
  inStock: boolean;
  confidence: number;
  priceText: string;
}

/**
 * Элемент для батч-обработки
 */
export interface BatchItem {
  html: string;
  url: string;
  name?: string;
}

/**
 * Извлекает название товара из URL
 */
function extractProductNameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Ищем последнюю часть пути (обычно slug товара)
    const parts = pathname.split('/').filter(p => p.length > 0);
    const lastPart = parts[parts.length - 1];
    
    if (lastPart) {
      // Убираем ID товара если есть (обычно в конце через дефис)
      let productSlug = lastPart.replace(/-\d+$/, '');
      
      // Заменяем дефисы на пробелы и капитализируем
      productSlug = productSlug.replace(/-/g, ' ');
      
      return productSlug;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Формирует промпт для извлечения цены
 */
function buildPriceExtractionPrompt(html: string, url: string, productName?: string): string {
  // Определяем магазин для специфичных инструкций
  const isSaturn = url.includes('saturn.net');
  
  // Пробуем извлечь название из URL если не передано
  const effectiveProductName = productName || extractProductNameFromUrl(url);
  
  let storeSpecificInstructions = '';
  if (isSaturn) {
    storeSpecificInstructions = `
СПЕЦИФИЧНО ДЛЯ SATURN.NET:
- На сайте Saturn есть две цены: "С картой" (меньшая) и "Без карты" (большая)
- ВЫБИРАЙ ЦЕНУ "С КАРТОЙ" - она обычно выделена или помечена
- Цена обычно в формате "X XXX ₽" с пробелами между тысячами
- ГЛАВНАЯ цена товара находится в верхней части страницы рядом с названием и кнопкой "В корзину"
- ИГНОРИРУЙ ВСЕ цены ниже основного блока товара (это похожие товары!)
`;
  }

  return `Задача: Извлечь цену КОНКРЕТНОГО товара из HTML страницы интернет-магазина.

URL страницы товара: ${url}
${effectiveProductName ? `ИСКОМЫЙ ТОВАР: "${effectiveProductName}"` : ''}
${storeSpecificInstructions}

HTML фрагмент страницы:
${html}

КРИТИЧЕСКИ ВАЖНЫЕ ИНСТРУКЦИИ:
1. Найди ОСНОВНУЮ цену товара "${effectiveProductName || 'указанного в URL'}"
2. Цена ЭТОГО товара находится в ВЕРХНЕЙ части страницы, рядом с его названием
3. Если есть "старая цена" (зачеркнутая) и "новая цена" - бери НОВУЮ
4. Если есть цена "с картой" и "без карты" - бери цену "С КАРТОЙ" (меньшую)
5. ПОЛНОСТЬЮ ИГНОРИРУЙ: "Похожие товары", "Рекомендуем", "С этим покупают", карусели товаров внизу
6. Формат цены: "2 359 ₽", "284.55 ₽", "284,55 руб", "2,359.00"
7. ВАЖНО: Если цена содержит копейки (например, 284.55), ОБЯЗАТЕЛЬНО включи десятичную часть в price!
8. Если НЕ УВЕРЕН в цене - верни confidence: 0

ВЕРНИ ТОЛЬКО JSON:
{
  "price": число с копейками если есть (например: 2359 или 284.55),
  "currency": "RUB",
  "inStock": true/false,
  "confidence": 0-100,
  "priceText": "точный текст цены с сайта (например: 284.55 ₽)",
  "foundProductName": "название найденного товара на странице"
}`;
}

/**
 * Формирует промпт для батч-извлечения цен
 */
function buildBatchExtractionPrompt(items: BatchItem[]): string {
  const itemsText = items.map((item, index) => {
    return `
Товар ${index + 1}:
URL: ${item.url}
${item.name ? `Название: ${item.name}` : ''}
HTML:
${item.html}
`;
  }).join('\n---\n');

  return `Задача: Извлечь цены из ${items.length} товаров. Для каждого дан URL и HTML.

${itemsText}

Инструкции:
1. Для каждого товара найди ОСНОВНУЮ цену (не старую, не скидку, не доставку)
2. Если несколько цен - выбери актуальную для покупки
3. Игнорируй цены в "Похожих товарах"
4. ВАЖНО: Если цена содержит копейки (например, 284.55), ОБЯЗАТЕЛЬНО включи десятичную часть в price!
5. Если цену найти невозможно - верни price: 0 и confidence: 0

ВАЖНО: Верни ТОЛЬКО JSON массив без дополнительного текста:
[
  {"price": 2359, "currency": "RUB", "inStock": true, "confidence": 95, "priceText": "2 359 ₽"},
  {"price": 284.55, "currency": "RUB", "inStock": true, "confidence": 90, "priceText": "284.55 ₽"},
  ...
]

Количество элементов в массиве должно равняться ${items.length}.`;
}

/**
 * Выполняет запрос к RouterAI API
 */
async function callRouterAI(prompt: string, retryCount: number = 0): Promise<string> {
  try {
    const apiKey = getRouterAIKey();
    
    const response = await axios.post(
      `${AI_CONFIG.ROUTERAI_API_URL}/chat/completions`,
      {
        model: AI_CONFIG.MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Низкая температура для точности
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: AI_CONFIG.REQUEST_TIMEOUT,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Пустой ответ от RouterAI');
    }
    
    return content;
  } catch (error: any) {
    // Retry при ошибках сети
    if (retryCount < AI_CONFIG.MAX_RETRIES) {
      console.warn(`RouterAI request failed, retrying (${retryCount + 1}/${AI_CONFIG.MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, AI_CONFIG.RETRY_DELAY));
      return callRouterAI(prompt, retryCount + 1);
    }
    
    if (error.response) {
      throw new Error(`RouterAI API Error (${error.response.status}): ${error.response.data?.error?.message || error.message}`);
    }
    throw new Error(`RouterAI Network Error: ${error.message}`);
  }
}

/**
 * Извлекает JSON из ответа AI (может быть обернут в markdown)
 */
function extractJSON(text: string): string {
  // Пробуем напрямую
  text = text.trim();
  
  // Удаляем markdown code blocks если есть
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Ищем JSON объект или массив
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  
  return text;
}

/**
 * Парсит и валидирует результат извлечения цены
 */
function parseExtractionResult(jsonText: string): AIExtractionResult | null {
  try {
    const cleaned = extractJSON(jsonText);
    const parsed = JSON.parse(cleaned);
    
    // Валидация
    if (typeof parsed.price !== 'number' || parsed.price < 0) {
      return null;
    }
    
    return {
      price: parsed.price,
      currency: parsed.currency || 'RUB',
      inStock: parsed.inStock !== false,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      priceText: parsed.priceText || String(parsed.price),
    };
  } catch (error) {
    console.error('Failed to parse AI extraction result:', error);
    return null;
  }
}

/**
 * Парсит результат батч-извлечения
 */
function parseBatchResult(jsonText: string, expectedCount: number): AIExtractionResult[] {
  try {
    const cleaned = extractJSON(jsonText);
    const parsed = JSON.parse(cleaned);
    
    if (!Array.isArray(parsed)) {
      console.error('Batch result is not an array');
      return [];
    }
    
    return parsed.map((item: any) => ({
      price: typeof item.price === 'number' ? item.price : 0,
      currency: item.currency || 'RUB',
      inStock: item.inStock !== false,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      priceText: item.priceText || String(item.price || 0),
    }));
  } catch (error) {
    console.error('Failed to parse batch extraction result:', error);
    return [];
  }
}

/**
 * Извлекает цену из HTML с помощью AI
 * 
 * @param html - HTML страницы (будет упрощен автоматически)
 * @param url - URL страницы (для контекста)
 * @param productName - название товара (опционально, для проверки)
 * @returns результат извлечения или null
 */
export async function extractPriceWithAI(
  html: string,
  url: string,
  productName?: string
): Promise<AIExtractionResult | null> {
  // Проверяем, включен ли AI парсинг
  if (!isAIParsingEnabled()) {
    console.log('AI parsing is disabled');
    return null;
  }
  
  try {
    // Логируем размер исходного HTML
    console.log(`[AI] Original HTML size: ${html.length} chars for ${url}`);
    
    // Проверяем, не заблокирована ли страница (более точная проверка)
    const isBlocked = (
      html.includes('__qrator/qauth.js') || // Qrator protection
      html.includes('<title>Access denied</title>') ||
      html.includes('<title>Доступ запрещен</title>') ||
      (html.includes('captcha') && html.length < 5000) // Капча на короткой странице
    );
    
    if (isBlocked) {
      console.warn(`[AI] Page is blocked by anti-bot for ${url}`);
      return null;
    }
    
    // Упрощаем HTML
    const simplifiedHTML = simplifyHTML(html);
    
    console.log(`[AI] Simplified HTML size: ${simplifiedHTML.length} chars`);
    
    if (!simplifiedHTML || simplifiedHTML.length < 100) {
      console.warn('[AI] HTML too short after simplification');
      return null;
    }
    
    // Логируем первые 500 символов для отладки
    console.log(`[AI] Simplified HTML preview: ${simplifiedHTML.substring(0, 500)}...`);
    
    // Формируем промпт
    const prompt = buildPriceExtractionPrompt(simplifiedHTML, url, productName);
    
    // Вызываем AI
    const response = await callRouterAI(prompt);
    
    console.log(`[AI] Raw response: ${response}`);
    
    // Парсим результат
    const result = parseExtractionResult(response);
    
    if (result && result.confidence >= AI_CONFIG.CONFIDENCE_THRESHOLD) {
      console.log(`[AI] Extracted price: ${result.price}₽, priceText: "${result.priceText}", confidence: ${result.confidence}`);
      return result;
    }
    
    // Если confidence низкий, логируем предупреждение
    if (result) {
      console.warn(`[AI] Low confidence (${result.confidence}) for ${url}`);
    }
    
    return result;
  } catch (error) {
    console.error('[AI] Price extraction failed:', error);
    return null;
  }
}

/**
 * Извлекает цены из нескольких товаров за один запрос (экономия на API)
 * 
 * @param items - массив товаров для обработки
 * @returns массив результатов (в том же порядке)
 */
export async function batchExtractPrices(
  items: BatchItem[]
): Promise<AIExtractionResult[]> {
  // Проверяем, включен ли AI парсинг
  if (!isAIParsingEnabled()) {
    console.log('AI parsing is disabled');
    return items.map(() => ({
      price: 0,
      currency: 'RUB',
      inStock: false,
      confidence: 0,
      priceText: '',
    }));
  }
  
  if (items.length === 0) {
    return [];
  }
  
  // Если один товар, используем обычный метод
  if (items.length === 1) {
    const result = await extractPriceWithAI(items[0].html, items[0].url, items[0].name);
    return result ? [result] : [{
      price: 0,
      currency: 'RUB',
      inStock: false,
      confidence: 0,
      priceText: '',
    }];
  }
  
  try {
    // Упрощаем HTML для каждого товара
    const simplifiedItems = items.map(item => ({
      ...item,
      html: simplifyHTML(item.html, Math.floor(AI_CONFIG.HTML_MAX_LENGTH / items.length)),
    }));
    
    // Формируем батч-промпт
    const prompt = buildBatchExtractionPrompt(simplifiedItems);
    
    // Вызываем AI
    const response = await callRouterAI(prompt);
    
    // Парсим результат
    const results = parseBatchResult(response, items.length);
    
    // Дополняем пустыми результатами если нужно
    while (results.length < items.length) {
      results.push({
        price: 0,
        currency: 'RUB',
        inStock: false,
        confidence: 0,
        priceText: '',
      });
    }
    
    return results;
  } catch (error) {
    console.error('Batch AI price extraction failed:', error);
    // Возвращаем пустые результаты
    return items.map(() => ({
      price: 0,
      currency: 'RUB',
      inStock: false,
      confidence: 0,
      priceText: '',
    }));
  }
}

/**
 * Проверяет доступность RouterAI API
 */
export async function checkRouterAIAvailability(): Promise<boolean> {
  try {
    const apiKey = getRouterAIKey();
    
    // Делаем простой запрос для проверки
    const response = await axios.post(
      `${AI_CONFIG.ROUTERAI_API_URL}/chat/completions`,
      {
        model: AI_CONFIG.MODEL,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    
    return response.status === 200;
  } catch (error) {
    console.error('RouterAI availability check failed:', error);
    return false;
  }
}

