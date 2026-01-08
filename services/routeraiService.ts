
import { AnalysisResult, ImageSize, Room } from "../types.ts";

export interface GenerativePart {
    inlineData: {
        mimeType: string;
        data: string;
    };
}

const ROUTERAI_API_URL = "https://routerai.ru/api/v1";

// Преобразуем GenerativePart в формат для RouterAI (OpenAI-совместимый)
const convertImagePartToOpenAIFormat = (imagePart: GenerativePart) => {
    return {
        type: "image_url",
        image_url: {
            url: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
        }
    };
};

const convertTextPart = (text: string) => {
    return {
        type: "text",
        text: text
    };
};

const getApiKey = () => {
    return process.env.ROUTERAI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || "";
};

const handleApiError = (error: any) => {
    console.error("RouterAI API Error:", error);
    const msg = error.message || error.toString();
    console.error("Error message:", msg);
    console.error("Error stack:", error.stack);
    throw error;
};

const makeRouterAIRequest = async (endpoint: string, body: any) => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API ключ не найден. Установите ROUTERAI_API_KEY в .env.local");
    }

    try {
        const response = await fetch(`${ROUTERAI_API_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("RouterAI API Error:", response.status, errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: { message: errorText || response.statusText } };
            }
            throw new Error(`RouterAI API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
        }

        return await response.json();
    } catch (error: any) {
        if (error.message && error.message.includes("RouterAI API Error")) {
            throw error;
        }
        console.error("Fetch error:", error);
        throw new Error(`Ошибка сети при обращении к RouterAI: ${error.message || error}`);
    }
};

export const fileToGenerativePart = async (file: File | Blob): Promise<GenerativePart> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const match = base64String.match(/^data:(.*?);base64,(.*)$/);
            if (match) {
                resolve({
                    inlineData: { mimeType: match[1], data: match[2] }
                });
            } else {
                const data = base64String.split(',')[1];
                resolve({
                    inlineData: { mimeType: 'image/jpeg', data: data }
                });
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const dataUrlToGenerativePart = (dataUrl: string): GenerativePart => {
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (match) {
        return {
            inlineData: { mimeType: match[1], data: match[2] }
        };
    }
    return {
        inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] }
    };
};

