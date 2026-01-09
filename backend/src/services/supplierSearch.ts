import axios from 'axios';

const ROUTERAI_API_URL = 'https://routerai.ru/api/v1';

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
 * Получение API ключа RouterAI из переменных окружения
 */
function getRouterAIKey(): string {
  const apiKey = process.env.ROUTERAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('ROUTERAI_API_KEY не найден в переменных окружения');
  }
  return apiKey;
}

/**
 * Поиск товара через RouterAI на сайтах поставщиков
 */
async function searchProductWithAI(
  materialName: string,
  supplierUrls: string[]
): Promise<SupplierSearchResult[]> {
  const apiKey = getRouterAIKey();

  const supplierList = supplierUrls.map((url, index) => `${index + 1}. ${url}`).join('\n');

  const prompt = `Ты помощник для поиска строительных материалов в интернет-магазинах.

Найди товар "${materialName}" на следующих сайтах поставщиков:
${supplierList}

ЗАДАЧА:
1. Перейди на каждый сайт из списка
2. Найди товар, который соответствует названию "${materialName}"
3. Извлеки цену товара
4. Сохрани прямую ссылку на страницу товара

ВАЖНО:
- Если товар не найден на сайте - пропусти его
- Используй точную цену со страницы товара
- Если есть несколько вариантов товара - выбери наиболее подходящий по названию
- Цена должна быть в рублях

Верни результат в формате JSON:
{
  "results": [
    {
      "supplier": "название поставщика (извлеки из URL или названия сайта)",
      "url": "прямая ссылка на страницу товара",
      "price": число (цена в рублях),
      "name": "полное название найденного товара"
    }
  ]
}

Если товар не найден ни на одном сайте, верни: {"results": []}`;

  try {
    const response = await axios.post(
      `${ROUTERAI_API_URL}/chat/completions`,
      {
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 секунд таймаут
      }
    );

    const textResponse = response.data.choices?.[0]?.message?.content || '';
    
    if (!textResponse) {
      throw new Error('Пустой ответ от RouterAI');
    }

    // Парсинг JSON ответа
    let parsed: any;
    try {
      parsed = JSON.parse(textResponse);
    } catch (e) {
      // Пробуем очистить от markdown разметки
      const clean = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    // Если ответ - массив, берем первый элемент
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return [];
      }
      parsed = parsed[0];
    }

    // Извлекаем результаты
    const results = parsed.results || [];
    
    return results.map((r: any) => ({
      supplier: r.supplier || 'Неизвестный поставщик',
      url: r.url || '',
      price: typeof r.price === 'number' ? r.price : parseFloat(r.price) || 0,
      name: r.name || materialName
    })).filter((r: SupplierSearchResult) => r.url && r.price > 0);

  } catch (error: any) {
    console.error('RouterAI search error:', error);
    throw new Error(`Ошибка поиска через RouterAI: ${error.message || error}`);
  }
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

  // Ограничение параллельных запросов (не более 3 одновременно)
  const concurrency = 3;
  let currentIndex = 0;

  const processBatch = async () => {
    while (currentIndex < total) {
      const batch = materials.slice(currentIndex, currentIndex + concurrency);
      currentIndex += concurrency;

      const batchPromises = batch.map(async (material) => {
        try {
          const searchResults = await searchProductWithAI(material.name, supplierUrls);
          
          // Выбираем лучшую цену (минимальную)
          const bestPrice = searchResults.length > 0
            ? searchResults.reduce((best, current) => 
                current.price < best.price ? current : best
              )
            : undefined;

          return {
            materialId: material.id,
            materialName: material.name,
            results: searchResults,
            bestPrice
          };
        } catch (error: any) {
          console.error(`Error searching for ${material.name}:`, error);
          return {
            materialId: material.id,
            materialName: material.name,
            results: [],
            bestPrice: undefined
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Вызываем callback прогресса
      if (onProgress) {
        onProgress(results.length, total);
      }
    }
  };

  await processBatch();

  return results;
}

/**
 * Поиск цены для одного материала
 */
export async function searchMaterialPrice(
  materialName: string,
  supplierUrls: string[]
): Promise<SupplierSearchResult[]> {
  return searchProductWithAI(materialName, supplierUrls);
}

