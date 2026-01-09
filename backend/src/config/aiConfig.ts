/**
 * Конфигурация AI для извлечения цен
 */
export const AI_CONFIG = {
  // RouterAI API
  ROUTERAI_API_URL: 'https://routerai.ru/api/v1',
  
  // Модель для извлечения цен (оптимальный баланс цена/качество)
  MODEL: 'openai/gpt-4o-mini',
  
  // Минимальный confidence для принятия результата AI (0-100)
  CONFIDENCE_THRESHOLD: 70,
  
  // Максимальная длина HTML для отправки в AI (символов)
  // Увеличено до 15000 для лучшего захвата контекста цены
  HTML_MAX_LENGTH: 15000,
  
  // Время жизни кэша (12 часов в миллисекундах)
  CACHE_DURATION_MS: 12 * 60 * 60 * 1000,
  
  // Возможность отключить AI парсинг (использовать только селекторы)
  ENABLE_AI_PARSING: true,
  
  // Таймаут запроса к AI (миллисекунды)
  REQUEST_TIMEOUT: 30000,
  
  // Максимальное количество retry при ошибках
  MAX_RETRIES: 1,
  
  // Задержка между retry (миллисекунды)
  RETRY_DELAY: 2000,
  
  // Максимальное количество товаров в одном батч-запросе
  BATCH_SIZE: 5,
};

/**
 * Получить API ключ RouterAI
 */
export function getRouterAIKey(): string {
  const key = process.env.ROUTERAI_API_KEY;
  if (!key) {
    throw new Error('ROUTERAI_API_KEY не установлен в переменных окружения');
  }
  return key;
}

/**
 * Проверить, включен ли AI парсинг
 */
export function isAIParsingEnabled(): boolean {
  // Можно переопределить через переменную окружения
  if (process.env.DISABLE_AI_PARSING === 'true') {
    return false;
  }
  return AI_CONFIG.ENABLE_AI_PARSING;
}