export const analyzeFloorPlan = async (imagePart: GenerativePart): Promise<AnalysisResult> => {
    try {
        const prompt = `Ты эксперт по анализу архитектурных планов. Проанализируй этот план помещения ОЧЕНЬ ВНИМАТЕЛЬНО.

КРИТИЧЕСКИ ВАЖНО: Включи ВСЕ помещения, которые видишь на плане. Если видишь 3 больших прямоугольных помещения с окнами - это 3 жилые комнаты, включи все три. Не пропускай помещения!

КРИТИЧЕСКИ ВАЖНО - ЧТЕНИЕ РАЗМЕРОВ С ЧЕРТЕЖА:
1. ВНИМАТЕЛЬНО ПРОЧИТАЙ ВСЕ ЦИФРЫ И РАЗМЕРЫ, УКАЗАННЫЕ НА ЧЕРТЕЖЕ
2. Ищи размеры в метрах (м, м.п.), сантиметрах (см), миллиметрах (мм)
3. Используй ЭТИ РАЗМЕРЫ напрямую для расчетов - НЕ ПРИДУМЫВАЙ И НЕ ПРИБЛИЖАЙ
4. Если размеры указаны в см или мм - конвертируй в метры (1 м = 100 см = 1000 мм)
5. Если есть размеры стен - используй их для расчета периметра и площади

РАСЧЕТ ПЛОЩАДИ (area):
- Используй ТОЧНЫЕ размеры с чертежа
- Для прямоугольных комнат: длина (из чертежа) × ширина (из чертежа) = площадь в м²
- Для L-образных: разбей на прямоугольники, рассчитай каждую часть, суммируй
- Для сложных форм: разбивай на простые геометрические фигуры
- Округляй результат до одного знака после запятой
- ПРИМЕР: если на чертеже указано 4.2 м × 3.5 м = 14.7 м² (НЕ приближай к 15)

РАСЧЕТ ПЕРИМЕТРА (perimeter):
- Суммируй ВСЕ размеры стен комнаты, указанные на чертеже
- Округляй до одного знака после запятой
- ПРИМЕР: комната 4.2×3.5 имеет периметр 2×(4.2+3.5) = 15.4 м

КОЛИЧЕСТВО УГЛОВ (angles):
- Считай ВНУТРЕННИЕ углы (где стены соединяются внутри комнаты)
- Прямоугольник = 4 угла
- L-образная форма = 6 углов
- Сложные формы = считай каждый внутренний угол стены
- ПРИМЕР: комната с 4 стенами = 4 угла, комната с выступами = больше углов

ОКНА (windows):
- Считай проемы в наружных стенах
- Обычно обозначены на плане (три линии в стене)

ДВЕРИ (doors):
- Считай каждую дверь как одно отверстие
- Двери между комнатами учитываются ОДИН раз (присваивай комнате, в которую открывается)
- Входная дверь - только в прихожей/коридоре

ОПРЕДЕЛЕНИЕ ТИПОВ ПОМЕЩЕНИЙ:
ВАЖНО: Сначала определи ВСЕ помещения, потом классифицируй жилые комнаты.

Шаг 1 - Определение нежилых помещений:
- Ванная комната / Санузел - обычно имеют сантехнику, маленькие, рядом друг с другом
- Коридор / Прихожая - узкое помещение, соединяет комнаты, обычно без окна или с маленьким окном, имеет входную дверь
- Кладовка / Гардеробная - маленькое помещение без окна

Шаг 2 - Определение жилых комнат:
Жилая комната - это помещение, предназначенное для постоянного проживания или отдыха:
- Обычно имеет окно (но не обязательно)
- Имеет площадь обычно от 8-10 м² и больше
- НЕ является коридором, прихожей, санузлом, ванной, кладовкой, гардеробной

КРИТИЧЕСКИ ВАЖНО - ЛОГИКА НАЗВАНИЯ ЖИЛЫХ КОМНАТ:

1. ЕСЛИ ЖИЛЫХ КОМНАТ ТОЛЬКО ОДНА:
   → Назови её "Кухня-гостиная" (это студия)

2. ЕСЛИ ЖИЛЫХ КОМНАТ РОВНО ДВЕ:
   Сначала определи расположение:
   - Найди все мокрые зоны (ванная, туалет, санузел)
   - Определи, какая из двух жилых комнат расположена БЛИЖЕ к мокрым зонам (имеет общую стену или находится рядом)
   
   Если одна комната РЯДОМ с мокрыми зонами:
   → Комната рядом с мокрыми зонами = "Кухня"
   → Другая комната:
     * Если она больше кухни → "Гостиная"
     * Если она меньше кухни → "Спальня"
   
   Если НЕ удается определить по расположению:
   → Сравни размеры комнат:
     * Если меньшая комната очень маленькая (менее 12 м²) → меньшая = "Спальня", большая = "Кухня-гостиная"
     * Если обе комнаты примерно одного размера или обе большие → большая = "Гостиная", меньшая = "Кухня"

3. ЕСЛИ ЖИЛЫХ КОМНАТ БОЛЬШЕ ДВУХ (3, 4, 5 и т.д.):
   Шаг А: Найди все мокрые зоны (ванная, туалет, санузел)
   
   Шаг Б: Определи кухню:
   → Найди жилую комнату, которая РЯДОМ с мокрыми зонами (имеет общую стену или находится ближе всех)
   → Если такая комната найдена → назови её "Кухня" (даже если она не самая маленькая)
   → Если несколько комнат рядом с мокрыми зонами → выбери самую маленькую из них = "Кухня"
   → Если ни одна не рядом с мокрыми зонами → самая маленькая жилая комната = "Кухня"
   
   Шаг В: Определи гостиную:
   → Среди оставшихся комнат (не кухня) самая большая = "Гостиная"
   
   Шаг Г: Остальные комнаты:
   → Все остальные жилые комнаты (не кухня, не гостиная) = "Спальня"

ВАЖНО ПРАВИЛО: Кухня ВСЕГДА располагается рядом с мокрыми зонами (ванная, туалет). Если есть несколько комнат рядом - выбирай самую маленькую.

ПОШАГОВЫЙ АЛГОРИТМ АНАЛИЗА:
1. Найдите ВСЕ размеры на чертеже (стены, проемы, общие размеры)
2. Определите границы ВСЕХ помещений на плане
3. Сначала определи и классифицируй ВСЕ нежилые помещения (ванная, туалет, коридор, прихожая)
4. Определи все ЖИЛЫЕ комнаты (большие помещения с окнами, подходящие для проживания)
5. НЕ ПРОПУСКАЙ помещения! Проверь, что ты посчитал ВСЕ комнаты на плане
6. Примени логику названия жилых комнат согласно правилам выше (1, 2 или 3+ комнаты)
7. Для каждой комнаты:
   - Считай размеры стен с чертежа
   - Рассчитай площадь ТОЧНО по этим размерам
   - Рассчитай периметр ТОЧНО по этим размерам
   - Посчитай углы визуально
   - Посчитай окна и двери
8. Используй реальные размеры - если на чертеже указано "4.2 м", используй 4.2, а не 4 или 5

ВЫСОТА ПОТОЛКОВ (ceilingHeight):
- Если указана на чертеже - используй это значение
- Если нет - определи по типу объекта:
  * Хрущевка: 2.5-2.6 м (обычно 2.5)
  * Типовые дома: 2.7-2.8 м (обычно 2.7)
  * Новостройки: 2.8-3.0 м (обычно 2.8)
- Укажи ОДНО число, например: "2.7"

ФОРМАТ ОТВЕТА:
- Все размеры в метрах (м) или квадратных метрах (м²)
- Площадь: число с одним знаком после запятой (например: "14.7", "23.5")
- Периметр: число с одним знаком после запятой (например: "15.4", "22.8")
- Углы, двери, окна: целые числа (например: "4", "6", "1")
- НЕ округляй слишком сильно - используй точные вычисления

КРИТИЧЕСКИ ВАЖНО - СТРУКТУРА ОТВЕТА:
Ответ должен быть строго в формате JSON со следующей структурой:

{
  "rooms": [
    {
      "id": "room-1",
      "name": "Спальня",
      "description": "Описание комнаты",
      "suggestedStyle": "Современный",
      "area": "15.5",
      "perimeter": "16.8",
      "angles": "4",
      "doors": "1",
      "windows": "1"
    },
    {
      "id": "room-2",
      "name": "Кухня",
      "description": "Описание комнаты",
      "suggestedStyle": "Современный",
      "area": "12.3",
      "perimeter": "14.2",
      "angles": "4",
      "doors": "1",
      "windows": "1"
    }
  ],
  "architecturalStyle": "Современный",
  "propertyDescription": "2-комнатная квартира",
  "globalDescription": "Детальное описание объекта",
  "ceilingHeight": "2.7",
  "totalAreaEstimate": "27.8"
}

ОБЯЗАТЕЛЬНО верни МАССИВ rooms с ВСЕМИ помещениями, которые видишь на плане. НЕ ПРОПУСКАЙ комнаты! 

ВАЖНО - ПРИМЕРЫ ПРАВИЛЬНОЙ КЛАССИФИКАЦИИ:

Пример 1 - Студия (1 жилая комната):
{
  "rooms": [
    { "name": "Кухня-гостиная", "area": "25.0", ... },
    { "name": "Ванная", "area": "4.5", ... },
    { "name": "Туалет", "area": "1.5", ... }
  ]
}

Пример 2 - Двушка (2 жилые комнаты):
Вариант А - если одна комната рядом с ванной:
{
  "rooms": [
    { "name": "Кухня", "area": "12.0", ... }, // Рядом с ванной
    { "name": "Гостиная", "area": "18.5", ... }, // Больше кухни
    { "name": "Ванная", ... }
  ]
}

Вариант Б - если обе комнаты далеко от ванной, меньшая очень маленькая:
{
  "rooms": [
    { "name": "Спальня", "area": "10.0", ... }, // Маленькая
    { "name": "Кухня-гостиная", "area": "22.0", ... }, // Большая
    { "name": "Ванная", ... }
  ]
}

Пример 3 - Трешка (3+ жилые комнаты):
{
  "rooms": [
    { "name": "Гостиная", "area": "20.0", ... }, // Самая большая
    { "name": "Кухня", "area": "11.0", ... }, // Рядом с ванной, самая маленькая
    { "name": "Спальня", "area": "15.0", ... }, // Остальные
    { "name": "Спальня", "area": "14.0", ... },
    { "name": "Ванная", ... }
  ]
}

Проверь: 
1. Посчитай все прямоугольные/большие области на плане и убедись, что каждая включена в массив rooms
2. Примени правильную логику названий согласно количеству жилых комнат
3. Убедись, что кухня всегда рядом с мокрыми зонами
4. Каждая комната должна иметь все указанные поля`;

        const content = [
            convertImagePartToOpenAIFormat(imagePart),
            convertTextPart(prompt)
        ];

        const requestBody: any = {
            model: "google/gemini-3-flash-preview",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            // Снижаем temperature для более точных числовых расчетов
            temperature: 0.2,
            response_format: { type: "json_object" },
        };

        const response = await makeRouterAIRequest("/chat/completions", requestBody);

        const textResponse = response.choices?.[0]?.message?.content || "";
        
        if (!textResponse) {
            throw new Error("Пустой ответ от RouterAI. Проверьте API ключ и доступность сервиса.");
        }

        let parsed: any;
        try {
            parsed = JSON.parse(textResponse);
        } catch (e) {
            console.warn("Failed to parse JSON directly, trying to clean...", e);
            const clean = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                parsed = JSON.parse(clean);
            } catch (e2) {
                console.error("Failed to parse cleaned JSON:", clean);
                throw new Error(`Не удалось распарсить JSON ответ: ${textResponse.substring(0, 200)}`);
            }
        }
        
        // ВАЖНО: RouterAI может возвращать массив вместо объекта
        // Если parsed - это массив, берем первый элемент
        if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
                throw new Error("Пустой массив в ответе от API");
            }
            parsed = parsed[0];
        }
        
        // Проверяем различные возможные форматы ответа
        if (!parsed) {
            console.error("Parsed is null or undefined");
            throw new Error("Пустой ответ от API");
        }
        
        // Проверяем наличие rooms в разных возможных местах
        if (!parsed.rooms) {
            // Возможно, ответ пришел в другом формате
            if (parsed.roomList) {
                parsed.rooms = parsed.roomList;
            } else if (parsed.комнаты) {
                parsed.rooms = parsed.комнаты;
            } else {
                parsed.rooms = [];
            }
        }
        
        if (Array.isArray(parsed.rooms)) {
            parsed.rooms = parsed.rooms.map((r: any, idx: number) => {
                return { 
                    ...r,
                    id: r.id || `room-${Date.now()}-${idx}`,
                    name: r.name || `Комната ${idx + 1}`,
                    description: r.description || '',
                    suggestedStyle: r.suggestedStyle || 'Современный',
                    area: String(r.area || '0'),
                    perimeter: String(r.perimeter || '0'),
                    angles: String(r.angles || '4'),
                    doors: String(r.doors || '0'),
                    windows: String(r.windows || '0'),
                    furniture: r.furniture || [],
                    realPhotos: r.realPhotos || []
                };
            });
        } else {
            console.error("Rooms is not an array, it's:", typeof parsed.rooms, parsed.rooms);
            parsed.rooms = [];
        }
        
        // Проверяем, что rooms не пустой
        if (!parsed.rooms || parsed.rooms.length === 0) {
            console.error("ERROR: No rooms found in response!");
            console.error("Full parsed response:", JSON.stringify(parsed, null, 2));
            throw new Error("API не вернул ни одной комнаты. Проверьте, что на чертеже видны комнаты, и попробуйте снова.");
        }
        
        
        // Убеждаемся, что есть хотя бы базовые поля
        if (!parsed.architecturalStyle) {
            parsed.architecturalStyle = 'Современный';
        }
        if (!parsed.propertyDescription) {
            parsed.propertyDescription = 'Квартира';
        }
        if (!parsed.globalDescription) {
            parsed.globalDescription = '';
        }
        if (!parsed.ceilingHeight) {
            parsed.ceilingHeight = '2.7';
        }
        if (!parsed.totalAreaEstimate) {
            const totalArea = parsed.rooms.reduce((sum: number, r: any) => {
                const area = parseFloat(String(r.area || '0'));
                return sum + (isNaN(area) ? 0 : area);
            }, 0);
            parsed.totalAreaEstimate = totalArea.toFixed(1);
        }

        if (parsed.ceilingHeight) {
            const match = String(parsed.ceilingHeight).match(/[0-9.]+/);
            parsed.ceilingHeight = match ? match[0] : '';
        }

        if (parsed.propertyDescription && parsed.propertyDescription.length > 60) {
            parsed.propertyDescription = parsed.propertyDescription.substring(0, 57) + '...';
        }

        parsed.propertyPhotos = [];
        return parsed as AnalysisResult;
    } catch (error: any) {
        console.error("Error in analyzeFloorPlan:", error);
        handleApiError(error);
        throw error;
    }
};

