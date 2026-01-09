/**
 * Утилиты для упрощения HTML перед отправкой в AI
 * 
 * Цель: уменьшить размер HTML, сохранив информацию о ценах
 */

import { AI_CONFIG } from '../config/aiConfig';

/**
 * Ключевые слова для поиска секций с ценами
 */
const PRICE_KEYWORDS = [
  // Английские
  'price', 'cost', 'product', 'item', 'card', 'buy', 'cart', 'order', 'main', 'detail',
  // Русские
  'цена', 'стоимость', 'товар', 'купить', 'корзин', 'заказ', 'руб', '₽', 'карт', 'основн'
];

/**
 * Секции, которые нужно УДАЛИТЬ (похожие товары и т.д.)
 */
const EXCLUDE_SECTIONS = [
  'similar', 'recommend', 'related', 'also', 'like', 'viewed',
  'похож', 'рекоменд', 'вместе', 'смотрел', 'понравит', 'купают',
  'search', 'carousel', 'slider', 'banner', 'promo'
];

/**
 * Классы элементов, которые нужно УДАЛИТЬ (цены других товаров)
 */
const EXCLUDE_CLASSES = [
  'js-price-value-search', // Saturn: цены в результатах поиска
  'search-result',
  'product-card', // Карточки других товаров
  'product-item',
  'carousel-item',
  'slider-item',
];

/**
 * Удаляет элементы с исключенными классами (цены других товаров)
 */
function removeExcludedElements(html: string): string {
  // Удаляем элементы с конкретными классами (цены в поиске и т.д.)
  for (const className of EXCLUDE_CLASSES) {
    // Удаляем span, div и другие элементы с этим классом
    const pattern = new RegExp(`<(span|div|a)[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
    html = html.replace(pattern, '');
  }
  
  return html;
}

/**
 * Удаляет секции с "похожими товарами" и рекомендациями
 */
function removeExcludedSections(html: string): string {
  // Сначала удаляем элементы с исключенными классами
  html = removeExcludedElements(html);
  
  // Удаляем секции по классам/id
  for (const keyword of EXCLUDE_SECTIONS) {
    // Удаляем div/section с классом или id содержащим ключевое слово
    const patterns = [
      new RegExp(`<div[^>]*(class|id)=["'][^"']*${keyword}[^"']*["'][^>]*>[\\s\\S]*?<\\/div>`, 'gi'),
      new RegExp(`<section[^>]*(class|id)=["'][^"']*${keyword}[^"']*["'][^>]*>[\\s\\S]*?<\\/section>`, 'gi'),
    ];
    
    for (const pattern of patterns) {
      html = html.replace(pattern, '');
    }
  }
  
  return html;
}

/**
 * Удаляет теги, которые не несут полезной информации для извлечения цен
 */
function removeUselessTags(html: string): string {
  // Сначала удаляем секции с похожими товарами
  html = removeExcludedSections(html);
  
  // Удаляем script теги с содержимым
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Удаляем style теги с содержимым
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Удаляем svg теги с содержимым
  html = html.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
  
  // Удаляем noscript теги с содержимым
  html = html.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
  // Удаляем iframe теги
  html = html.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  
  // Удаляем header и footer (обычно не содержат цену товара)
  html = html.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  
  // Удаляем nav (навигация)
  html = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  
  // Удаляем img теги (оставляем alt текст если есть)
  html = html.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1');
  html = html.replace(/<img[^>]*>/gi, '');
  
  // Удаляем link теги (CSS и прочие)
  html = html.replace(/<link[^>]*>/gi, '');
  
  // Удаляем meta теги (кроме тех, что могут содержать цену)
  html = html.replace(/<meta(?![^>]*itemprop)[^>]*>/gi, '');
  
  // Удаляем HTML комментарии
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  
  // Удаляем пустые теги
  html = html.replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '');
  
  return html;
}

/**
 * Упрощает атрибуты тегов, оставляя только важные для контекста
 */
