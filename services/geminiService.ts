
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ImageSize, Room } from "../types.ts";

export interface GenerativePart {
    inlineData: {
        mimeType: string;
        data: string;
    };
}

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
}

const ensureApiKey = async () => {
  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  }
};

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const handleApiError = async (error: any) => {
    console.error("Gemini API Error:", error);
    const msg = error.message || error.toString();
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
        // @ts-ignore
        if (window.aistudio && window.aistudio.openSelectKey) {
             // @ts-ignore
             await window.aistudio.openSelectKey();
             throw new Error("Доступ запрещен. Окно выбора ключа открыто.");
        }
    }
    throw error;
}

export const analyzeFloorPlan = async (imagePart: GenerativePart): Promise<AnalysisResult> => {
  await ensureApiKey();
  const ai = getAiClient();
  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            imagePart,
            { text: "Проанализируй этот план помещения. Составь список комнат. Также определи тип объекта (напр. '2х комнатная хрущевка') и примерную высоту потолков (СТРОГО ОДНО ЧИСЛО, напр. 2.7, не пиши диапазоны). Для каждой комнаты укажи: 1) Название, 2) Описание, 3) Примерную площадь (цифра), 4) Рекомендуемый стиль, 5) Примерный периметр (цифра), 6) Количество углов (цифра), 7) Количество дверей (цифра), 8) Количество окон (цифра). \n\nВАЖНО ПО ДВЕРЯМ: Каждая дверь между комнатами должна быть учтена только ОДИН раз за весь объект (присвой ее одной из комнат, обычно той, в которую она открывается). В прихожей/коридоре считай только входную дверь. Если комната проходная, не дублируй дверные проемы, которые уже посчитаны в других жилых комнатах. Как правило, в каждой жилой комнате 1 дверь, в санузле 1 дверь, в коридоре 1 входная дверь. Ответ должен быть на русском языке." }
          ]
        },
        config: {
          // @ts-ignore
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rooms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    suggestedStyle: { type: Type.STRING },
                    area: { type: Type.STRING },
                    perimeter: { type: Type.STRING },
                    angles: { type: Type.STRING },
                    doors: { type: Type.STRING },
                    windows: { type: Type.STRING }
                  },
                  required: ["id", "name", "description"]
                }
              },
              architecturalStyle: { type: Type.STRING },
              propertyDescription: { type: Type.STRING, description: "Короткое название объекта, макс 60 символов" },
              globalDescription: { type: Type.STRING, description: "Детальное описание всего объекта" },
              ceilingHeight: { type: Type.STRING, description: "Высота потолков СТРОГО одним числом, напр. 2.7" },
              totalAreaEstimate: { type: Type.STRING }
            }
          }
        }
      });

      if (response.text) {
        let parsed: any;
        try {
            parsed = JSON.parse(response.text);
        } catch (e) {
            const clean = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(clean);
        }
        
        if (parsed && Array.isArray(parsed.rooms)) {
            parsed.rooms = parsed.rooms.map((r: any) => ({ 
                ...r, 
                furniture: [],
                realPhotos: [] 
            }));
        } else {
            parsed.rooms = [];
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
      }
      throw new Error("Не удалось получить текстовый ответ от ИИ");
  } catch (error) {
      return handleApiError(error);
  }
};

export const identifyStyleFromImage = async (imagePart: GenerativePart): Promise<string> => {
  await ensureApiKey();
  const ai = getAiClient();
  const styleList = ['Современный', 'Скандинавский', 'Лофт', 'Минимализм', 'Неоклассика', 'Джапанди', 'Ар-деко', 'Хай-тек'];
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          imagePart,
          { text: `Identify the interior design style of this image. Choose ONLY one style from this exact list: [${styleList.join(', ')}]. Return only the name of the style in Russian.` }
        ]
      }
    });
    const detected = response.text?.trim();
    return styleList.find(s => detected?.includes(s)) || 'Современный';
  } catch (error) {
    console.error("Style Detection Error:", error);
    return 'Современный';
  }
};

export const generateIsometricView = async (planPart: GenerativePart, style: string, size: ImageSize = '1K', styleReferenceImage?: string): Promise<string> => {
  await ensureApiKey();
  const ai = getAiClient();
  let prompt = `Create a stunning high-quality 3D isometric floor plan render. Style: ${style}. Photorealistic.`;
  const parts: any[] = [{ text: prompt }, planPart];
  if (styleReferenceImage) {
      parts[0].text += " Use provided reference for style and colors.";
      parts.push(dataUrlToGenerativePart(styleReferenceImage));
  }
  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: parts },
        config: { imageConfig: { imageSize: size, aspectRatio: "16:9" } },
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Изображение не найдено");
  } catch (error) {
      return handleApiError(error);
  }
};

export const generateRoomInterior = async (room: Room, style: string, planPartReference: GenerativePart, size: ImageSize = '1K', styleReferenceImage?: string): Promise<string> => {
  await ensureApiKey();
  const ai = getAiClient();
  const extraParts = [];
  if (room.furniture) room.furniture.forEach(item => { if (item.image) extraParts.push(dataUrlToGenerativePart(item.image)); });
  if (room.realPhotos) room.realPhotos.forEach(photo => extraParts.push(dataUrlToGenerativePart(photo)));
  if (styleReferenceImage) extraParts.push(dataUrlToGenerativePart(styleReferenceImage));

  const prompt = `Interior design photography of ${room.name}. Style: ${style}. High quality, cinematic lighting.`;
  const parts: any[] = [{ text: prompt }, planPartReference, ...extraParts];
  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: parts },
        config: { imageConfig: { imageSize: size, aspectRatio: "4:3" } },
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Изображение комнаты не сгенерировано");
  } catch (error) {
      return handleApiError(error);
  }
};

export const editGeneratedImage = async (imagePartToEdit: GenerativePart, editPrompt: string): Promise<string> => {
  const ai = getAiClient();
  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePartToEdit, { text: `Edit this image: ${editPrompt}` }] }
      });
       for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Ошибка редактирования");
  } catch (error) {
      return handleApiError(error);
  }
};