export const identifyStyleFromImage = async (imagePart: GenerativePart): Promise<string> => {
    const styleList = ['Современный', 'Скандинавский', 'Лофт', 'Минимализм', 'Неоклассика', 'Джапанди', 'Ар-деко', 'Хай-тек'];
    try {
        const prompt = `Identify the interior design style of this image. Choose ONLY one style from this exact list: [${styleList.join(', ')}]. Return only the name of the style in Russian.`;

        const content = [
            convertImagePartToOpenAIFormat(imagePart),
            convertTextPart(prompt)
        ];

        const response = await makeRouterAIRequest("/chat/completions", {
            model: "google/gemini-3-flash-preview",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            temperature: 0.3,
        });

        const detected = response.choices?.[0]?.message?.content?.trim() || '';
        return styleList.find(s => detected.includes(s)) || 'Современный';
    } catch (error) {
        console.error("Style Detection Error:", error);
        return 'Современный';
    }
};

// Вспомогательная функция для извлечения изображения из ответа RouterAI
const extractImageFromRouterAIResponse = (response: any, message: any): string => {
    const imageContent = message.content;
    
    // Если content пустой, проверяем альтернативные места в ответе
    if (!imageContent || (typeof imageContent === 'string' && imageContent.trim().length === 0)) {
        // Проверяем все поля message на наличие изображения
        for (const key of Object.keys(message)) {
            if (key !== 'content' && key !== 'role' && key !== 'refusal') {
                const value = message[key];
                
                // Если это массив (например, reasoning_details), проверяем каждый элемент
                if (Array.isArray(value)) {
                    for (let i = 0; i < value.length; i++) {
                        const item = value[i];
                        // Проверяем различные форматы изображений
                        if (item.type === 'image' || item.type === 'image_url') {
                            if (item.image_url) {
                                return item.image_url.url || item.image_url;
                            }
                            if (item.data) {
                                return `data:image/png;base64,${item.data}`;
                            }
                        }
                        if (item.inlineData && item.inlineData.data) {
                            return `data:image/png;base64,${item.inlineData.data}`;
                        }
                        // Проверяем, не является ли сам элемент строкой с base64
                        if (typeof item === 'string' && item.length > 100) {
                            if (item.startsWith('data:image/')) {
                                return item;
                            }
                            if (!item.startsWith('http') && /^[A-Za-z0-9+/=]+$/.test(item.substring(0, 100))) {
                                return `data:image/png;base64,${item}`;
                            }
                        }
                    }
                }
                // Если это объект, проверяем на наличие изображения
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    if (value.image_url) {
                        return value.image_url.url || value.image_url;
                    }
                    if (value.data && typeof value.data === 'string' && value.data.length > 100) {
                        return `data:image/png;base64,${value.data}`;
                    }
                    if (value.inlineData && value.inlineData.data) {
                        return `data:image/png;base64,${value.inlineData.data}`;
                    }
                }
            }
        }
        
        // Проверяем корневой уровень response
        if (response.data && typeof response.data === 'string' && response.data.length > 100) {
            return response.data.startsWith('data:') ? response.data : `data:image/png;base64,${response.data}`;
        }
        
        throw new Error("RouterAI вернул пустой content для генерации изображения. Изображение не найдено в ответе.");
    }
    
    // Если content не пустой, обрабатываем стандартным способом
    // Если это строка
    if (typeof imageContent === 'string') {
        if (imageContent.startsWith('data:image/')) {
            return imageContent;
        }
        if (!imageContent.startsWith('http') && imageContent.length > 100) {
            return `data:image/png;base64,${imageContent}`;
        }
        if (imageContent.startsWith('http')) {
            return imageContent;
        }
    }
    
    // Если content это объект
    if (imageContent && typeof imageContent === 'object') {
        if (imageContent.image_url) {
            return imageContent.image_url.url || imageContent.image_url;
        }
        if (imageContent.url) {
            return imageContent.url;
        }
        if (imageContent.data) {
            return `data:image/png;base64,${imageContent.data}`;
        }
    }

    // Если content это массив
    if (Array.isArray(imageContent)) {
        for (const part of imageContent) {
            if (part.type === 'image_url' && part.image_url) {
                return part.image_url.url || part.image_url;
            }
            if (typeof part === 'string' && part.startsWith('data:image/')) {
                return part;
            }
            if (typeof part === 'string' && part.length > 100 && !part.startsWith('http')) {
                return `data:image/png;base64,${part}`;
            }
        }
    }
    
    throw new Error("Не удалось извлечь изображение из ответа RouterAI.");
};