function simplifyAttributes(html: string): string {
  // Список атрибутов, которые нужно сохранить
  const keepAttributes = [
    'itemprop', 'itemtype', 'data-price', 'data-product', 'data-name',
    'content', 'value', 'href', 'alt', 'title'
  ];
  
  // Регулярное выражение для поиска тегов с атрибутами
  return html.replace(/<(\w+)([^>]*)>/gi, (match, tagName, attributes) => {
    if (!attributes.trim()) {
      return `<${tagName}>`;
    }
    
    // Извлекаем только нужные атрибуты
    const keptAttrs: string[] = [];
    
    for (const attr of keepAttributes) {
      const regex = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
      const attrMatch = attributes.match(regex);
      if (attrMatch) {
        keptAttrs.push(`${attr}="${attrMatch[1]}"`);
      }
    }
    
    // Также сохраняем class и id если они содержат ключевые слова о цене
    const classMatch = attributes.match(/class=["']([^"']*)["']/i);
    if (classMatch) {
      const className = classMatch[1].toLowerCase();
      if (PRICE_KEYWORDS.some(kw => className.includes(kw))) {
        keptAttrs.push(`class="${classMatch[1]}"`);
      }
    }
    
    const idMatch = attributes.match(/id=["']([^"']*)["']/i);
    if (idMatch) {
      const idName = idMatch[1].toLowerCase();
      if (PRICE_KEYWORDS.some(kw => idName.includes(kw))) {
        keptAttrs.push(`id="${idMatch[1]}"`);
      }
    }
    
    if (keptAttrs.length > 0) {
      return `<${tagName} ${keptAttrs.join(' ')}>`;
    }
    
    return `<${tagName}>`;
  });
}

/**
 * Нормализует пробелы и переносы строк
 */
function normalizeWhitespace(html: string): string {
  // Заменяем множественные пробелы и переносы на один пробел
  html = html.replace(/\s+/g, ' ');
  
  // Удаляем пробелы между тегами
  html = html.replace(/>\s+</g, '><');
  
  // Удаляем пробелы в начале и конце
  html = html.trim();
  
  return html;
}

/**
 * Находит секции HTML, которые вероятно содержат информацию о цене
 */
export function findPriceSections(html: string): string[] {
  const sections: string[] = [];
  
  // Ищем элементы с атрибутами, связанными с ценой
  const pricePatterns = [
    // Элементы с itemprop="price"
    /<[^>]*itemprop=["']price["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
    // Элементы с data-price
    /<[^>]*data-price[^>]*>[\s\S]*?<\/[^>]+>/gi,
    // Элементы с классом/id содержащим price
    /<[^>]*(class|id)=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
    // Элементы с классом/id содержащим product
    /<[^>]*(class|id)=["'][^"']*product[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
  ];
  
  for (const pattern of pricePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      if (match[0].length < 5000) { // Ограничиваем размер секции
        sections.push(match[0]);
      }
    }
  }
  
  return sections;
}

/**
 * Извлекает контекст вокруг найденных секций с ценами
 */
function extractContextAroundSections(html: string, sections: string[], maxLength: number): string {
  if (sections.length === 0) {
    return html.substring(0, maxLength);
  }
  
  // Собираем уникальные секции
  const uniqueSections = [...new Set(sections)];
  
  // Объединяем секции
  let result = uniqueSections.join('\n');
  
  // Если результат слишком короткий, добавляем контекст
  if (result.length < maxLength / 2) {
    // Ищем позиции секций в оригинальном HTML
    for (const section of uniqueSections.slice(0, 3)) {
      const pos = html.indexOf(section);
      if (pos !== -1) {
        // Берем контекст вокруг секции (500 символов до и после)
        const start = Math.max(0, pos - 500);
        const end = Math.min(html.length, pos + section.length + 500);
        const context = html.substring(start, end);
        
        if (!result.includes(context)) {
          result += '\n' + context;
        }
      }
    }
  }
  
  return result.substring(0, maxLength);
}

/**
 * Главная функция упрощения HTML
 * 
 * @param html - исходный HTML
 * @param maxLength - максимальная длина результата (по умолчанию из конфига)
 * @returns упрощенный HTML
 */
export function simplifyHTML(html: string, maxLength: number = AI_CONFIG.HTML_MAX_LENGTH): string {
  if (!html || html.length === 0) {
    return '';
  }
  
  // Шаг 1: Удаляем бесполезные теги
  let simplified = removeUselessTags(html);
  
  // Шаг 2: Упрощаем атрибуты
  simplified = simplifyAttributes(simplified);
  
  // Шаг 3: Нормализуем пробелы
  simplified = normalizeWhitespace(simplified);
  
  // Шаг 4: Если HTML все еще слишком большой, ищем секции с ценами
  if (simplified.length > maxLength) {
    const priceSections = findPriceSections(simplified);
    
    if (priceSections.length > 0) {
      simplified = extractContextAroundSections(simplified, priceSections, maxLength);
    } else {
      // Если секции не найдены, берем начало страницы
      // (обычно цена находится в верхней части)
      simplified = simplified.substring(0, maxLength);
    }
  }
  
  // Шаг 5: Финальная нормализация
  simplified = normalizeWhitespace(simplified);
  
  return simplified;
}

/**
 * Извлекает текстовое содержимое из HTML (убирает все теги)
 */
export function extractTextContent(html: string): string {
  // Удаляем все теги
  let text = html.replace(/<[^>]+>/g, ' ');
  
  // Декодируем HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Нормализуем пробелы
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