// Генерация изометрического вида через RouterAI
export const generateIsometricView = async (planPart: GenerativePart, style: string, size: ImageSize = '1K', styleReferenceImage?: string): Promise<string> => {
    try {
        let prompt = `Create a stunning high-quality 3D isometric floor plan render. Style: ${style}. Photorealistic. High resolution. Detailed architectural visualization.`;
        
        const content: any[] = [convertTextPart(prompt), convertImagePartToOpenAIFormat(planPart)];
        
        if (styleReferenceImage) {
            prompt += " Use provided reference for style and colors.";
            content.push(convertImagePartToOpenAIFormat(dataUrlToGenerativePart(styleReferenceImage)));
        }

        const response = await makeRouterAIRequest("/chat/completions", {
            model: "google/gemini-3-pro-image-preview",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            temperature: 0.8,
        });

        const message = response.choices?.[0]?.message;
        
        if (!message) {
            throw new Error("Пустой ответ от RouterAI при генерации изображения");
        }

        return extractImageFromRouterAIResponse(response, message);
    } catch (error: any) {
        console.error("Error in generateIsometricView:", error);
        handleApiError(error);
        throw error;
    }
};

// Генерация интерьера комнаты
export const generateRoomInterior = async (room: Room, style: string, planPartReference: GenerativePart, size: ImageSize = '1K', styleReferenceImage?: string): Promise<string> => {
    try {
        const prompt = `Interior design photography of ${room.name}. Style: ${style}. High quality, cinematic lighting. Photorealistic.`;
        
        const content: any[] = [
            convertTextPart(prompt),
            convertImagePartToOpenAIFormat(planPartReference)
        ];
        
        // Добавляем дополнительные изображения мебели
        if (room.furniture) {
            room.furniture.forEach(item => {
                if (item.image) {
                    content.push(convertImagePartToOpenAIFormat(dataUrlToGenerativePart(item.image)));
                }
            });
        }
        
        // Добавляем реальные фото комнаты
        if (room.realPhotos) {
            room.realPhotos.forEach(photo => {
                content.push(convertImagePartToOpenAIFormat(dataUrlToGenerativePart(photo)));
            });
        }
        
        // Добавляем референс стиля
        if (styleReferenceImage) {
            content.push(convertImagePartToOpenAIFormat(dataUrlToGenerativePart(styleReferenceImage)));
        }

        const response = await makeRouterAIRequest("/chat/completions", {
            model: "google/gemini-3-pro-image-preview",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            temperature: 0.8,
        });

        const message = response.choices?.[0]?.message;
        if (!message) {
            throw new Error("Пустой ответ от RouterAI при генерации изображения комнаты");
        }

        return extractImageFromRouterAIResponse(response, message);
    } catch (error: any) {
        return handleApiError(error);
    }
};

// Редактирование изображения
export const editGeneratedImage = async (imagePartToEdit: GenerativePart, editPrompt: string): Promise<string> => {
    try {
        const prompt = `Edit this image: ${editPrompt}`;
        
        const content = [
            convertImagePartToOpenAIFormat(imagePartToEdit),
            convertTextPart(prompt)
        ];

        const response = await makeRouterAIRequest("/chat/completions", {
            model: "google/gemini-3-pro-image-preview",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            temperature: 0.7,
        });

        const message = response.choices?.[0]?.message;
        if (!message) {
            throw new Error("Пустой ответ от RouterAI при редактировании изображения");
        }

        return extractImageFromRouterAIResponse(response, message);
    } catch (error: any) {
        return handleApiError(error);
    }
};

// Интерфейс для распознанных пунктов сметы из голосового ввода
export interface VoiceEstimationItem {
    name: string;
    category: string; // Подкатегория работ (Демонтажные работы, Черновые отделочные работы и т.д.)
    quantity: number | null; // null если нужно взять из параметров комнаты
    quantitySource: 'voice' | 'floorArea' | 'wallArea' | 'perimeter' | 'doors' | 'windows' | 'ceilingArea' | 'fixed';
    unit: string;
    type: 'work' | 'rough' | 'finish';
    suggestedPrice?: number;
}

// Парсинг голосового ввода для сметы
export const parseVoiceEstimation = async (
    voiceText: string, 
    roomParams: { 
        name: string;
        floorArea: number; 
        wallArea: number; 
        perimeter: number;
        doors: number;
        windows: number;
        ceilingHeight: number;
    },
    priceList: { id: string; name: string; unit: string; price: number; category: string; type: 'work' | 'rough' | 'finish' }[]
): Promise<VoiceEstimationItem[]> => {
    try {
        // Формируем список доступных работ из прайс-листа
        const availableWorks = priceList
            .filter(p => p.type === 'work')
            .map(p => `"${p.name}" (${p.unit}, ${p.price}₽, категория: ${p.category})`)
            .join('\n');
        
        const availableMaterials = priceList
            .filter(p => p.type === 'rough' || p.type === 'finish')
            .map(p => `"${p.name}" (${p.unit}, ${p.price}₽, тип: ${p.type === 'rough' ? 'черновой' : 'чистовой'})`)
            .join('\n');

        const prompt = `Ты эксперт по строительным сметам. Проанализируй голосовой запрос пользователя и извлеки все упомянутые работы и материалы.

ГОЛОСОВОЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ:
"${voiceText}"

ПАРАМЕТРЫ КОМНАТЫ "${roomParams.name}":
- Площадь пола: ${roomParams.floorArea} м²
- Площадь стен: ${roomParams.wallArea} м²
- Периметр: ${roomParams.perimeter} м
- Высота потолков: ${roomParams.ceilingHeight} м
- Площадь потолка: ${roomParams.floorArea} м²
- Двери: ${roomParams.doors} шт
- Окна: ${roomParams.windows} шт

ДОСТУПНЫЕ РАБОТЫ ИЗ ПРАЙС-ЛИСТА:
${availableWorks}

ДОСТУПНЫЕ МАТЕРИАЛЫ ИЗ ПРАЙС-ЛИСТА:
${availableMaterials}

ЗАДАЧА:
1. Извлеки ВСЕ упомянутые работы и материалы из голосового запроса
2. Для каждой позиции определи:
   - name: точное название из прайс-листа (если есть похожее) или как сказал пользователь
   - category: категория работ (одна из: "Подготовительные работы", "Демонтажные работы", "Черновая электрика", "Черновая сантехника", "Черновые отделочные работы", "Чистовые отделочные работы", "Чистовая сантехника", "Чистовая электрика", "Завершающие работы")
   - quantity: число если пользователь назвал, или null если не назвал
   - quantitySource: откуда взять количество:
     * "voice" - если пользователь назвал число
     * "wallArea" - для работ со стенами (штукатурка, шпаклёвка, покраска стен, обои, грунтовка стен, плитка на стены)
     * "floorArea" - для работ с полом (стяжка, наливной пол, ламинат, плитка на пол, грунтовка пола)
     * "ceilingArea" - для работ с потолком (покраска потолка, натяжной потолок)
     * "perimeter" - для погонных работ (плинтус, кабель, штробление)
     * "doors" - для дверей (демонтаж/установка дверей)
     * "windows" - для окон
     * "fixed" - для штучных работ (установка розеток, выключателей, сантехники) - ставь quantity=1 если не указано
   - unit: единица измерения (м2, п.м, шт, и т.д.)
   - type: "work" для работ, "rough" для черновых материалов, "finish" для чистовых материалов
   - suggestedPrice: цена из прайс-листа если нашёл совпадение

ВАЖНЫЕ ПРАВИЛА:
- Если пользователь сказал "50 квадратов" или "50 метров" - это quantity из голоса (quantitySource: "voice")
- Если пользователь НЕ назвал количество - определи quantitySource по типу работы
- Грунтовка, штукатурка, шпаклёвка, покраска, обои = работа со СТЕНАМИ → wallArea
- Стяжка, наливной пол, ламинат, плитка на пол = работа с ПОЛОМ → floorArea
- Плинтус, кабель, провода = ПЕРИМЕТР → perimeter
- Натяжной потолок, покраска потолка = ПОТОЛОК → ceilingArea (равна площади пола)
- Ищи максимально близкое совпадение в прайс-листе

Верни JSON массив:
[
  {
    "name": "Штукатурка по маякам",
    "category": "Черновые отделочные работы",
    "quantity": 50,
    "quantitySource": "voice",
    "unit": "м2",
    "type": "work",
    "suggestedPrice": 550
  },
  {
    "name": "Грунтовка стен",
    "category": "Подготовительные работы",
    "quantity": null,
    "quantitySource": "wallArea",
    "unit": "м2",
    "type": "work",
    "suggestedPrice": 150
  }
]`;

        const response = await makeRouterAIRequest("/chat/completions", {
            model: "google/gemini-3-flash-preview",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
        });

        const textResponse = response.choices?.[0]?.message?.content || "";
        
        if (!textResponse) {
            throw new Error("Пустой ответ от ИИ при парсинге голосового ввода");
        }

        let parsed: any;
        try {
            parsed = JSON.parse(textResponse);
        } catch (e) {
            const clean = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(clean);
        }
        
        // Если ответ - объект с массивом items, извлекаем массив
        if (parsed && !Array.isArray(parsed) && parsed.items) {
            parsed = parsed.items;
        }
        
        if (!Array.isArray(parsed)) {
            console.error("Unexpected response format:", parsed);
            return [];
        }
        
        // Валидируем и нормализуем результат
        return parsed.map((item: any) => ({
            name: item.name || 'Неизвестная работа',
            category: item.category || 'Черновые отделочные работы',
            quantity: item.quantity,
            quantitySource: item.quantitySource || 'fixed',
            unit: item.unit || 'шт',
            type: item.type || 'work',
            suggestedPrice: item.suggestedPrice || 0
        }));
    } catch (error: any) {
        console.error("Error parsing voice estimation:", error);
        throw error;
    }
};

