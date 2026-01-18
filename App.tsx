
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowRight, Home, Box, Maximize2, Loader2, Image as ImageIcon, 
  Camera, Moon, Sun, PenTool, Ruler, Palette, Plus, Trash2, 
  Armchair, LayoutTemplate, X, Info, FileImage, Hash, 
  ArrowUpToLine, Folder, Settings, CreditCard, LogOut, 
  ChevronRight, Search, Menu, CircleHelp, ImagePlus,
  ChevronDown, Calculator, DoorOpen, Layout, Hammer, Package, Sparkles,
  Mic, MicOff, Upload, FileSpreadsheet, RefreshCw, ExternalLink,
  LayoutDashboard, CheckSquare, TrendingUp, Building, Users, Warehouse,
  ShoppingCart, Package2, Wrench, RotateCcw, History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PlanUploader } from './components/PlanUploader.tsx';
import { ImageEditorModal } from './components/ImageEditorModal.tsx';
import { UsersManagement } from './components/UsersManagement.tsx';
import { SuperAdminPanel } from './components/SuperAdminPanel.tsx';
import { SuppliersModal } from './components/SuppliersModal.tsx';
import { EstimateExportModal } from './components/EstimateExportModal.tsx';
import { PurchaseRequestsList } from './components/Warehouse/PurchaseRequestsList.tsx';
import { PurchaseRequestDetails } from './components/Warehouse/PurchaseRequestDetails.tsx';
import { PurchaseRequestForm } from './components/Warehouse/PurchaseRequestForm.tsx';
import { ProjectMaterialsList } from './components/Warehouse/ProjectMaterialsList.tsx';
import { ProjectMaterialsCard } from './components/Warehouse/ProjectMaterialsCard.tsx';
import { ToolsList } from './components/Warehouse/ToolsList.tsx';
import { ToolDetails } from './components/Warehouse/ToolDetails.tsx';
import { ToolForm } from './components/Warehouse/ToolForm.tsx';
import { ReturnsList } from './components/Warehouse/ReturnsList.tsx';
import { ReturnForm } from './components/Warehouse/ReturnForm.tsx';
import { OperationsList } from './components/Warehouse/OperationsList.tsx';
import { DealsKanban } from './components/Sales/DealsKanban.tsx';
import { exportEstimateToXLSX } from './services/estimateExporter.ts';
import { ExportOptions } from './types.ts';
import { analyzeFloorPlan, generateIsometricView, generateRoomInterior, fileToGenerativePart, identifyStyleFromImage, parseVoiceEstimation, VoiceEstimationItem } from './services/routeraiService.ts';
import { AppState, AnalysisResult, Room, ImageSize, FurnitureItem, Project, EstimationItem, RoomEstimation, PERMISSIONS, PurchaseRequest } from './types.ts';
import { useAuth, usePermission } from './contexts/AuthContext.tsx';
import { api, getImageUrl } from './services/api.ts';

const PREDEFINED_STYLES = [
  'Современный', 'Скандинавский', 'Лофт', 'Минимализм', 'Неоклассика', 'Джапанди', 'Ар-деко', 'Хай-тек'
];

const STYLE_DESCRIPTIONS: Record<string, string> = {
  'Современный': 'Функциональность, чистые линии, нейтральные цвета, практичность.',
  'Скандинавский': 'Уют, светлые тона, натуральное дерево, простота и функциональность.',
  'Лофт': 'Индустриальный шарм, кирпичные стены, бетон, открытые коммуникации.',
  'Минимализм': 'Лаконичность, только необходимое, много света, отсутствие декора.',
  'Неоклассика': 'Элегантность и классика в современном прочнении.',
  'Джапанди': 'Гибрид скандинавского уюта и японской эстетики ваби-саби.',
  'Ар-деко': 'Гламур, геометрические узоры, дорогие материалы, контрасты.',
  'Хай-тек': 'Технологичность, стекло, металл, хром, футуристичные формы.'
};

const ROUGH_WORK_SECTIONS = [
  "Подготовительные работы",
  "Демонтажные работы",
  "Черновая электрика",
  "Черновая сантехника",
  "Черновые отделочные работы"
];

const FINISH_WORK_SECTIONS = [
  "Чистовые отделочные работы",
  "Чистовая сантехника",
  "Чистовая электрика",
  "Установочные работы",
  "Прочие работы",
  "Подключение оборудования"
];

// Секции только для общей сметы (не для смет комнат)
const GLOBAL_ONLY_SECTIONS = ["Умный дом", "Накладные расходы"];

const WORK_SUBSECTIONS = [...ROUGH_WORK_SECTIONS, ...FINISH_WORK_SECTIONS];

// Все секции включая только глобальные
const ALL_WORK_SECTIONS = [...WORK_SUBSECTIONS, ...GLOBAL_ONLY_SECTIONS];

// Подразделы для отделочных работ
const FINISHING_SUBCATEGORIES = ['Пол', 'Стены', 'Потолок'];

// Функция для определения подкатегории по названию работы
const inferSubcategoryFromName = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('пол') || lowerName.includes('стяжк') || lowerName.includes('наливн') || lowerName.includes('ламинат') || lowerName.includes('плитк') || lowerName.includes('паркет') || lowerName.includes('линолеум')) {
    return 'Пол';
  }
  if (lowerName.includes('стен') || lowerName.includes('штукатур') || lowerName.includes('шпакл') || lowerName.includes('обо') || lowerName.includes('краск') || lowerName.includes('покраск') || lowerName.includes('грунт')) {
    return 'Стены';
  }
  if (lowerName.includes('потол') || lowerName.includes('натяжн')) {
    return 'Потолок';
  }
  return 'Стены'; // По умолчанию - стены
};

// Секции с подразделами
const SECTIONS_WITH_SUBCATEGORIES = ['Черновые отделочные работы', 'Чистовые отделочные работы'];

// Состояния объекта для автозаполнения смет
const PROPERTY_CONDITIONS = [
  { id: 'new_bare', name: 'Новостройка без отделки', description: 'Голые стены, нет коммуникаций' },
  { id: 'new_rough', name: 'Новостройка с черновой', description: 'Есть стяжка, штукатурка, проводка' },
  { id: 'new_pre_finish', name: 'Новостройка с предчистовой', description: 'Выровнены стены/полы' },
  { id: 'new_finish', name: 'Новостройка с чистовой', description: 'Готова к проживанию' },
  { id: 'secondary', name: 'Вторичка со старым ремонтом', description: 'Требует демонтажа' },
] as const;

const RENOVATION_TYPES = [
  { id: 'cosmetic', name: 'Косметический', description: 'Только финишная отделка' },
  { id: 'capital', name: 'Капитальный', description: 'Полная переделка' },
] as const;

type PropertyCondition = typeof PROPERTY_CONDITIONS[number]['id'];
type RenovationType = typeof RENOVATION_TYPES[number]['id'];

// Определение типа комнаты по названию
const getRoomType = (roomName: string): 'wet' | 'living' | 'kitchen' | 'corridor' => {
  const name = roomName.toLowerCase();
  if (name.includes('ванн') || name.includes('туалет') || name.includes('санузел') || name.includes('душ') || name.includes('wc')) return 'wet';
  if (name.includes('кухн') || name.includes('kitchen')) return 'kitchen';
  if (name.includes('коридор') || name.includes('прихож') || name.includes('холл') || name.includes('hall')) return 'corridor';
  return 'living';
};

export interface PriceItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  category: string;
  subcategory?: string; // Для отделочных работ: стены, пол, потолок
  type: 'work' | 'rough' | 'finish';
  supplierUrl?: string;
  supplierName?: string;
  lastPriceUpdate?: string;
  autoPriceUpdate?: boolean;
}

// Подразделы для отделочных работ
const FINISHING_SUBSECTIONS = ['Стены', 'Пол', 'Потолок'] as const;

const DEFAULT_PRICES: PriceItem[] = [
  // === РАБОТЫ ===
  // Подготовительные работы (10)
  { id: 'w1', name: 'Грунтовка стен', unit: 'м2', price: 150, category: 'Подготовительные работы', type: 'work' },
  { id: 'w2', name: 'Грунтовка потолка', unit: 'м2', price: 180, category: 'Подготовительные работы', type: 'work' },
  { id: 'w3', name: 'Грунтовка пола', unit: 'м2', price: 120, category: 'Подготовительные работы', type: 'work' },
  { id: 'w4', name: 'Обеспыливание поверхностей', unit: 'м2', price: 80, category: 'Подготовительные работы', type: 'work' },
  { id: 'w5', name: 'Укрытие полов плёнкой', unit: 'м2', price: 50, category: 'Подготовительные работы', type: 'work' },
  { id: 'w6', name: 'Заделка трещин', unit: 'п.м', price: 200, category: 'Подготовительные работы', type: 'work' },
  { id: 'w7', name: 'Армирование сеткой', unit: 'м2', price: 250, category: 'Подготовительные работы', type: 'work' },
  { id: 'w8', name: 'Обработка антисептиком', unit: 'м2', price: 100, category: 'Подготовительные работы', type: 'work' },
  { id: 'w9', name: 'Установка маяков', unit: 'п.м', price: 150, category: 'Подготовительные работы', type: 'work' },
  { id: 'w10', name: 'Вынос мусора', unit: 'меш', price: 300, category: 'Подготовительные работы', type: 'work' },
  
  // Демонтажные работы (10)
  { id: 'w11', name: 'Демонтаж обоев', unit: 'м2', price: 100, category: 'Демонтажные работы', type: 'work' },
  { id: 'w12', name: 'Демонтаж плитки', unit: 'м2', price: 350, category: 'Демонтажные работы', type: 'work' },
  { id: 'w13', name: 'Демонтаж ламината', unit: 'м2', price: 150, category: 'Демонтажные работы', type: 'work' },
  { id: 'w14', name: 'Демонтаж паркета', unit: 'м2', price: 200, category: 'Демонтажные работы', type: 'work' },
  { id: 'w15', name: 'Демонтаж стяжки', unit: 'м2', price: 450, category: 'Демонтажные работы', type: 'work' },
  { id: 'w16', name: 'Демонтаж штукатурки', unit: 'м2', price: 300, category: 'Демонтажные работы', type: 'work' },
  { id: 'w17', name: 'Демонтаж перегородки', unit: 'м2', price: 600, category: 'Демонтажные работы', type: 'work' },
  { id: 'w18', name: 'Демонтаж дверного блока', unit: 'шт', price: 800, category: 'Демонтажные работы', type: 'work' },
  { id: 'w19', name: 'Демонтаж подвесного потолка', unit: 'м2', price: 250, category: 'Демонтажные работы', type: 'work' },
  { id: 'w20', name: 'Демонтаж сантехники', unit: 'шт', price: 500, category: 'Демонтажные работы', type: 'work' },
  
  // Черновая электрика (10)
  { id: 'w21', name: 'Штробление стен под кабель', unit: 'п.м', price: 250, category: 'Черновая электрика', type: 'work' },
  { id: 'w22', name: 'Штробление потолка под кабель', unit: 'п.м', price: 300, category: 'Черновая электрика', type: 'work' },
  { id: 'w23', name: 'Прокладка кабеля в штробе', unit: 'п.м', price: 80, category: 'Черновая электрика', type: 'work' },
  { id: 'w24', name: 'Прокладка кабеля в гофре', unit: 'п.м', price: 100, category: 'Черновая электрика', type: 'work' },
  { id: 'w25', name: 'Установка подрозетника', unit: 'шт', price: 200, category: 'Черновая электрика', type: 'work' },
  { id: 'w26', name: 'Монтаж распределительной коробки', unit: 'шт', price: 350, category: 'Черновая электрика', type: 'work' },
  { id: 'w27', name: 'Сборка щита (до 12 модулей)', unit: 'шт', price: 3500, category: 'Черновая электрика', type: 'work' },
  { id: 'w28', name: 'Сборка щита (до 24 модулей)', unit: 'шт', price: 5500, category: 'Черновая электрика', type: 'work' },
  { id: 'w29', name: 'Прокладка слаботочки', unit: 'п.м', price: 70, category: 'Черновая электрика', type: 'work' },
  { id: 'w30', name: 'Заземление', unit: 'точка', price: 1500, category: 'Черновая электрика', type: 'work' },
  
  // Черновая сантехника (10)
  { id: 'w31', name: 'Штробление под трубы', unit: 'п.м', price: 400, category: 'Черновая сантехника', type: 'work' },
  { id: 'w32', name: 'Монтаж водопровода (полипропилен)', unit: 'точка', price: 1500, category: 'Черновая сантехника', type: 'work' },
  { id: 'w33', name: 'Монтаж канализации', unit: 'точка', price: 1200, category: 'Черновая сантехника', type: 'work' },
  { id: 'w34', name: 'Установка коллектора', unit: 'шт', price: 2500, category: 'Черновая сантехника', type: 'work' },
  { id: 'w35', name: 'Монтаж гидроизоляции пола', unit: 'м2', price: 450, category: 'Черновая сантехника', type: 'work' },
  { id: 'w36', name: 'Монтаж трапа', unit: 'шт', price: 2000, category: 'Черновая сантехника', type: 'work' },
  { id: 'w37', name: 'Установка счётчиков воды', unit: 'шт', price: 1000, category: 'Черновая сантехника', type: 'work' },
  { id: 'w38', name: 'Опрессовка системы', unit: 'шт', price: 2000, category: 'Черновая сантехника', type: 'work' },
  { id: 'w39', name: 'Монтаж полотенцесушителя', unit: 'шт', price: 2500, category: 'Черновая сантехника', type: 'work' },
  { id: 'w40', name: 'Подключение бойлера', unit: 'шт', price: 3000, category: 'Черновая сантехника', type: 'work' },
  
  // Черновые отделочные работы - Стены
  { id: 'w41', name: 'Штукатурка по маякам', unit: 'м2', price: 550, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w43', name: 'Шпаклёвка стен (под обои)', unit: 'м2', price: 350, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w44', name: 'Шпаклёвка стен (под покраску)', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w49', name: 'Монтаж ГКЛ на стены', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w41a', name: 'Грунтовка стен', unit: 'м2', price: 80, category: 'Черновые отделочные работы', subcategory: 'Стены', type: 'work' },
  
  // Черновые отделочные работы - Пол
  { id: 'w46', name: 'Стяжка пола (до 5 см)', unit: 'м2', price: 500, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w47', name: 'Стяжка пола (от 5 см)', unit: 'м2', price: 650, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w48', name: 'Наливной пол', unit: 'м2', price: 350, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w46a', name: 'Гидроизоляция пола', unit: 'м2', price: 450, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w46b', name: 'Грунтовка пола', unit: 'м2', price: 60, category: 'Черновые отделочные работы', subcategory: 'Пол', type: 'work' },
  
  // Черновые отделочные работы - Потолок
  { id: 'w42', name: 'Штукатурка потолка', unit: 'м2', price: 650, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' },
  { id: 'w45', name: 'Шпаклёвка потолка', unit: 'м2', price: 500, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' },
  { id: 'w50', name: 'Монтаж ГКЛ на потолок', unit: 'м2', price: 550, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' },
  { id: 'w42a', name: 'Грунтовка потолка', unit: 'м2', price: 80, category: 'Черновые отделочные работы', subcategory: 'Потолок', type: 'work' },
  
  // Чистовые отделочные работы - Стены
  { id: 'w54', name: 'Укладка плитки на стены', unit: 'м2', price: 1400, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w55', name: 'Поклейка обоев', unit: 'м2', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w56', name: 'Покраска стен (2 слоя)', unit: 'м2', price: 300, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w54a', name: 'Декоративная штукатурка', unit: 'м2', price: 800, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' },
  { id: 'w54b', name: 'Монтаж стеновых панелей', unit: 'м2', price: 600, category: 'Чистовые отделочные работы', subcategory: 'Стены', type: 'work' },
  
  // Чистовые отделочные работы - Пол
  { id: 'w51', name: 'Укладка ламината', unit: 'м2', price: 450, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w52', name: 'Укладка паркетной доски', unit: 'м2', price: 600, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w53', name: 'Укладка плитки на пол', unit: 'м2', price: 1200, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w59', name: 'Установка плинтуса', unit: 'п.м', price: 200, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' },
  { id: 'w60', name: 'Установка порожка', unit: 'шт', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Пол', type: 'work' },
  
  // Чистовые отделочные работы - Потолок
  { id: 'w57', name: 'Покраска потолка (2 слоя)', unit: 'м2', price: 350, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' },
  { id: 'w58', name: 'Монтаж натяжного потолка', unit: 'м2', price: 800, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' },
  { id: 'w58a', name: 'Монтаж потолочного плинтуса', unit: 'п.м', price: 150, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' },
  { id: 'w58b', name: 'Монтаж реечного потолка', unit: 'м2', price: 700, category: 'Чистовые отделочные работы', subcategory: 'Потолок', type: 'work' },
  
  // Чистовая сантехника (10)
  { id: 'w61', name: 'Установка унитаза', unit: 'шт', price: 2500, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w62', name: 'Установка раковины', unit: 'шт', price: 2000, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w63', name: 'Установка ванны', unit: 'шт', price: 4000, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w64', name: 'Установка душевой кабины', unit: 'шт', price: 5000, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w65', name: 'Установка смесителя', unit: 'шт', price: 1200, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w66', name: 'Установка биде', unit: 'шт', price: 2500, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w67', name: 'Подключение стиральной машины', unit: 'шт', price: 1500, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w68', name: 'Подключение посудомоечной машины', unit: 'шт', price: 1500, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w69', name: 'Установка инсталляции', unit: 'шт', price: 4500, category: 'Чистовая сантехника', type: 'work' },
  { id: 'w70', name: 'Герметизация сантехники', unit: 'шт', price: 500, category: 'Чистовая сантехника', type: 'work' },
  
  // Чистовая электрика (10)
  { id: 'w71', name: 'Установка розетки', unit: 'шт', price: 350, category: 'Чистовая электрика', type: 'work' },
  { id: 'w72', name: 'Установка выключателя', unit: 'шт', price: 350, category: 'Чистовая электрика', type: 'work' },
  { id: 'w73', name: 'Установка светильника накладного', unit: 'шт', price: 500, category: 'Чистовая электрика', type: 'work' },
  { id: 'w74', name: 'Установка светильника встраиваемого', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work' },
  { id: 'w75', name: 'Установка люстры', unit: 'шт', price: 1500, category: 'Чистовая электрика', type: 'work' },
  { id: 'w76', name: 'Монтаж светодиодной ленты', unit: 'п.м', price: 300, category: 'Чистовая электрика', type: 'work' },
  { id: 'w77', name: 'Установка терморегулятора', unit: 'шт', price: 800, category: 'Чистовая электрика', type: 'work' },
  { id: 'w78', name: 'Установка датчика движения', unit: 'шт', price: 600, category: 'Чистовая электрика', type: 'work' },
  { id: 'w79', name: 'Установка TV-розетки', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work' },
  { id: 'w80', name: 'Установка интернет-розетки', unit: 'шт', price: 400, category: 'Чистовая электрика', type: 'work' },
  
  // === ЧЕРНОВЫЕ МАТЕРИАЛЫ (20) ===
  { id: 'r1', name: 'Грунтовка Ceresit CT 17', unit: 'л', price: 350, category: 'Черновые материалы', type: 'rough' },
  { id: 'r2', name: 'Бетон-контакт Knauf', unit: 'кг', price: 200, category: 'Черновые материалы', type: 'rough' },
  { id: 'r3', name: 'Штукатурка Knauf MP-75', unit: 'меш', price: 450, category: 'Черновые материалы', type: 'rough' },
  { id: 'r4', name: 'Штукатурка Knauf Rotband', unit: 'меш', price: 550, category: 'Черновые материалы', type: 'rough' },
  { id: 'r5', name: 'Шпаклёвка Vetonit LR+', unit: 'меш', price: 850, category: 'Черновые материалы', type: 'rough' },
  { id: 'r6', name: 'Шпаклёвка Knauf Fugen', unit: 'меш', price: 450, category: 'Черновые материалы', type: 'rough' },
  { id: 'r7', name: 'Пескобетон М300', unit: 'меш', price: 200, category: 'Черновые материалы', type: 'rough' },
  { id: 'r8', name: 'Наливной пол Vetonit 3000', unit: 'меш', price: 650, category: 'Черновые материалы', type: 'rough' },
  { id: 'r9', name: 'ГКЛ Knauf 12.5мм', unit: 'лист', price: 450, category: 'Черновые материалы', type: 'rough' },
  { id: 'r10', name: 'ГКЛВ Knauf 12.5мм', unit: 'лист', price: 550, category: 'Черновые материалы', type: 'rough' },
  { id: 'r11', name: 'Профиль ПН 27х28', unit: 'шт', price: 120, category: 'Черновые материалы', type: 'rough' },
  { id: 'r12', name: 'Профиль ПП 60х27', unit: 'шт', price: 180, category: 'Черновые материалы', type: 'rough' },
  { id: 'r13', name: 'Подвес прямой', unit: 'шт', price: 15, category: 'Черновые материалы', type: 'rough' },
  { id: 'r14', name: 'Кабель ВВГнг 3х2.5', unit: 'м', price: 80, category: 'Черновые материалы', type: 'rough' },
  { id: 'r15', name: 'Кабель ВВГнг 3х1.5', unit: 'м', price: 55, category: 'Черновые материалы', type: 'rough' },
  { id: 'r16', name: 'Гофра ПВХ 20мм', unit: 'м', price: 25, category: 'Черновые материалы', type: 'rough' },
  { id: 'r17', name: 'Труба PPR 20мм', unit: 'м', price: 80, category: 'Черновые материалы', type: 'rough' },
  { id: 'r18', name: 'Труба канализационная 50мм', unit: 'м', price: 150, category: 'Черновые материалы', type: 'rough' },
  { id: 'r19', name: 'Гидроизоляция Ceresit CL 51', unit: 'кг', price: 450, category: 'Черновые материалы', type: 'rough' },
  { id: 'r20', name: 'Сетка армирующая', unit: 'м2', price: 120, category: 'Черновые материалы', type: 'rough' },
  
  // === ЧИСТОВЫЕ МАТЕРИАЛЫ (20) ===
  { id: 'f1', name: 'Ламинат Tarkett 32 класс', unit: 'м2', price: 1200, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f2', name: 'Ламинат Quick-Step 33 класс', unit: 'м2', price: 1800, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f3', name: 'Паркетная доска дуб', unit: 'м2', price: 3500, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f4', name: 'Керамогранит 60х60', unit: 'м2', price: 1500, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f5', name: 'Плитка настенная', unit: 'м2', price: 1200, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f6', name: 'Мозаика стеклянная', unit: 'м2', price: 3000, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f7', name: 'Обои флизелиновые', unit: 'рул', price: 2500, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f8', name: 'Обои виниловые', unit: 'рул', price: 1500, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f9', name: 'Краска Dulux', unit: 'л', price: 800, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f10', name: 'Краска Tikkurila', unit: 'л', price: 1200, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f11', name: 'Плинтус МДФ 80мм', unit: 'шт', price: 350, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f12', name: 'Плинтус ПВХ 70мм', unit: 'шт', price: 200, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f13', name: 'Розетка Legrand Valena', unit: 'шт', price: 450, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f14', name: 'Розетка Schneider Unica', unit: 'шт', price: 380, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f15', name: 'Выключатель Legrand Valena', unit: 'шт', price: 500, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f16', name: 'Светильник точечный LED', unit: 'шт', price: 650, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f17', name: 'Светодиодная лента 14.4Вт/м', unit: 'м', price: 250, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f18', name: 'Натяжной потолок матовый', unit: 'м2', price: 450, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f19', name: 'Натяжной потолок глянцевый', unit: 'м2', price: 550, category: 'Чистовые материалы', type: 'finish' },
  { id: 'f20', name: 'Дверь межкомнатная', unit: 'шт', price: 8500, category: 'Чистовые материалы', type: 'finish' },
];

const getAnglesPlural = (countStr: string | undefined) => {
  const count = parseInt(countStr || '0', 10);
  if (isNaN(count)) return 'уг.';
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'уг.';
  if (lastDigit === 1) return 'уг.';
  if (lastDigit >= 2 && lastDigit <= 4) return 'уг.';
  return 'уг.';
};

const calculateWallAreaSuggested = (perimeter: string, ceiling: string, doors: string, windows: string) => {
  const p = parseFloat(perimeter) || 0;
  const h = parseFloat(ceiling) || 0;
  const d = parseInt(doors) || 0;
  const w = parseInt(windows) || 0;
  const area = (p * h) - (d * 1.9) - (w * 2.7);
  return Math.max(0, area).toFixed(1);
};

const GenerationLoader = ({ planUrl, label }: { planUrl: string | null, label: string }) => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-architect-50/90 dark:bg-architect-900/90 backdrop-blur-sm overflow-hidden rounded-xl">
     {planUrl && (
         <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none">
             <img src={planUrl} alt="Plan" className="w-full h-full object-cover filter grayscale blur-[2px] scale-105" />
         </div>
     )}
     <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-64 bg-gradient-to-b from-purple-500/0 via-purple-500/10 to-purple-500/0 animate-scan-beam absolute top-0" />
        <div className="w-full h-[2px] bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.8)] animate-scan-line absolute top-0" />
     </div>
     <div className="relative z-30 bg-white dark:bg-architect-800 p-6 rounded-2xl shadow-2xl border border-architect-100 dark:border-architect-700 flex flex-col items-center max-w-sm text-center mx-4">
         <div className="relative mb-4">
             <div className="absolute inset-0 bg-purple-100 dark:bg-purple-900 rounded-full animate-ping opacity-75"></div>
             <div className="relative bg-purple-50 dark:bg-purple-900/50 p-3 rounded-full border border-purple-100 dark:border-purple-800">
                <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
             </div>
         </div>
         <h3 className="font-bold text-architect-900 dark:text-white text-lg mb-1">ИИ обрабатывает данные</h3>
         <p className="text-sm text-architect-500 dark:text-architect-400">{label}</p>
     </div>
  </div>
);

const App: React.FC = () => {
  const { user, login, registerAdmin, logout, isLoading, hasPermission } = useAuth();
  const [state, setState] = useState<AppState>(AppState.LOGIN);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isGeneratingGlobal, setIsGeneratingGlobal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isGeneratingRoom, setIsGeneratingRoom] = useState(false);
  const [imageSize] = useState<ImageSize>('1K');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Восстанавливаем activeTab из localStorage при монтировании
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'sales' | 'objects' | 'projects' | 'executors' | 'warehouse' | 'prices' | 'settings'>(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && ['dashboard', 'tasks', 'sales', 'objects', 'projects', 'executors', 'warehouse', 'prices', 'settings'].includes(savedTab)) {
      return savedTab as 'dashboard' | 'tasks' | 'sales' | 'objects' | 'projects' | 'executors' | 'warehouse' | 'prices' | 'settings';
    }
  });
  // Warehouse states
  const [selectedPurchaseRequest, setSelectedPurchaseRequest] = useState<PurchaseRequest | null>(null);
  const [showPurchaseRequestForm, setShowPurchaseRequestForm] = useState(false);
  const [selectedProjectForMaterials, setSelectedProjectForMaterials] = useState<Project | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [showToolForm, setShowToolForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [warehouseRefreshTrigger, setWarehouseRefreshTrigger] = useState(0);
  // Warehouse sub-tabs
  const [warehouseSubTab, setWarehouseSubTab] = useState<'purchase-requests' | 'project-materials' | 'tools' | 'returns' | 'operations'>(() => {
    const saved = localStorage.getItem('warehouseSubTab');
    if (saved && ['purchase-requests', 'project-materials', 'tools', 'returns', 'operations'].includes(saved)) {
      return saved as 'purchase-requests' | 'project-materials' | 'tools' | 'returns' | 'operations';
    }
    return 'purchase-requests';
  });
  const [showStyleTooltip, setShowStyleTooltip] = useState(false);
  const [isDetectingStyle, setIsDetectingStyle] = useState(false);
  const [expandedEstimateSections, setExpandedEstimateSections] = useState<Record<string, boolean>>({});
  const [expandedGlobalEstimateSections, setExpandedGlobalEstimateSections] = useState<Record<string, boolean>>({});
  const [expandedEstimationSections, setExpandedEstimationSections] = useState<Record<string, boolean>>({});
  
  // Модальное окно для ввода ссылки на товар
  const [urlModalData, setUrlModalData] = useState<{
    isOpen: boolean;
    currentUrl: string;
    onSave: (url: string) => void;
  }>({ isOpen: false, currentUrl: '', onSave: () => {} });
  const [isGlobalEstimateExpanded, setIsGlobalEstimateExpanded] = useState(false);
  const [isWorksExpanded, setIsWorksExpanded] = useState(true);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  
  // Прайсы (справочник работ и материалов)
  const [priceList, setPriceList] = useState<PriceItem[]>(DEFAULT_PRICES);
  const [expandedPriceSections, setExpandedPriceSections] = useState<Record<string, boolean>>({});
  const [activePriceTab, setActivePriceTab] = useState<'works' | 'rough' | 'finish'>('works');
  const priceUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const estimationUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Поиск в прайсах
  const [priceSearchQuery, setPriceSearchQuery] = useState('');
  const [priceSearchFocused, setPriceSearchFocused] = useState(false);
  const [highlightedPriceId, setHighlightedPriceId] = useState<string | null>(null);
  
  // Импорт из Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCategory, setImportCategory] = useState<string>('');
  const [importSubcategory, setImportSubcategory] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Поставщики
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [updatingPriceId, setUpdatingPriceId] = useState<string | null>(null);
  
  // Модальное окно ссылки для общей сметы
  const [showGlobalMaterialLinkModal, setShowGlobalMaterialLinkModal] = useState(false);
  const [globalMaterialLinkItem, setGlobalMaterialLinkItem] = useState<{ name: string; unit: string; type: string; supplierUrl?: string } | null>(null);
  const [globalMaterialLinkUrl, setGlobalMaterialLinkUrl] = useState('');
  const [updatingGlobalMaterialId, setUpdatingGlobalMaterialId] = useState<string | null>(null);
  
  // Поиск в глобальных секциях
  const [globalSectionActiveSearchId, setGlobalSectionActiveSearchId] = useState<string | null>(null);

  // Модальное окно экспорта сметы
  const [showExportModal, setShowExportModal] = useState(false);

  // Параметры для автозаполнения сметы
  const [propertyCondition, setPropertyCondition] = useState<PropertyCondition>('secondary');
  const [renovationType, setRenovationType] = useState<RenovationType>('capital');
  const [isGeneratingEstimate, setIsGeneratingEstimate] = useState(false);
  const [showEstimateConfirm, setShowEstimateConfirm] = useState(false);

  // Голосовой ввод для сметы
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = React.useRef<any>(null);
  const finalTranscriptRef = React.useRef<string>('');
  const isStoppingRef = React.useRef<boolean>(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    organizationName: '',
  });
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Superadmin state
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  // Check if superadmin is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('superadmin_token');
    if (token) {
      setIsSuperadmin(true);
    }
  }, []);

  const handleSuperadminLogout = () => {
    localStorage.removeItem('superadmin_token');
    setIsSuperadmin(false);
    setEmail('');
    setPassword('');
  };

  // Load projects and prices from backend when user is authenticated
  useEffect(() => {
    if (user && !isLoading) {
      loadProjects();
      loadPriceItems();
    } else if (!user && !isLoading) {
      // Проверяем, есть ли токен в localStorage - если есть, значит пользователь авторизован, просто еще загружается
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken) {
        setState(AppState.LOGIN);
        setProjects([]); // Clear projects on logout
        setPriceList([]); // Clear prices on logout
      }
      // Если токен есть, но user еще не загружен, не меняем state - ждем загрузки
    }
    
    // Handle navigation from Sales to Projects
    const handleNavigateToProjects = () => {
      setActiveTab('projects');
      // Check if we need to create project from deal
      const dealId = sessionStorage.getItem('createProjectFromDeal');
      if (dealId) {
        const dealDataStr = sessionStorage.getItem('projectFromDealData');
        if (dealDataStr) {
          try {
            const dealData = JSON.parse(dealDataStr);
            // Set project name from deal data
            setProjectName(dealData.name || '');
            // Store dealId for later use when project is created
            sessionStorage.setItem('pendingDealId', dealId);
          } catch (e) {
            console.error('Failed to parse deal data:', e);
          }
        }
      }
    };
    
    window.addEventListener('navigateToProjects', handleNavigateToProjects);
    return () => window.removeEventListener('navigateToProjects', handleNavigateToProjects);
  }, [user, isLoading]);

  const loadProjects = async () => {
    try {
      const backendProjects = await api.getProjects();
      // Transform backend projects to frontend format
      const transformedProjects: Project[] = backendProjects.map((p: any) => ({
        id: p.id,
        name: p.name,
        createdAt: new Date(p.createdAt).getTime(),
        thumbnail: p.thumbnail,
        planPreview: p.planPreview,
        analysis: p.analysisData ? (typeof p.analysisData === 'string' ? JSON.parse(p.analysisData) : p.analysisData) : undefined,
        global3DImages: p.global3dImages || [],
        roomImages: p.roomImages ? (typeof p.roomImages === 'string' ? JSON.parse(p.roomImages) : p.roomImages) : {},
      }));
      setProjects(transformedProjects);
      console.log(`Loaded ${transformedProjects.length} projects from backend`);
      
      // Update state after projects are loaded
      if (transformedProjects.length > 0) {
        setState(AppState.PROJECT_LIST);
      } else {
        setState(AppState.UPLOAD);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      setState(AppState.UPLOAD); // Show upload screen on error
    }
  };

  useEffect(() => {
    if (currentProject) {
      setProjects(prev => prev.map(p => p.id === currentProject.id ? currentProject : p));
      // Save to backend with debounce to avoid too many requests
      const timeoutId = setTimeout(() => {
        saveProject(currentProject);
      }, 1000); // Save 1 second after last change
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentProject]);

  const saveProject = async (project: Project) => {
    try {
      // Don't save planFile (File object can't be serialized)
      // Only save data that can be stored in database
      await api.updateProject(project.id, {
        name: project.name,
        thumbnail: project.thumbnail,
        planPreview: project.planPreview,
        analysisData: project.analysis, // This includes all rooms with estimations
        global3dImages: project.global3DImages || [],
        roomImages: project.roomImages,
      });
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Сохраняем activeTab в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Закрытие выпадающего списка при клике вне его области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeSearchId) {
        const target = event.target as HTMLElement;
        // Проверяем, что клик не по input'у и не по dropdown'у
        const isClickOnInput = target.closest('input[data-search-input]');
        const isClickOnDropdown = target.closest('[data-search-dropdown]');
        
        if (!isClickOnInput && !isClickOnDropdown) {
          setActiveSearchId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeSearchId]);

  // Сброс поиска при переключении вкладок прайса
  useEffect(() => {
    setPriceSearchQuery('');
    setPriceSearchFocused(false);
    setHighlightedPriceId(null);
  }, [activePriceTab]);

  useEffect(() => {
    let interval: any;
    if (state === AppState.ANALYZING) {
      setAnalysisProgress(0);
      interval = setInterval(() => {
        setAnalysisProgress((prev) => {
          const remaining = 95 - prev;
          if (remaining <= 0) return prev;
          return Math.min(95, prev + Math.max(0.2, remaining / 15));
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [state]);

  const totals = useMemo(() => {
    if (!currentProject?.analysis?.rooms) return { area: 0, perimeter: 0, angles: 0, doors: 0, windows: 0, wallArea: 0, count: 0 };
    const h = parseFloat(currentProject.analysis.ceilingHeight || '2.7') || 0;
    return currentProject.analysis.rooms.reduce((acc, room) => {
        const areaVal = parseFloat(String(room.area || '0')) || 0;
        const perimVal = parseFloat(String(room.perimeter || '0')) || 0;
        const doorsVal = parseInt(String(room.doors || '0')) || 0;
        const windowsVal = parseInt(String(room.windows || '0')) || 0;
        
        acc.area += areaVal;
        acc.perimeter += perimVal;
        acc.angles += parseInt(String(room.angles || '0')) || 0;
        acc.doors += doorsVal;
        acc.windows += windowsVal;
        
        const wArea = room.wallArea ? parseFloat(room.wallArea) : ((perimVal * h) - (doorsVal * 1.9) - (windowsVal * 2.7));
        acc.wallArea += Math.max(0, wArea);
        
        acc.count += 1;
        return acc;
    }, { area: 0, perimeter: 0, angles: 0, doors: 0, windows: 0, wallArea: 0, count: 0 });
  }, [currentProject?.analysis?.rooms, currentProject?.analysis?.ceilingHeight]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    
    // Check if it's superadmin login (username is not an email)
    const isEmail = email.includes('@');
    
    if (!isEmail) {
      // Try superadmin login
      try {
        const result = await api.superadminLogin(email, password);
        console.log('Superadmin login successful:', result);
        setIsSuperadmin(true);
        setEmail('');
        setPassword('');
        return;
      } catch (error: any) {
        console.error('Superadmin login error:', error);
        setLoginError(error.message || 'Ошибка входа суперадмина');
        return;
      }
    }
    
    // Regular user login
    try {
      await login({ email, password });
      // При первом входе устанавливаем активный раздел на "Дашборд"
      const savedTab = localStorage.getItem('activeTab');
      if (!savedTab) {
        setActiveTab('dashboard');
      }
      await loadProjects(); // loadProjects will set state internally
    } catch (error: any) {
      console.error('User login error:', error);
      setLoginError(error.message || 'Ошибка входа');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setIsRegistering(true);
    try {
      await registerAdmin(registerData);
      // При первой регистрации устанавливаем активный раздел на "Дашборд"
      const savedTab = localStorage.getItem('activeTab');
      if (!savedTab) {
        setActiveTab('dashboard');
      }
      await loadProjects(); // loadProjects will set state internally
      setShowRegister(false);
    } catch (error: any) {
      setRegisterError(error.message || 'Ошибка регистрации');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      // Create project in backend
      const projectName = file.name.split('.')[0] || 'Новый проект';
      const backendProject = await api.createProject({ name: projectName });
      
      // If project was created from deal, link them
      const dealId = sessionStorage.getItem('pendingDealId');
      if (dealId) {
        try {
          await api.updateDeal(dealId, { projectId: backendProject.id });
          await api.addDealComment(dealId, `Создана смета/проект #${backendProject.id}`);
          sessionStorage.removeItem('pendingDealId');
          sessionStorage.removeItem('createProjectFromDeal');
          sessionStorage.removeItem('projectFromDealData');
        } catch (error) {
          console.error('Failed to link deal with project:', error);
        }
      }
      
      // Upload plan image to server
      const uploadResult = await api.uploadProjectImage(backendProject.id, file, 'planPreview');
      const planPreview = uploadResult.url;
      
      const newProject: Project = {
        id: backendProject.id,
        name: backendProject.name,
        createdAt: new Date(backendProject.createdAt).getTime(),
        planFile: file,
        planPreview: planPreview,
        roomImages: {},
      };
      
      setCurrentProject(newProject);
      setProjects(prev => [newProject, ...prev]);
      setState(AppState.ANALYZING);
      await performAnalysis(newProject);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Ошибка при создании проекта. Проверьте права доступа.');
    }
  };

  const performAnalysis = async (project: Project) => {
    setIsAnalyzing(true);
    try {
      let part;
      
      // Используем planFile если есть, иначе загружаем по URL
      if (project.planFile) {
        part = await fileToGenerativePart(project.planFile);
      } else if (project.planPreview) {
        const blob = await loadImageFromUrl(project.planPreview);
        part = await fileToGenerativePart(blob);
      } else {
        throw new Error('План помещения не найден');
      }
      
      const result = await analyzeFloorPlan(part);
      if (result && result.rooms) {
        const h = parseFloat(result.ceilingHeight || '2.7') || 0;
        result.rooms = result.rooms.map((room, idx) => {
            const p = parseFloat(room.perimeter || '0') || 0;
            const d = parseInt(room.doors || '1') || 0;
            const w = parseInt(room.windows || '1') || 0;
            const initialWallArea = ((p * h) - (d * 1.9) - (w * 2.7)).toFixed(1);

            return {
                ...room,
                id: room.id || `room-${Date.now()}-${idx}`,
                furniture: room.furniture || [],
                realPhotos: room.realPhotos || [],
                area: String(room.area || '').replace(/[^0-9.]/g, ''),
                perimeter: String(room.perimeter || '').replace(/[^0-9.]/g, ''),
                angles: String(room.angles || '').replace(/[^0-9]/g, '') || '4',
                doors: String(room.doors || '1').replace(/[^0-9]/g, ''),
                windows: String(room.windows || '1').replace(/[^0-9]/g, ''),
                wallArea: initialWallArea,
                estimation: {
                  works: {},
                  roughMaterials: { items: [] },
                  finishMaterials: { items: [] }
                }
            };
        });
      }
      const updatedProject = { ...project, analysis: result, name: result.propertyDescription || project.name };
      setCurrentProject(updatedProject);
      setAnalysisProgress(100);
      
      // Save analysis results to backend
      try {
        await api.updateProject(updatedProject.id, {
          name: updatedProject.name,
          analysisData: updatedProject.analysis,
        });
      } catch (error) {
        console.error('Failed to save analysis:', error);
      }
      
      setTimeout(() => setState(AppState.VIEW_PROJECT), 600);
    } catch (error: any) {
      console.error("Analysis error:", error);
      const errorMessage = error?.message || "Неизвестная ошибка";
      alert(`Ошибка анализа: ${errorMessage}. Попробуйте снова.`);
      setState(AppState.UPLOAD);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectProject = (p: Project) => {
    setCurrentProject(p);
    setSelectedRoom(null);
    setState(AppState.VIEW_PROJECT);
  };

  const updateCurrentProject = (updates: Partial<Project>) => {
    setCurrentProject(prev => prev ? { ...prev, ...updates } : null);
  };

  const updateAnalysis = (updates: Partial<AnalysisResult>) => {
    setCurrentProject(prev => {
      if (!prev || !prev.analysis) return prev;
      let newAnalysis = { ...prev.analysis, ...updates };
      
      if (updates.ceilingHeight !== undefined) {
        const h = updates.ceilingHeight;
        newAnalysis.rooms = newAnalysis.rooms.map(room => ({
          ...room,
          wallArea: calculateWallAreaSuggested(room.perimeter || '0', h, room.doors || '0', room.windows || '0')
        }));
      }
      
      return { ...prev, analysis: newAnalysis };
    });
  };

  const handleUpdateStyle = (newStyle: string) => updateAnalysis({ architecturalStyle: newStyle });

  const handleStyleImageUpload = async (file: File) => {
    setIsDetectingStyle(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        updateAnalysis({ styleReferenceImage: reader.result as string });
        try {
          const imagePart = await fileToGenerativePart(file);
          const detectedStyle = await identifyStyleFromImage(imagePart);
          if (detectedStyle) handleUpdateStyle(detectedStyle);
        } finally {
          setIsDetectingStyle(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setIsDetectingStyle(false);
    }
  };

  const handleUpdateRoom = (updatedRoom: Room) => {
    if (selectedRoom?.id === updatedRoom.id) {
        setSelectedRoom(updatedRoom);
    }
    setCurrentProject(prev => {
      if (!prev || !prev.analysis) return prev;
      const updatedRooms = prev.analysis.rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);
      return { ...prev, analysis: { ...prev.analysis, rooms: updatedRooms } };
    });
  };

  const updateRoomParam = (room: Room, field: keyof Room, value: string) => {
    const updatedRoom = { ...room, [field]: value };
    if (field === 'perimeter' || field === 'doors' || field === 'windows') {
      updatedRoom.wallArea = calculateWallAreaSuggested(
        field === 'perimeter' ? value : (room.perimeter || '0'),
        currentProject?.analysis?.ceilingHeight || '2.7',
        field === 'doors' ? value : (room.doors || '0'),
        field === 'windows' ? value : (room.windows || '0')
      );
    }
    handleUpdateRoom(updatedRoom);
  };

  const handleAddRoom = () => {
    const ceiling = parseFloat(currentProject?.analysis?.ceilingHeight || '2.7') || 0;
    const initialWallArea = ((0 * ceiling) - (1 * 1.9) - (1 * 2.7)).toFixed(1);
    const newRoom: Room = {
      id: `room-manual-${Date.now()}`,
      name: 'Новая комната',
      description: 'Назначение помещения...',
      furniture: [],
      realPhotos: [],
      area: '', perimeter: '', angles: '4', doors: '1', windows: '1', wallArea: initialWallArea,
      estimation: {
        works: {},
        roughMaterials: { items: [] },
        finishMaterials: { items: [] }
      }
    };
    updateAnalysis({ rooms: [...(currentProject?.analysis?.rooms || []), newRoom] });
    setSelectedRoom(newRoom);
  };

  const handleDeleteRoom = (roomId: string) => {
    if (selectedRoom?.id === roomId) setSelectedRoom(null);
    updateAnalysis({ rooms: (currentProject?.analysis?.rooms || []).filter(r => r.id !== roomId) });
  };

  const handleUploadPropertyPhoto = async (file: File) => {
    if (!currentProject) return;
    const photos = currentProject?.analysis?.propertyPhotos || [];
    if (photos.length >= 6) return alert("Максимум 6 фото.");
    
    try {
      const uploadResult = await api.uploadProjectImage(currentProject.id, file, 'propertyPhoto');
      updateAnalysis({ propertyPhotos: [...photos, uploadResult.url] });
    } catch (error) {
      console.error('Failed to upload property photo:', error);
      alert('Ошибка при загрузке фотографии');
    }
  };

  const handleRemovePropertyPhoto = async (index: number) => {
    if (!currentProject) return;
    const photos = currentProject?.analysis?.propertyPhotos || [];
    const photoToRemove = photos[index];
    
    // Delete from server if it's a server URL
    if (photoToRemove && photoToRemove.startsWith('/uploads/images/')) {
      try {
        await api.deleteProjectImage(currentProject.id, 'propertyPhoto', undefined, index);
      } catch (error) {
        console.error('Failed to delete property photo from server:', error);
      }
    }
    
    updateAnalysis({ propertyPhotos: photos.filter((_, i) => i !== index) });
  };

  const handleUploadRoomPhoto = (file: File) => {
    if (!selectedRoom) return;
    const photos = selectedRoom.realPhotos || [];
    if (photos.length >= 5) return alert("Максимум 5 фото.");
    const reader = new FileReader();
    reader.onloadend = () => handleUpdateRoom({ ...selectedRoom, realPhotos: [...photos, reader.result as string] });
    reader.readAsDataURL(file);
  };

  const handleRemoveRoomPhoto = (index: number) => {
    if (!selectedRoom?.realPhotos) return;
    handleUpdateRoom({ ...selectedRoom, realPhotos: selectedRoom.realPhotos.filter((_, i) => i !== index) });
  };

  const handleAddFurniture = () => {
    if (!selectedRoom) return;
    const newItem: FurnitureItem = { id: Date.now().toString(), name: '' };
    handleUpdateRoom({ ...selectedRoom, furniture: [...selectedRoom.furniture, newItem] });
  };

  const handleUpdateFurniture = (itemId: string, field: keyof FurnitureItem, value: string) => {
    if (!selectedRoom) return;
    const updated = selectedRoom.furniture.map(f => f.id === itemId ? { ...f, [field]: value } : f);
    handleUpdateRoom({ ...selectedRoom, furniture: updated });
  };

  const handleDeleteFurniture = (itemId: string) => {
    if (!selectedRoom) return;
    handleUpdateRoom({ ...selectedRoom, furniture: selectedRoom.furniture.filter(f => f.id !== itemId) });
  };

  const handleFurnitureImageUpload = (itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => handleUpdateFurniture(itemId, 'image', reader.result as string);
    reader.readAsDataURL(file);
  };

  // Вспомогательная функция для загрузки изображения по URL
  const loadImageFromUrl = async (url: string): Promise<Blob> => {
    const fullUrl = getImageUrl(url) || url;
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить изображение: ${response.statusText}`);
    }
    return response.blob();
  };

  const handleGenerateGlobal = async () => {
    if (!currentProject?.planPreview || !currentProject.analysis) return;
    setIsGeneratingGlobal(true);
    try {
      let part;
      
      // Используем planFile если есть, иначе загружаем по URL
      if (currentProject.planFile) {
        part = await fileToGenerativePart(currentProject.planFile);
      } else if (currentProject.planPreview) {
        const blob = await loadImageFromUrl(currentProject.planPreview);
        part = await fileToGenerativePart(blob);
      } else {
        throw new Error('План помещения не найден');
      }
      
      const base64Url = await generateIsometricView(part, currentProject.analysis.architecturalStyle, imageSize, currentProject.analysis.styleReferenceImage);
      
      // Конвертируем base64 в Blob, затем в File
      const response = await fetch(base64Url);
      const blob = await response.blob();
      const file = new File([blob], `global3d-${Date.now()}.png`, { type: 'image/png' });
      
      // Загружаем как файл (как план помещения)
      try {
        const uploadResult = await api.uploadProjectImage(
          currentProject.id, 
          file, 
          'global3dImage'
        );
        
        // Добавляем новое изображение в начало массива (лимит 10)
        const currentImages = currentProject.global3DImages || [];
        const updatedImages = [uploadResult.url, ...currentImages].slice(0, 10);
        
        updateCurrentProject({ global3DImages: updatedImages });
        
        // Сохраняем массив в БД сразу (без debounce)
        await api.updateProject(currentProject.id, {
          global3dImages: updatedImages,
        });
      } catch (error) {
        console.error('Failed to save global 3D image:', error);
        alert('Ошибка при сохранении изображения на сервер');
      }
    } catch (error: any) {
      console.error("Error generating 3D view:", error);
      const errorMessage = error?.message || "Неизвестная ошибка при генерации 3D макета";
      alert(`Ошибка генерации: ${errorMessage}. Проверьте консоль для деталей.`);
    } finally {
      setIsGeneratingGlobal(false);
    }
  };

  // Удаление глобального 3D изображения
  const handleDeleteGlobal3DImage = async (imageIndex: number) => {
    if (!currentProject) return;
    
    try {
      await api.deleteProjectImage(currentProject.id, 'global3dImage', undefined, imageIndex);
      const currentImages = currentProject.global3DImages || [];
      const updatedImages = currentImages.filter((_, i) => i !== imageIndex);
      updateCurrentProject({ global3DImages: updatedImages });
    } catch (error) {
      console.error('Failed to delete global 3D image:', error);
      alert('Ошибка при удалении изображения');
    }
  };

  const handleGenerateRoom = async () => {
    if (!currentProject?.planPreview || !currentProject.analysis || !selectedRoom) return;
    setIsGeneratingRoom(true);
    try {
      let part;
      
      // Используем planFile если есть, иначе загружаем по URL
      if (currentProject.planFile) {
        part = await fileToGenerativePart(currentProject.planFile);
      } else if (currentProject.planPreview) {
        const blob = await loadImageFromUrl(currentProject.planPreview);
        part = await fileToGenerativePart(blob);
      } else {
        throw new Error('План помещения не найден');
      }
      
      const url = await generateRoomInterior(selectedRoom, currentProject.analysis.architecturalStyle, part, imageSize, currentProject.analysis.styleReferenceImage);
      
      // Convert base64 to File and upload to server
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `room-${selectedRoom.id}-${Date.now()}.png`, { type: 'image/png' });
        
        const uploadResult = await api.uploadProjectImage(
          currentProject.id, 
          file, 
          'roomImage',
          selectedRoom.id
        );
        
        // Добавляем новое изображение в начало массива (лимит 10)
        const currentImages = currentProject.roomImages?.[selectedRoom.id] || [];
        const updatedImages = [uploadResult.url, ...currentImages].slice(0, 10);
        const updatedRoomImages = { ...(currentProject.roomImages || {}), [selectedRoom.id]: updatedImages };
        updateCurrentProject({ roomImages: updatedRoomImages });
        
        // Сохраняем на сервер
        await api.updateProject(currentProject.id, { roomImages: updatedRoomImages });
      } catch (error) {
        console.error('Failed to save room image:', error);
        // Fallback to base64 if upload fails
        const currentImages = currentProject.roomImages?.[selectedRoom.id] || [];
        const updatedImages = [url, ...currentImages].slice(0, 10);
        const updatedRoomImages = { ...(currentProject.roomImages || {}), [selectedRoom.id]: updatedImages };
        updateCurrentProject({ roomImages: updatedRoomImages });
      }
    } catch (error: any) {
      console.error("Error generating room interior:", error);
      const errorMessage = error?.message || "Неизвестная ошибка при генерации интерьера";
      alert(`Ошибка генерации: ${errorMessage}. Проверьте консоль для деталей.`);
    } finally {
      setIsGeneratingRoom(false);
    }
  };

  const handleDeleteRoomImage = async (roomId: string, imageIndex: number) => {
    if (!currentProject) return;
    
    try {
      await api.deleteProjectImage(currentProject.id, 'roomImage', roomId, imageIndex);
      const currentImages = currentProject.roomImages?.[roomId] || [];
      const updatedImages = currentImages.filter((_, i) => i !== imageIndex);
      const updatedRoomImages = { ...currentProject.roomImages };
      if (updatedImages.length === 0) {
        delete updatedRoomImages[roomId];
      } else {
        updatedRoomImages[roomId] = updatedImages;
      }
      updateCurrentProject({ roomImages: updatedRoomImages });
    } catch (error) {
      console.error('Failed to delete room image:', error);
      alert('Ошибка при удалении изображения');
    }
  };

  // Экспорт сметы
  const handleExportEstimate = async (options: ExportOptions) => {
    if (!currentProject) return;

    try {
      if (options.format === 'xlsx') {
        exportEstimateToXLSX(currentProject, options);
      } else {
        // PDF экспорт через backend
        const blob = await api.exportProjectEstimatePDF(currentProject.id, options);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.name}_смета.pdf`.replace(/[<>:"/\\|?*]/g, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export estimate:', error);
      alert('Ошибка при экспорте сметы. Попробуйте еще раз.');
    }
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return;
    if (window.confirm('Вы уверены, что хотите безвозвратно удалить этот проект?')) {
      try {
        await api.deleteProject(currentProject.id);
        const newProjects = projects.filter(p => p.id !== currentProject.id);
        setProjects(newProjects);
        setCurrentProject(null);
        setState(AppState.PROJECT_LIST);
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert('Ошибка при удалении проекта. Попробуйте еще раз.');
      }
    }
  };

  const initEstimationIfMissing = (room: Room): RoomEstimation => {
    return room.estimation || {
      works: {},
      roughMaterials: { items: [] },
      finishMaterials: { items: [] }
    };
  };

  const handleAddEstimationItem = (category: 'works' | 'rough' | 'finish', subCategory?: string) => {
    if (!selectedRoom) return;
    const currentEst = initEstimationIfMissing(selectedRoom);
    const newItem: EstimationItem = {
      id: Date.now().toString(),
      name: '',
      unit: 'м2',
      quantity: 1,
      price: 0,
      total: 0,
      type: category === 'works' ? 'work' : category,
      linkedMaterials: []
    };

    const updatedEst = JSON.parse(JSON.stringify(currentEst));
    if (category === 'works' && subCategory) {
      const section = updatedEst.works[subCategory] || { items: [] };
      updatedEst.works[subCategory] = { items: [...section.items, newItem] };
    } else if (category === 'rough') {
      const currentList = updatedEst.roughMaterials?.items || [];
      updatedEst.roughMaterials = { items: [...currentList, newItem] };
    } else if (category === 'finish') {
      const currentList = updatedEst.finishMaterials?.items || [];
      updatedEst.finishMaterials = { items: [...currentList, newItem] };
    }

    handleUpdateRoom({ ...selectedRoom, estimation: updatedEst });
  };

  // Добавление работы с подкатегорией (для отделочных работ)
  const handleAddEstimationItemWithSubcategory = (category: 'works' | 'rough' | 'finish', subCategory: string, subcategory: string) => {
    if (!selectedRoom) return;
    const currentEst = initEstimationIfMissing(selectedRoom);
    const newItem: EstimationItem = {
      id: Date.now().toString(),
      name: '',
      unit: 'м2',
      quantity: 1,
      price: 0,
      total: 0,
      type: category === 'works' ? 'work' : category,
      linkedMaterials: [],
      subcategory: subcategory
    };

    const updatedEst = JSON.parse(JSON.stringify(currentEst));
    if (category === 'works' && subCategory) {
      const section = updatedEst.works[subCategory] || { items: [] };
      updatedEst.works[subCategory] = { items: [...section.items, newItem] };
    }

    handleUpdateRoom({ ...selectedRoom, estimation: updatedEst });
  };

  const handleAddMaterialToWork = (workId: string, subCategory: string) => {
    if (!selectedRoom) return;
    const currentEst = initEstimationIfMissing(selectedRoom);
    const updatedEst = JSON.parse(JSON.stringify(currentEst));
    const isRoughCategory = ROUGH_WORK_SECTIONS.includes(subCategory);
    const newItem: EstimationItem = {
        id: `mat-${Date.now()}`,
        name: '',
        unit: isRoughCategory ? 'кг' : 'м2',
        quantity: 1,
        price: 0,
        total: 0,
        type: isRoughCategory ? 'rough' : 'finish',
    };

    if (updatedEst.works[subCategory]) {
        updatedEst.works[subCategory].items = updatedEst.works[subCategory].items.map((work: any) => {
            if (work.id === workId) {
                return { ...work, linkedMaterials: [...(work.linkedMaterials || []), newItem] };
            }
            return work;
        });
    }

    handleUpdateRoom({ ...selectedRoom, estimation: updatedEst });
  };

  const handleUpdateEstimationItem = (category: 'works' | 'rough' | 'finish', id: string, field: keyof EstimationItem, value: any, subCategory?: string, materialId?: string) => {
    if (!selectedRoom) return;
    const currentEst = initEstimationIfMissing(selectedRoom);
    const updatedEst = JSON.parse(JSON.stringify(currentEst));

    const calculateItemTotal = (item: EstimationItem, updatedField: keyof EstimationItem, newValue: any) => {
        const updated = { ...item, [updatedField]: newValue };
        if (updatedField === 'quantity' || updatedField === 'price' || updatedField === 'total') {
            const q = Number(updated.quantity) || 0;
            const p = Number(updated.price) || 0;
            if (updatedField === 'total') {
                updated.total = Number(newValue) || 0;
            } else {
                updated.total = q * p;
            }
        }
        return updated;
    };

    const updateInList = (items: EstimationItem[]) => items.map(item => {
      if (item.id === id && !materialId) {
        return calculateItemTotal(item, field, value);
      }
      if (item.id === id && materialId && item.linkedMaterials) {
        return {
          ...item,
          linkedMaterials: item.linkedMaterials.map(mat => 
            mat.id === materialId ? calculateItemTotal(mat, field, value) : mat
          )
        };
      }
      return item;
    });

    // Обновляем данные в смете
    if (category === 'works' && subCategory && updatedEst.works[subCategory]) {
      updatedEst.works[subCategory].items = updateInList(updatedEst.works[subCategory].items);
      if (field === 'name') setActiveSearchId(materialId || id);
    } else if (category === 'rough' && updatedEst.roughMaterials) {
      updatedEst.roughMaterials.items = updateInList(updatedEst.roughMaterials.items);
    } else if (category === 'finish' && updatedEst.finishMaterials) {
      updatedEst.finishMaterials.items = updateInList(updatedEst.finishMaterials.items);
    }

    // Синхронизация с прайс-листом: если изменились name/unit/price — создаём или обновляем позицию
    // НО только если название имеет минимум 3 символа (чтобы не создавать позиции при вводе)
    if (field === 'name' || field === 'unit' || field === 'price') {
      let targetItem: EstimationItem | undefined;

      if (category === 'works' && subCategory && updatedEst.works[subCategory]) {
        const section = updatedEst.works[subCategory];
        const workItem = section.items.find((it: EstimationItem) => it.id === id);
        if (materialId && workItem?.linkedMaterials) {
          targetItem = workItem.linkedMaterials.find((m: EstimationItem) => m.id === materialId);
        } else {
          targetItem = workItem;
        }
      } else if (category === 'rough' && updatedEst.roughMaterials) {
        targetItem = updatedEst.roughMaterials.items.find((it: EstimationItem) => it.id === id);
      } else if (category === 'finish' && updatedEst.finishMaterials) {
        targetItem = updatedEst.finishMaterials.items.find((it: EstimationItem) => it.id === id);
      }

      // Проверяем, что название имеет минимум 3 символа (чтобы не создавать позиции при вводе)
      if (targetItem && targetItem.name && targetItem.name.trim().length >= 3) {
        const typeForPrice: 'work' | 'rough' | 'finish' =
          (targetItem.type as 'work' | 'rough' | 'finish') ||
          (category === 'works' ? 'work' : category);

        // Категория для прайса
        let priceCategory: string | undefined;
        let subcategory: string | undefined;

        if (typeForPrice === 'work') {
          priceCategory = subCategory || 'Общие';
          // Для отделочных работ определяем подкатегорию по названию
          if (subCategory === 'Черновые отделочные работы' || subCategory === 'Чистовые отделочные работы') {
            const nameLower = targetItem.name.toLowerCase();
            if (nameLower.includes('стен') || nameLower.includes('стена') || nameLower.includes('стены') || nameLower.includes('стене')) {
              subcategory = 'Стены';
            } else if (nameLower.includes('пол') || nameLower.includes('пола') || nameLower.includes('полу')) {
              subcategory = 'Пол';
            } else if (nameLower.includes('потолок') || nameLower.includes('потолка') || nameLower.includes('потолку')) {
              subcategory = 'Потолок';
            } else {
              // Если подкатегорию не удалось определить - ставим "Стены" по умолчанию
              subcategory = 'Стены';
            }
          }
        } else {
          priceCategory = typeForPrice === 'rough' ? 'Черновые материалы' : 'Чистовые материалы';
        }

        // Используем debounce для создания позиции в справочнике
        const itemKey = `${category}-${id}-${materialId || ''}`;
        if (estimationUpdateTimeouts.current[itemKey]) {
          clearTimeout(estimationUpdateTimeouts.current[itemKey]);
        }
        
        estimationUpdateTimeouts.current[itemKey] = setTimeout(() => {
          autoAddToPriceList(
            targetItem!.name,
            (targetItem!.unit as string) || '',
            Number(targetItem!.price) || 0,
            typeForPrice,
            priceCategory,
            subcategory
          );
          delete estimationUpdateTimeouts.current[itemKey];
        }, 1500); // Ждем 1.5 секунды после последнего изменения
      }
    }

    handleUpdateRoom({ ...selectedRoom, estimation: updatedEst });
  };

  const handleDeleteEstimationItem = (category: 'works' | 'rough' | 'finish', id: string, subCategory?: string, materialId?: string) => {
    if (!selectedRoom) return;
    const currentEst = initEstimationIfMissing(selectedRoom);
    const updatedEst = JSON.parse(JSON.stringify(currentEst));

    if (category === 'works' && subCategory && updatedEst.works[subCategory]) {
        if (materialId) {
            updatedEst.works[subCategory].items = updatedEst.works[subCategory].items.map((work: any) => {
                if (work.id === id) {
                    return { ...work, linkedMaterials: (work.linkedMaterials || []).filter((m: any) => m.id !== materialId) };
                }
                return work;
            });
        } else {
            updatedEst.works[subCategory].items = updatedEst.works[subCategory].items.filter((i: any) => i.id !== id);
        }
    } else if (category === 'rough' && updatedEst.roughMaterials) {
      updatedEst.roughMaterials.items = updatedEst.roughMaterials.items.filter((i: any) => i.id !== id);
    } else if (category === 'finish' && updatedEst.finishMaterials) {
      updatedEst.finishMaterials.items = updatedEst.finishMaterials.items.filter((i: any) => i.id !== id);
    }

    handleUpdateRoom({ ...selectedRoom, estimation: updatedEst });
  };

  const handleSelectFromDictionary = (id: string, name: string, subCategory: string, workId?: string) => {
    const found = priceList.find(p => p.name === name);
    if (found && selectedRoom) {
        const targetId = workId || id;
        const matId = workId ? id : undefined;
        
        // Объединяем обновления в один вызов, чтобы избежать гонки состояний
        const currentEst = initEstimationIfMissing(selectedRoom);
        const updatedEst = JSON.parse(JSON.stringify(currentEst));
        
        const updateItem = (item: EstimationItem) => {
            item.name = found.name;
            item.unit = found.unit;
            item.price = found.price;
            item.type = found.type;
            item.total = item.quantity * found.price;
            // Копируем подкатегорию из справочника (для отделочных работ)
            if (found.subcategory) {
                item.subcategory = found.subcategory;
            }
            // Копируем ссылку на товар из справочника
            if (found.supplierUrl) {
                item.supplierUrl = found.supplierUrl;
            }
            return item;
        };

        if (subCategory && updatedEst.works[subCategory]) {
            updatedEst.works[subCategory].items = updatedEst.works[subCategory].items.map((work: any) => {
                if (!matId && work.id === targetId) return updateItem(work);
                if (matId && work.id === workId) {
                    work.linkedMaterials = (work.linkedMaterials || []).map((m: any) => 
                        m.id === matId ? updateItem(m) : m
                    );
                }
                return work;
            });
        }

        handleUpdateRoom({ ...selectedRoom, estimation: updatedEst });
        setActiveSearchId(null);
    }
  };

  // === АВТОЗАПОЛНЕНИЕ СМЕТ ===
  const generateAutoEstimation = () => {
    if (!currentProject?.analysis?.rooms) return;
    
    setIsGeneratingEstimate(true);
    
    // Матрица работ: [состояние объекта][тип ремонта] -> набор работ
    const getWorksMatrix = (condition: PropertyCondition, renovation: RenovationType, roomType: 'wet' | 'living' | 'kitchen' | 'corridor') => {
      const works: { category: string; workId: string; qtyField: 'area' | 'wallArea' | 'perimeter' | 'doors' | 'windows' | 'fixed'; qtyMultiplier?: number }[] = [];
      
      // === ДЕМОНТАЖ ===
      const needsFullDemolition = condition === 'secondary' && renovation === 'capital';
      const needsFinishDemolition = condition === 'secondary' || condition === 'new_finish';
      
      if (needsFullDemolition) {
        // Полный демонтаж для вторички с капремонтом
        if (roomType === 'living' || roomType === 'corridor') {
          works.push({ category: 'Демонтажные работы', workId: 'w11', qtyField: 'wallArea' }); // Демонтаж обоев
          works.push({ category: 'Демонтажные работы', workId: 'w13', qtyField: 'area' }); // Демонтаж ламината
        }
        if (roomType === 'wet' || roomType === 'kitchen') {
          works.push({ category: 'Демонтажные работы', workId: 'w12', qtyField: 'wallArea' }); // Демонтаж плитки стены
          works.push({ category: 'Демонтажные работы', workId: 'w12', qtyField: 'area' }); // Демонтаж плитки пол
        }
        works.push({ category: 'Демонтажные работы', workId: 'w15', qtyField: 'area' }); // Демонтаж стяжки
        works.push({ category: 'Демонтажные работы', workId: 'w16', qtyField: 'wallArea' }); // Демонтаж штукатурки
        works.push({ category: 'Демонтажные работы', workId: 'w18', qtyField: 'doors' }); // Демонтаж дверей
        if (roomType === 'wet') {
          works.push({ category: 'Демонтажные работы', workId: 'w20', qtyField: 'fixed', qtyMultiplier: 3 }); // Демонтаж сантехники (унитаз, раковина, ванна)
        }
      } else if (needsFinishDemolition && renovation === 'cosmetic') {
        // Косметический демонтаж - только финишные покрытия
        if (roomType === 'living' || roomType === 'corridor') {
          works.push({ category: 'Демонтажные работы', workId: 'w11', qtyField: 'wallArea' }); // Демонтаж обоев
          works.push({ category: 'Демонтажные работы', workId: 'w13', qtyField: 'area' }); // Демонтаж ламината
        }
        if (roomType === 'wet' || roomType === 'kitchen') {
          works.push({ category: 'Демонтажные работы', workId: 'w12', qtyField: 'wallArea' }); // Демонтаж плитки
        }
      } else if (needsFinishDemolition && renovation === 'capital') {
        // Капитальный в чистовой новостройке
        if (roomType === 'living' || roomType === 'corridor') {
          works.push({ category: 'Демонтажные работы', workId: 'w11', qtyField: 'wallArea' });
          works.push({ category: 'Демонтажные работы', workId: 'w13', qtyField: 'area' });
        }
        if (roomType === 'wet' || roomType === 'kitchen') {
          works.push({ category: 'Демонтажные работы', workId: 'w12', qtyField: 'wallArea' });
          works.push({ category: 'Демонтажные работы', workId: 'w12', qtyField: 'area' });
        }
      }
      
      // === ПОДГОТОВИТЕЛЬНЫЕ РАБОТЫ ===
      works.push({ category: 'Подготовительные работы', workId: 'w1', qtyField: 'wallArea' }); // Грунтовка стен
      works.push({ category: 'Подготовительные работы', workId: 'w3', qtyField: 'area' }); // Грунтовка пола
      if (renovation === 'capital') {
        works.push({ category: 'Подготовительные работы', workId: 'w2', qtyField: 'area' }); // Грунтовка потолка
      }
      
      // === ЧЕРНОВАЯ ЭЛЕКТРИКА ===
      const needsNewElectric = condition === 'new_bare' || (condition === 'secondary' && renovation === 'capital');
      const needsElectricUpgrade = renovation === 'capital' && (condition === 'new_rough' || condition === 'new_pre_finish' || condition === 'new_finish');
      
      if (needsNewElectric) {
        works.push({ category: 'Черновая электрика', workId: 'w21', qtyField: 'perimeter', qtyMultiplier: 1.5 }); // Штробление стен
        works.push({ category: 'Черновая электрика', workId: 'w23', qtyField: 'perimeter', qtyMultiplier: 2 }); // Прокладка кабеля
        works.push({ category: 'Черновая электрика', workId: 'w25', qtyField: 'fixed', qtyMultiplier: roomType === 'kitchen' ? 8 : roomType === 'wet' ? 3 : 4 }); // Подрозетники
      } else if (needsElectricUpgrade) {
        works.push({ category: 'Черновая электрика', workId: 'w25', qtyField: 'fixed', qtyMultiplier: 2 }); // Доп. подрозетники
      }
      
      // === ЧЕРНОВАЯ САНТЕХНИКА ===
      const needsNewPlumbing = (condition === 'new_bare' || (condition === 'secondary' && renovation === 'capital')) && (roomType === 'wet' || roomType === 'kitchen');
      
      if (needsNewPlumbing) {
        works.push({ category: 'Черновая сантехника', workId: 'w32', qtyField: 'fixed', qtyMultiplier: roomType === 'wet' ? 4 : 2 }); // Водопровод
        works.push({ category: 'Черновая сантехника', workId: 'w33', qtyField: 'fixed', qtyMultiplier: roomType === 'wet' ? 3 : 1 }); // Канализация
        if (roomType === 'wet') {
          works.push({ category: 'Черновая сантехника', workId: 'w35', qtyField: 'area' }); // Гидроизоляция
        }
      }
      
      // === ЧЕРНОВЫЕ ОТДЕЛОЧНЫЕ РАБОТЫ ===
      const needsFullRoughFinish = condition === 'new_bare' || condition === 'new_rough' || (condition === 'secondary' && renovation === 'capital');
      const needsPartialRoughFinish = renovation === 'capital' && (condition === 'new_pre_finish' || condition === 'new_finish');
      
      if (needsFullRoughFinish) {
        works.push({ category: 'Черновые отделочные работы', workId: 'w41', qtyField: 'wallArea' }); // Штукатурка стен
        works.push({ category: 'Черновые отделочные работы', workId: 'w46', qtyField: 'area' }); // Стяжка пола
        works.push({ category: 'Черновые отделочные работы', workId: 'w48', qtyField: 'area' }); // Наливной пол
        if (roomType === 'living' || roomType === 'corridor') {
          works.push({ category: 'Черновые отделочные работы', workId: 'w44', qtyField: 'wallArea' }); // Шпаклёвка под покраску
        }
      } else if (needsPartialRoughFinish) {
        works.push({ category: 'Черновые отделочные работы', workId: 'w43', qtyField: 'wallArea' }); // Шпаклёвка под обои
      }
      
      // === ЧИСТОВЫЕ ОТДЕЛОЧНЫЕ РАБОТЫ ===
      // Всегда нужны для любого ремонта
      if (roomType === 'living') {
        works.push({ category: 'Чистовые отделочные работы', workId: 'w51', qtyField: 'area' }); // Ламинат
        works.push({ category: 'Чистовые отделочные работы', workId: 'w56', qtyField: 'wallArea' }); // Покраска стен
        works.push({ category: 'Чистовые отделочные работы', workId: 'w58', qtyField: 'area' }); // Натяжной потолок
      } else if (roomType === 'corridor') {
        works.push({ category: 'Чистовые отделочные работы', workId: 'w51', qtyField: 'area' }); // Ламинат
        works.push({ category: 'Чистовые отделочные работы', workId: 'w55', qtyField: 'wallArea' }); // Обои
        works.push({ category: 'Чистовые отделочные работы', workId: 'w58', qtyField: 'area' }); // Натяжной потолок
      } else if (roomType === 'wet') {
        works.push({ category: 'Чистовые отделочные работы', workId: 'w53', qtyField: 'area' }); // Плитка на пол
        works.push({ category: 'Чистовые отделочные работы', workId: 'w54', qtyField: 'wallArea' }); // Плитка на стены
        works.push({ category: 'Чистовые отделочные работы', workId: 'w58', qtyField: 'area' }); // Натяжной потолок
      } else if (roomType === 'kitchen') {
        works.push({ category: 'Чистовые отделочные работы', workId: 'w53', qtyField: 'area' }); // Плитка на пол
        works.push({ category: 'Чистовые отделочные работы', workId: 'w54', qtyField: 'wallArea', qtyMultiplier: 0.3 }); // Фартук
        works.push({ category: 'Чистовые отделочные работы', workId: 'w56', qtyField: 'wallArea', qtyMultiplier: 0.7 }); // Покраска
        works.push({ category: 'Чистовые отделочные работы', workId: 'w58', qtyField: 'area' }); // Натяжной потолок
      }
      works.push({ category: 'Чистовые отделочные работы', workId: 'w59', qtyField: 'perimeter' }); // Плинтус
      
      // === ЧИСТОВАЯ САНТЕХНИКА ===
      if (roomType === 'wet') {
        if (renovation === 'capital' || condition === 'new_bare') {
          works.push({ category: 'Чистовая сантехника', workId: 'w61', qtyField: 'fixed', qtyMultiplier: 1 }); // Унитаз
          works.push({ category: 'Чистовая сантехника', workId: 'w62', qtyField: 'fixed', qtyMultiplier: 1 }); // Раковина
          works.push({ category: 'Чистовая сантехника', workId: 'w63', qtyField: 'fixed', qtyMultiplier: 1 }); // Ванна
          works.push({ category: 'Чистовая сантехника', workId: 'w65', qtyField: 'fixed', qtyMultiplier: 2 }); // Смесители
        }
      } else if (roomType === 'kitchen') {
        if (renovation === 'capital' || condition === 'new_bare') {
          works.push({ category: 'Чистовая сантехника', workId: 'w62', qtyField: 'fixed', qtyMultiplier: 1 }); // Раковина
          works.push({ category: 'Чистовая сантехника', workId: 'w65', qtyField: 'fixed', qtyMultiplier: 1 }); // Смеситель
        }
      }
      
      // === ЧИСТОВАЯ ЭЛЕКТРИКА ===
      const baseRosettes = roomType === 'kitchen' ? 8 : roomType === 'wet' ? 3 : roomType === 'living' ? 6 : 2;
      const baseSwitches = roomType === 'living' ? 2 : 1;
      const baseLights = roomType === 'living' ? 4 : roomType === 'kitchen' ? 3 : roomType === 'wet' ? 2 : 1;
      
      works.push({ category: 'Чистовая электрика', workId: 'w71', qtyField: 'fixed', qtyMultiplier: baseRosettes }); // Розетки
      works.push({ category: 'Чистовая электрика', workId: 'w72', qtyField: 'fixed', qtyMultiplier: baseSwitches }); // Выключатели
      works.push({ category: 'Чистовая электрика', workId: 'w74', qtyField: 'fixed', qtyMultiplier: baseLights }); // Светильники
      
      // === ЗАВЕРШАЮЩИЕ РАБОТЫ ===
      works.push({ category: 'Установочные работы', workId: 'w60', qtyField: 'doors' }); // Порожки
      
      return works;
    };
    
    // Обновляем сметы для каждой комнаты
    const updatedRooms = currentProject.analysis.rooms.map(room => {
      const roomType = getRoomType(room.name);
      const worksToAdd = getWorksMatrix(propertyCondition, renovationType, roomType);
      
      // Получаем размеры комнаты
      const area = parseFloat(room.area || '0') || 10;
      const perimeter = parseFloat(room.perimeter || '0') || 12;
      const ceilingHeight = parseFloat(currentProject.analysis?.ceilingHeight || '2.7') || 2.7;
      const doors = parseInt(room.doors || '0') || 1;
      const windows = parseInt(room.windows || '0') || 0;
      const wallArea = parseFloat(room.wallArea || '') || (perimeter * ceilingHeight - doors * 1.9 - windows * 2.7);
      
      // Создаём новую смету
      const newEstimation: RoomEstimation = {
        works: {},
        roughMaterials: { items: [] },
        finishMaterials: { items: [] }
      };
      
      // Инициализируем все подкатегории
      WORK_SUBSECTIONS.forEach(sub => {
        newEstimation.works[sub] = { items: [] };
      });
      
      // Добавляем работы
      worksToAdd.forEach(workDef => {
        // Сначала пытаемся найти по ID (для обратной совместимости)
        let priceItem = priceList.find(p => p.id === workDef.workId);
        
        // Если не найдено по ID, ищем по имени из DEFAULT_PRICES
        if (!priceItem) {
          const defaultPrice = DEFAULT_PRICES.find(p => p.id === workDef.workId);
          if (defaultPrice) {
            // Ищем в прайс-листе по имени и категории
            priceItem = priceList.find(p => 
              p.name === defaultPrice.name && 
              p.category === defaultPrice.category &&
              p.type === defaultPrice.type
            );
          }
        }
        
        if (!priceItem) {
          console.warn(`Price item not found for workId: ${workDef.workId}`);
          return;
        }
        
        // Рассчитываем количество
        let quantity = 1;
        switch (workDef.qtyField) {
          case 'area': quantity = area; break;
          case 'wallArea': quantity = wallArea; break;
          case 'perimeter': quantity = perimeter; break;
          case 'doors': quantity = doors; break;
          case 'windows': quantity = windows; break;
          case 'fixed': quantity = 1; break;
        }
        quantity = Math.round(quantity * (workDef.qtyMultiplier || 1) * 10) / 10;
        if (quantity <= 0) return;
        
        const newItem: EstimationItem = {
          id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: priceItem.name,
          unit: priceItem.unit,
          quantity,
          price: priceItem.price,
          total: quantity * priceItem.price,
          type: 'work',
          linkedMaterials: []
        };
        
        if (newEstimation.works[workDef.category]) {
          newEstimation.works[workDef.category].items.push(newItem);
        }
      });
      
      return { ...room, estimation: newEstimation };
    });
    
    // Обновляем проект
    setCurrentProject(prev => prev ? {
      ...prev,
      analysis: {
        ...prev.analysis!,
        rooms: updatedRooms
      }
    } : null);
    
    setTimeout(() => setIsGeneratingEstimate(false), 500);
  };

  // === ГОЛОСОВОЙ ВВОД ДЛЯ СМЕТЫ ===
  const startVoiceRecording = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Ваш браузер не поддерживает распознавание речи. Используйте Chrome или Edge.');
      return;
    }

    // Сначала запрашиваем разрешение на микрофон
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Останавливаем поток после получения разрешения
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Для использования голосового ввода разрешите доступ к микрофону в настройках браузера.');
      } else if (err.name === 'NotFoundError') {
        alert('Микрофон не найден. Подключите микрофон и попробуйте снова.');
      } else {
        alert('Ошибка доступа к микрофону: ' + err.message);
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
      setIsRecording(true);
      setVoiceTranscript('');
      finalTranscriptRef.current = '';
      isStoppingRef.current = false;
    };
    
    recognition.onresult = (event: any) => {
      if (isStoppingRef.current) return; // Игнорируем результаты после остановки
      
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      // Сохраняем финальный текст
      if (finalTranscript) {
        finalTranscriptRef.current = (finalTranscriptRef.current ? finalTranscriptRef.current + ' ' : '') + finalTranscript;
      }
      // Показываем промежуточный результат во время говорения
      const displayText = finalTranscriptRef.current + (interimTranscript ? ' ' + interimTranscript : '');
      setVoiceTranscript(displayText);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      isStoppingRef.current = false;
      
      // Не показываем ошибку, если мы сами остановили распознавание
      if (event.error === 'aborted') {
        return;
      }
      
      if (event.error === 'not-allowed') {
        alert('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.');
      } else if (event.error === 'no-speech') {
        // Молча обрабатываем - пользователь просто не говорил
      } else if (event.error === 'network') {
        alert('Ошибка сети при распознавании речи.');
      } else {
        // Для других ошибок не показываем alert, чтобы не мешать пользователю
        console.warn('Speech recognition error (non-critical):', event.error);
      }
    };
    
    recognition.onend = () => {
      setIsRecording(false);
      isStoppingRef.current = false;
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceRecording = async () => {
    if (isStoppingRef.current) return; // Предотвращаем множественные вызовы
    isStoppingRef.current = true;
    
    if (recognitionRef.current) {
      try {
        // Используем abort() для немедленной остановки вместо stop()
        recognitionRef.current.abort();
      } catch (e) {
        // Если abort не работает, пробуем stop
        try {
          recognitionRef.current.stop();
        } catch (e2) {
          console.warn('Error stopping recognition:', e2);
        }
      }
    }
    
    setIsRecording(false);
    
    // Используем сохраненный финальный текст
    const transcript = (finalTranscriptRef.current || voiceTranscript).trim();
    
    // Небольшая задержка, чтобы убедиться, что распознавание остановлено
    setTimeout(async () => {
      if (!transcript || !selectedRoom) {
        setVoiceTranscript('');
        finalTranscriptRef.current = '';
        isStoppingRef.current = false;
        return;
      }
      
      setIsProcessingVoice(true);
      
      try {
        // Рассчитываем параметры комнаты
        const ceilingHeight = parseFloat(currentProject?.analysis?.ceilingHeight || '2.7') || 2.7;
        const floorArea = parseFloat(selectedRoom.area || '0') || 10;
        const perimeter = parseFloat(selectedRoom.perimeter || '0') || 12;
        const doors = parseInt(selectedRoom.doors || '0') || 1;
        const windows = parseInt(selectedRoom.windows || '0') || 0;
        const wallArea = parseFloat(selectedRoom.wallArea || '') || (perimeter * ceilingHeight - doors * 1.9 - windows * 2.7);
        
        const roomParams = {
          name: selectedRoom.name,
          floorArea,
          wallArea,
          perimeter,
          doors,
          windows,
          ceilingHeight
        };
        
        // Парсим голосовой ввод через ИИ
        const parsedItems = await parseVoiceEstimation(transcript, roomParams, priceList);
        
        if (parsedItems.length === 0) {
          alert('Не удалось распознать работы в голосовом сообщении. Попробуйте ещё раз.');
          setVoiceTranscript('');
          setIsProcessingVoice(false);
          return;
        }
        
        // Добавляем распознанные пункты в смету
        const currentEst = selectedRoom.estimation || {
          works: {},
          roughMaterials: { items: [] },
          finishMaterials: { items: [] }
        };
        const updatedEst = JSON.parse(JSON.stringify(currentEst));
        
        // Инициализируем все подкатегории если их нет
        WORK_SUBSECTIONS.forEach(sub => {
          if (!updatedEst.works[sub]) {
            updatedEst.works[sub] = { items: [] };
          }
        });
        
        // Функция для капитализации первой буквы
        const capitalizeFirstLetter = (str: string): string => {
          if (!str) return str;
          return str.charAt(0).toUpperCase() + str.slice(1);
        };
        
        // Функция для нормализации названия (удаление окончаний для сравнения)
        const normalizeName = (name: string): string => {
          if (!name) return '';
          const lower = name.toLowerCase().trim();
          // Удаляем общие русские окончания (последние 1-3 символа)
          // Это поможет игнорировать различия типа "полотенцесушителя" vs "полотенцесушитель"
          const endings = ['а', 'я', 'и', 'ы', 'у', 'ю', 'е', 'о', 'ом', 'ой', 'ей', 'ами', 'ах', 'ами'];
          for (const ending of endings) {
            if (lower.endsWith(ending) && lower.length > ending.length + 3) {
              return lower.slice(0, -ending.length);
            }
          }
          return lower;
        };
        
        // Функция для гибкого поиска совпадения в справочнике
        const findSimilarPriceItem = (searchName: string, type: string): PriceItem | undefined => {
          const normalizedSearch = normalizeName(searchName);
          
          // Сначала ищем точное совпадение
          let exactMatch = priceList.find(p => 
            p.name.toLowerCase().trim() === searchName.toLowerCase().trim() &&
            p.type === type
          );
          if (exactMatch) return exactMatch;
          
          // Затем ищем совпадение по нормализованным названиям
          // Считаем совпадением, если нормализованные названия совпадают
          let normalizedMatch = priceList.find(p => {
            if (p.type !== type) return false;
            const normalizedPrice = normalizeName(p.name);
            return normalizedPrice === normalizedSearch && normalizedSearch.length > 5; // Минимум 5 символов для надежности
          });
          if (normalizedMatch) return normalizedMatch;
          
          // Также проверяем, что одно название содержит другое (для случаев типа "демонтаж полотенцесушителя" vs "демонтаж полотенцесушитель")
          let containsMatch = priceList.find(p => {
            if (p.type !== type) return false;
            const priceLower = p.name.toLowerCase().trim();
            const searchLower = searchName.toLowerCase().trim();
            // Проверяем, что одно содержит другое, и разница только в окончании
            if (priceLower.includes(normalizedSearch) || normalizedSearch.includes(normalizeName(p.name))) {
              // Проверяем, что разница не слишком большая (не более 3 символов)
              const diff = Math.abs(priceLower.length - searchLower.length);
              return diff <= 3 && normalizedSearch.length > 5;
            }
            return false;
          });
          if (containsMatch) return containsMatch;
          
          return undefined;
        };
        
        // Обрабатываем каждую позицию
        for (const item of parsedItems) {
          // Капитализируем название позиции
          const capitalizedName = capitalizeFirstLetter(item.name.trim());
          
          // Проверяем, есть ли совпадение позиции в прайс-листе (с учетом окончаний)
          let priceItem = findSimilarPriceItem(capitalizedName, item.type);
          
          // Если найдено совпадение (точное или по нормализованному названию) - используем существующую позицию
          // Это предотвращает создание дубликатов из-за различий в окончаниях
          if (priceItem) {
            console.log(`Found similar price item: "${priceItem.name}" for "${capitalizedName}"`);
            // Используем название из справочника для единообразия
            const finalName = priceItem.name;
            
            // Определяем количество для сметы
            let quantity = item.quantity || 1;
            if (item.quantitySource !== 'voice' && (item.quantity === null || item.quantity === undefined)) {
              switch (item.quantitySource) {
                case 'floorArea':
                case 'ceilingArea':
                  quantity = floorArea;
                  break;
                case 'wallArea':
                  quantity = wallArea;
                  break;
                case 'perimeter':
                  quantity = perimeter;
                  break;
                case 'doors':
                  quantity = doors;
                  break;
                case 'windows':
                  quantity = windows;
                  break;
                default:
                  quantity = 1;
              }
            }
            quantity = Math.round(quantity * 10) / 10;
            
            // Используем цену из справочника, если она есть
            const price = priceItem.price || (item.suggestedPrice || 0);
            
            // Определяем категорию для добавления в смету
            let subCategory = item.category || 'Общие';
            if (priceItem.category && (ROUGH_WORK_SECTIONS.includes(priceItem.category) || FINISH_WORK_SECTIONS.includes(priceItem.category))) {
              subCategory = priceItem.category;
            }
            
            // Добавляем в смету с использованием существующей позиции из справочника
            const newItem: EstimationItem = {
              id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: finalName,
              unit: priceItem.unit || item.unit || 'шт',
              quantity,
              price,
              total: quantity * price,
              type: item.type === 'work' ? 'work' : item.type,
              linkedMaterials: []
            };
            
            // Добавляем в соответствующую секцию сметы
            if (item.type === 'work') {
              if (!updatedEst.works[subCategory]) {
                updatedEst.works[subCategory] = { items: [] };
              }
              updatedEst.works[subCategory].items.push(newItem);
            } else if (item.type === 'rough') {
              updatedEst.roughMaterials.items.push(newItem);
            } else if (item.type === 'finish') {
              updatedEst.finishMaterials.items.push(newItem);
            }
            
            continue; // Переходим к следующей позиции
          }
          
          // Если позиции нет в прайс-листе, создаём её
          if (!priceItem) {
            // Проверяем права на редактирование прайсов
            if (!hasPermission(PERMISSIONS.EDIT_PRICES)) {
              console.warn('No permission to create price item:', item.name);
              // Продолжаем без создания в прайс-листе, но добавляем в смету
            } else {
              try {
                // Определяем количество для новой позиции
                let quantity = item.quantity;
                if (item.quantitySource !== 'voice' && (item.quantity === null || item.quantity === undefined)) {
                  switch (item.quantitySource) {
                    case 'floorArea':
                    case 'ceilingArea':
                      quantity = floorArea;
                      break;
                    case 'wallArea':
                      quantity = wallArea;
                      break;
                    case 'perimeter':
                      quantity = perimeter;
                      break;
                    case 'doors':
                      quantity = doors;
                      break;
                    case 'windows':
                      quantity = windows;
                      break;
                    default:
                      quantity = 1;
                  }
                }
                
                // Извлекаем цену из голосового ввода, если она была указана
                // Ищем числа с "р", "руб", "рублей" после них
                let extractedPrice = item.suggestedPrice || 0;
                if (extractedPrice === 0 || extractedPrice === null) {
                  // Пытаемся извлечь цену из названия или транскрипта
                  const priceMatch = transcript.match(/(\d+)\s*(?:р|руб|рублей|₽)/i);
                  if (priceMatch) {
                    extractedPrice = parseFloat(priceMatch[1]);
                  }
                }
                
                // Определяем категорию и подкатегорию
                let category = item.category || 'Черновые отделочные работы';
                let subcategory: string | undefined = undefined;
                
                // Определяем подкатегорию для отделочных работ
                if (category === 'Черновые отделочные работы' || category === 'Чистовые отделочные работы') {
                  // Определяем по quantitySource
                  if (item.quantitySource === 'wallArea') {
                    subcategory = 'Стены';
                  } else if (item.quantitySource === 'floorArea') {
                    subcategory = 'Пол';
                  } else if (item.quantitySource === 'ceilingArea') {
                    subcategory = 'Потолок';
                  } else {
                    // Пытаемся определить по названию
                    const nameLower = item.name.toLowerCase();
                    if (nameLower.includes('стен') || nameLower.includes('стена') || 
                        nameLower.includes('плитка на стен') || nameLower.includes('запил плитки')) {
                      subcategory = 'Стены';
                    } else if (nameLower.includes('пол') || nameLower.includes('пола') || 
                               nameLower.includes('плитка на пол')) {
                      subcategory = 'Пол';
                    } else if (nameLower.includes('потолок') || nameLower.includes('потолка')) {
                      subcategory = 'Потолок';
                    }
                    // Если не определили, но это работа со стенами по умолчанию - ставим Стены
                    if (!subcategory && (nameLower.includes('плитк') || nameLower.includes('штукатурк') || 
                                         nameLower.includes('шпаклёвк') || nameLower.includes('покраск'))) {
                      subcategory = 'Стены';
                    }
                  }
                }
                
                console.log('Creating new price item:', {
                  name: item.name,
                  category,
                  subcategory,
                  type: item.type || 'work',
                  unit: item.unit || 'шт',
                  price: extractedPrice > 0 ? extractedPrice : 1
                });
                
                // Создаём новую позицию в прайс-листе
                const newPriceItem = await api.createPriceItem({
                  name: capitalizedName,
                  unit: item.unit || 'шт',
                  price: extractedPrice > 0 ? extractedPrice : 1, // Если цена не указана, ставим 1 руб.
                  category,
                  subcategory,
                  type: item.type || 'work',
                });
                
                console.log('Successfully created price item:', newPriceItem);
                
                // Добавляем в локальный список прайсов
                setPriceList(prev => [...prev, newPriceItem]);
                priceItem = newPriceItem;
              } catch (error) {
                console.error('Failed to create price item:', error);
                console.error('Item data:', item);
                // Продолжаем без добавления в прайс-лист, но добавляем в смету
              }
            }
          }
          
          // Определяем количество для сметы
          let quantity = item.quantity || 1;
          if (item.quantitySource !== 'voice' && (item.quantity === null || item.quantity === undefined)) {
            switch (item.quantitySource) {
              case 'floorArea':
              case 'ceilingArea':
                quantity = floorArea;
                break;
              case 'wallArea':
                quantity = wallArea;
                break;
              case 'perimeter':
                quantity = perimeter;
                break;
              case 'doors':
                quantity = doors;
                break;
              case 'windows':
                quantity = windows;
                break;
              default:
                quantity = 1;
            }
          }
          quantity = Math.round(quantity * 10) / 10;
          
          // Используем цену из прайс-листа, если позиция найдена
          // Если позиция новая, пытаемся извлечь цену из голосового ввода
          let price = priceItem ? priceItem.price : (item.suggestedPrice || 0);
          if (price === 0 && !priceItem) {
            // Пытаемся извлечь цену из транскрипта
            const priceMatch = transcript.match(/(\d+)\s*(?:р|руб|рублей|₽)/i);
            if (priceMatch) {
              price = parseFloat(priceMatch[1]);
            } else {
              price = 1; // По умолчанию 1 руб. если цена не указана
            }
          }
          
          const newItem: EstimationItem = {
            id: `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: capitalizedName,
            unit: item.unit || (priceItem ? priceItem.unit : 'шт'),
            quantity,
            price,
            total: quantity * price,
            type: item.type === 'work' ? 'work' : item.type,
            linkedMaterials: []
          };
          
          // Добавляем в соответствующую категорию
          if (item.type === 'work' && updatedEst.works[item.category]) {
            updatedEst.works[item.category].items.push(newItem);
          } else if (item.type === 'rough') {
            updatedEst.roughMaterials.items.push(newItem);
          } else if (item.type === 'finish') {
            updatedEst.finishMaterials.items.push(newItem);
          }
        }
        
        handleUpdateRoom({ ...selectedRoom, estimation: updatedEst });
        
        // Показываем уведомление об успехе
        alert(`Добавлено ${parsedItems.length} позиций в смету`);
        
      } catch (error: any) {
        console.error('Error processing voice:', error);
        // Не показываем alert для ошибок, которые могут быть временными
        const errorMessage = error.message || 'Неизвестная ошибка';
        if (!errorMessage.includes('aborted') && !errorMessage.includes('cancelled')) {
          alert('Ошибка обработки голосового ввода: ' + errorMessage);
        }
      } finally {
        setVoiceTranscript('');
        finalTranscriptRef.current = '';
        setIsProcessingVoice(false);
        isStoppingRef.current = false;
      }
    }, 500); // Увеличиваем задержку для надежности
  };

  const calculateSubtotalByType = (items?: EstimationItem[], type?: 'work' | 'rough' | 'finish') => {
      if (!items) return 0;
      let total = 0;
      items.forEach(item => {
          if (!type || item.type === type) total += (Number(item.total) || 0);
          if (item.linkedMaterials) {
              total += calculateSubtotalByType(item.linkedMaterials, type);
          }
      });
      return total;
  };

  const calculateTotalForRoom = (type: 'work' | 'rough' | 'finish') => {
      if (!selectedRoom?.estimation) return 0;
      const est = selectedRoom.estimation;
      let sum = 0;
      Object.values(est.works).forEach(sec => {
          sum += calculateSubtotalByType((sec as any).items, type);
      });
      if (type === 'rough') sum += calculateSubtotalByType(est.roughMaterials?.items);
      if (type === 'finish') sum += calculateSubtotalByType(est.finishMaterials?.items);
      return sum;
  };

  // Расчёт общей сметы по всем комнатам, сгруппированной по подгруппам работ
  const calculateGlobalEstimation = () => {
      const rooms = currentProject?.analysis?.rooms || [];
      const result: Record<string, { 
          work: number; 
          rough: number; 
          finish: number; 
          items: EstimationItem[];
      }> = {};
      
      // Инициализируем все подгруппы (включая глобальные)
      ALL_WORK_SECTIONS.forEach(sub => {
          result[sub] = { work: 0, rough: 0, finish: 0, items: [] };
      });
      
      // Суммируем данные со всех комнат (только обычные секции, не глобальные)
      rooms.forEach(room => {
          if (!room.estimation?.works) return;
          
          WORK_SUBSECTIONS.forEach(sub => {
              const section = room.estimation?.works?.[sub];
              if (!section?.items) return;
              
              result[sub].work += calculateSubtotalByType(section.items, 'work');
              result[sub].rough += calculateSubtotalByType(section.items, 'rough');
              result[sub].finish += calculateSubtotalByType(section.items, 'finish');
              
              // Собираем все items (работы и связанные материалы)
              section.items.forEach((item: EstimationItem) => {
                  // Добавляем работу
                  const existingWork = result[sub].items.find(
                      i => i.name === item.name && i.type === item.type && i.unit === item.unit && Number(i.price) === Number(item.price)
                  );
                  if (existingWork) {
                      existingWork.quantity = Number(existingWork.quantity) + Number(item.quantity);
                      existingWork.total = Number(existingWork.total) + Number(item.total);
                  } else {
                      result[sub].items.push({ 
                          ...item, 
                          id: `global-${item.id}`,
                          quantity: Number(item.quantity),
                          total: Number(item.total),
                          price: Number(item.price)
                      });
                  }
                  
                  // Добавляем связанные материалы
                  if (item.linkedMaterials) {
                      item.linkedMaterials.forEach((mat: EstimationItem) => {
                          const existingMat = result[sub].items.find(
                              i => i.name === mat.name && i.type === mat.type && i.unit === mat.unit && Number(i.price) === Number(mat.price)
                          );
                          if (existingMat) {
                              existingMat.quantity = Number(existingMat.quantity) + Number(mat.quantity);
                              existingMat.total = Number(existingMat.total) + Number(mat.total);
                          } else {
                              result[sub].items.push({ 
                                  ...mat, 
                                  id: `global-${mat.id}`,
                                  quantity: Number(mat.quantity),
                                  total: Number(mat.total),
                                  price: Number(mat.price)
                              });
                          }
                      });
                  }
              });
          });
      });
      
      // Добавляем данные глобальных секций (хранятся на уровне проекта)
      const globalWorks = currentProject?.analysis?.globalWorks || {};
      GLOBAL_ONLY_SECTIONS.forEach(sub => {
          const section = globalWorks[sub];
          if (section?.items) {
              section.items.forEach((item: EstimationItem) => {
                  result[sub].items.push({ ...item });
                  if (item.type === 'work') {
                      result[sub].work += Number(item.total) || 0;
                  }
              });
          }
      });
      
      return result;
  };

  // Обновление материала во всех комнатах (для общей сметы)
  const handleUpdateGlobalMaterial = async (
      materialName: string,
      materialUnit: string,
      materialType: string,
      field: 'price' | 'supplierUrl',
      value: string | number
  ) => {
      if (!currentProject?.analysis?.rooms) return;
      
      const updatedRooms = currentProject.analysis.rooms.map(room => {
          if (!room.estimation?.works) return room;
          
          const updatedWorks = { ...room.estimation.works };
          
          // Проходим по всем секциям работ
          Object.keys(updatedWorks).forEach(sectionKey => {
              const section = updatedWorks[sectionKey];
              if (!section?.items) return;
              
              section.items = section.items.map((work: EstimationItem) => {
                  // Обновляем связанные материалы
                  if (work.linkedMaterials) {
                      work.linkedMaterials = work.linkedMaterials.map((mat: EstimationItem) => {
                          if (mat.name === materialName && mat.unit === materialUnit && mat.type === materialType) {
                              if (field === 'price') {
                                  const newPrice = Number(value);
                                  return { ...mat, price: newPrice, total: mat.quantity * newPrice };
                              } else if (field === 'supplierUrl') {
                                  return { ...mat, supplierUrl: value as string };
                              }
                          }
                          return mat;
                      });
                  }
                  return work;
              });
          });
          
          return { ...room, estimation: { ...room.estimation, works: updatedWorks } };
      });
      
      // Обновляем проект с новыми данными комнат
      const updatedProject = {
          ...currentProject,
          analysis: { ...currentProject.analysis, rooms: updatedRooms }
      };
      
      // Обновляем локальное состояние
      setCurrentProject(updatedProject);
      
      // Сохраняем в бэкенд
      try {
          await api.updateProject(updatedProject.id, {
              analysisData: updatedProject.analysis,
          });
      } catch (error) {
          console.error('Failed to save global material update:', error);
      }
  };

  // Добавить позицию в глобальную секцию (Умный дом, Накладные расходы)
  const handleAddGlobalSectionItem = async (sectionName: string) => {
      if (!currentProject?.analysis) return;
      
      const globalWorks = currentProject.analysis.globalWorks || {};
      const section = globalWorks[sectionName] || { items: [] };
      
      const newItem: EstimationItem = {
          id: `global-${Date.now()}`,
          name: '',
          unit: 'шт',
          quantity: 1,
          price: 0,
          total: 0,
          type: 'work'
      };
      
      section.items = [...section.items, newItem];
      
      const updatedProject = {
          ...currentProject,
          analysis: {
              ...currentProject.analysis,
              globalWorks: { ...globalWorks, [sectionName]: section }
          }
      };
      
      setCurrentProject(updatedProject);
      
      try {
          await api.updateProject(updatedProject.id, {
              analysisData: updatedProject.analysis,
          });
      } catch (error) {
          console.error('Failed to save global section item:', error);
      }
  };

  // Обновить позицию в глобальной секции
  const handleUpdateGlobalSectionItem = async (
      sectionName: string,
      itemId: string,
      field: string,
      value: any
  ) => {
      if (!currentProject?.analysis) return;
      
      const globalWorks = currentProject.analysis.globalWorks || {};
      const section = globalWorks[sectionName] || { items: [] };
      
      section.items = section.items.map((item: EstimationItem) => {
          if (item.id === itemId) {
              const updated = { ...item, [field]: value };
              if (field === 'quantity' || field === 'price') {
                  updated.total = Number(updated.quantity) * Number(updated.price);
              }
              return updated;
          }
          return item;
      });
      
      const updatedProject = {
          ...currentProject,
          analysis: {
              ...currentProject.analysis,
              globalWorks: { ...globalWorks, [sectionName]: section }
          }
      };
      
      setCurrentProject(updatedProject);
      
      // Debounce save
      setTimeout(async () => {
          try {
              await api.updateProject(updatedProject.id, {
                  analysisData: updatedProject.analysis,
              });
          } catch (error) {
              console.error('Failed to save global section item update:', error);
          }
      }, 500);
  };

  // Удалить позицию из глобальной секции
  const handleDeleteGlobalSectionItem = async (sectionName: string, itemId: string) => {
      if (!currentProject?.analysis) return;
      
      const globalWorks = currentProject.analysis.globalWorks || {};
      const section = globalWorks[sectionName] || { items: [] };
      
      section.items = section.items.filter((item: EstimationItem) => item.id !== itemId);
      
      const updatedProject = {
          ...currentProject,
          analysis: {
              ...currentProject.analysis,
              globalWorks: { ...globalWorks, [sectionName]: section }
          }
      };
      
      setCurrentProject(updatedProject);
      
      try {
          await api.updateProject(updatedProject.id, {
              analysisData: updatedProject.analysis,
          });
      } catch (error) {
          console.error('Failed to delete global section item:', error);
      }
  };

  // Выбор позиции из справочника для глобальной секции
  const handleSelectFromDictionaryForGlobalSection = async (
      sectionName: string,
      itemId: string,
      priceName: string
  ) => {
      const found = priceList.find(p => p.name === priceName && p.category === sectionName);
      if (!found || !currentProject?.analysis) return;
      
      const globalWorks = currentProject.analysis.globalWorks || {};
      const section = globalWorks[sectionName] || { items: [] };
      
      section.items = section.items.map((item: EstimationItem) => {
          if (item.id === itemId) {
              return {
                  ...item,
                  name: found.name,
                  unit: found.unit,
                  price: found.price,
                  total: Number(item.quantity || 1) * found.price
              };
          }
          return item;
      });
      
      const updatedProject = {
          ...currentProject,
          analysis: {
              ...currentProject.analysis,
              globalWorks: { ...globalWorks, [sectionName]: section }
          }
      };
      
      setCurrentProject(updatedProject);
      setGlobalSectionActiveSearchId(null);
      
      try {
          await api.updateProject(updatedProject.id, {
              analysisData: updatedProject.analysis,
          });
      } catch (error) {
          console.error('Failed to select from dictionary for global section:', error);
      }
  };

  // Обновить цену материала в общей смете (загрузить с сайта)
  const handleRefreshGlobalMaterialPrice = async (
      materialName: string,
      materialUnit: string,
      materialType: string,
      supplierUrl: string
  ) => {
      if (!supplierUrl) {
          alert('Сначала добавьте ссылку на товар');
          return;
      }
      
      try {
          const result = await api.parseSupplierPrice(supplierUrl);
          if (result.price) {
              await handleUpdateGlobalMaterial(materialName, materialUnit, materialType, 'price', result.price);
              alert(`Цена обновлена во всех комнатах: ${result.price} ₽`);
          } else {
              alert('Не удалось получить цену');
          }
      } catch (e: any) {
          alert(`Ошибка: ${e.message || 'Не удалось обновить цену'}`);
      }
  };

  // Расчёт общих итогов по всем комнатам
  const calculateGlobalTotals = () => {
      const rooms = currentProject?.analysis?.rooms || [];
      let totalWork = 0;
      let totalRough = 0;
      let totalFinish = 0;
      let globalSectionsTotal = 0; // Для глобальных секций (Накладные расходы, Умный дом)
      
      rooms.forEach(room => {
          if (!room.estimation) return;
          
          // Учитываем работы и материалы из секций works
          if (room.estimation.works) {
              Object.values(room.estimation.works).forEach(sec => {
                  totalWork += calculateSubtotalByType((sec as any).items, 'work');
                  totalRough += calculateSubtotalByType((sec as any).items, 'rough');
                  totalFinish += calculateSubtotalByType((sec as any).items, 'finish');
              });
          }
          
          // Учитываем материалы из отдельных секций roughMaterials и finishMaterials
          if (room.estimation.roughMaterials?.items) {
              totalRough += calculateSubtotalByType(room.estimation.roughMaterials.items, 'rough');
          }
          if (room.estimation.finishMaterials?.items) {
              totalFinish += calculateSubtotalByType(room.estimation.finishMaterials.items, 'finish');
          }
      });
      
      // Добавляем глобальные секции (Накладные расходы, Умный дом) в итог по работам и в общий итог
      const globalWorks = currentProject?.analysis?.globalWorks || {};
      GLOBAL_ONLY_SECTIONS.forEach(sectionName => {
          const section = globalWorks[sectionName];
          if (section?.items) {
              section.items.forEach((item: EstimationItem) => {
                  const itemTotal = Number(item.total) || 0;
                  // Работы из глобальных секций включаются в итог по работам
                  if (item.type === 'work') {
                      totalWork += itemTotal;
                  } else if (item.type === 'rough') {
                      totalRough += itemTotal;
                  } else if (item.type === 'finish') {
                      totalFinish += itemTotal;
                  }
                  // Глобальные секции уже учтены в totalWork/totalRough/totalFinish, поэтому не добавляем их отдельно
              });
          }
      });
      
      return { 
          totalWork, 
          totalRough, 
          totalFinish, 
          grandTotal: totalWork + totalRough + totalFinish 
      };
  };

  // Load price items from backend
  // Backend automatically initializes default prices if none exist
  const loadPriceItems = async () => {
    try {
      const backendPrices = await api.getPriceItems();
      setPriceList(backendPrices);
      console.log(`Loaded ${backendPrices.length} price items from backend`);
    } catch (error) {
      console.error('Failed to load price items:', error);
      // Fallback to default prices on error
      setPriceList(DEFAULT_PRICES);
    }
  };

  // CRUD функции для прайсов
  const handleAddPriceItem = async (type: 'work' | 'rough' | 'finish', category: string, subcategory?: string) => {
    if (!hasPermission(PERMISSIONS.EDIT_PRICES)) {
      alert('У вас нет прав для редактирования прайсов');
      return;
    }

    try {
      const newItem = await api.createPriceItem({
        name: '',
        unit: type === 'work' ? 'м2' : type === 'rough' ? 'кг' : 'м2',
        price: 0,
        category,
        subcategory,
        type,
      });
      setPriceList(prev => [...prev, newItem]);
    } catch (error) {
      console.error('Failed to create price item:', error);
      alert('Ошибка при создании позиции прайса');
    }
  };

  const handleUpdatePriceItem = (id: string, field: keyof PriceItem, value: string | number) => {
    if (!hasPermission(PERMISSIONS.EDIT_PRICES)) {
      return;
    }

    // Optimistically update UI
    setPriceList(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: field === 'price' ? Number(value) : value };
      }
      return item;
    }));

    // Clear existing timeout for this item
    if (priceUpdateTimeouts.current[id]) {
      clearTimeout(priceUpdateTimeouts.current[id]);
    }

    // Save to backend with debounce
    priceUpdateTimeouts.current[id] = setTimeout(async () => {
      try {
        const updateData: any = {};
        // Map frontend field names to backend field names
        if (field === 'supplierUrl') {
          updateData.supplier_url = value || null;
        } else if (field === 'supplierName') {
          updateData.supplier_name = value || null;
        } else if (field === 'lastPriceUpdate') {
          updateData.last_price_update = value ? new Date(value as string).toISOString() : null;
        } else if (field === 'autoPriceUpdate') {
          updateData.auto_price_update = value;
        } else {
          updateData[field] = field === 'price' ? Number(value) : value;
        }
        await api.updatePriceItem(id, updateData);
        delete priceUpdateTimeouts.current[id];
      } catch (error) {
        console.error('Failed to update price item:', error);
        // Reload prices on error to restore correct state
        await loadPriceItems();
        delete priceUpdateTimeouts.current[id];
      }
    }, 1000);
  };

  const handleDeletePriceItem = async (id: string) => {
    if (!hasPermission(PERMISSIONS.EDIT_PRICES)) {
      alert('У вас нет прав для удаления позиций прайса');
      return;
    }

    try {
      await api.deletePriceItem(id);
      setPriceList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete price item:', error);
      alert('Ошибка при удалении позиции прайса');
    }
  };

  const handleUpdatePriceFromUrl = async (item: PriceItem) => {
    if (!item.supplierUrl) {
      alert('Сначала добавьте ссылку на товар');
      return;
    }

    setUpdatingPriceId(item.id);
    try {
      const result = await api.parseSupplierPrice(item.supplierUrl);
      if (result.price) {
        // Обновляем цену СРАЗУ в базе данных (без debounce)
        const updateData: any = {
          price: Number(result.price),
          last_price_update: new Date().toISOString(),
        };
        if (result.supplierName) {
          updateData.supplier_name = result.supplierName;
        }
        
        // Сохраняем в базу
        await api.updatePriceItem(item.id, updateData);
        
        // Обновляем локальное состояние
        setPriceList(prev => prev.map(p => {
          if (p.id === item.id) {
            return {
              ...p,
              price: Number(result.price),
              supplierName: result.supplierName || p.supplierName,
              lastPriceUpdate: new Date().toISOString(),
            };
          }
          return p;
        }));
        
        alert(`Цена обновлена: ${result.price} ₽`);
      } else {
        alert('Не удалось найти цену на странице');
      }
    } catch (error: any) {
      console.error('Failed to update price from URL:', error);
      alert(`Ошибка: ${error.message || 'Не удалось обновить цену'}`);
    } finally {
      setUpdatingPriceId(null);
    }
  };

  // Обновить все цены для материалов где есть ссылки
  const [updatingAllPrices, setUpdatingAllPrices] = useState(false);
  
  const handleUpdateAllPricesWithUrls = async (materialType: 'rough' | 'finish') => {
    const itemsWithUrls = priceList.filter(p => p.type === materialType && p.supplierUrl);
    
    if (itemsWithUrls.length === 0) {
      alert('Нет материалов со ссылками для обновления');
      return;
    }
    
    if (!confirm(`Обновить цены для ${itemsWithUrls.length} материалов со ссылками?`)) {
      return;
    }
    
    setUpdatingAllPrices(true);
    let updated = 0;
    let failed = 0;
    
    for (const item of itemsWithUrls) {
      try {
        setUpdatingPriceId(item.id);
        const result = await api.parseSupplierPrice(item.supplierUrl!);
        
        if (result.price) {
          const updateData: any = {
            price: Number(result.price),
            last_price_update: new Date().toISOString(),
          };
          if (result.supplierName) {
            updateData.supplier_name = result.supplierName;
          }
          
          await api.updatePriceItem(item.id, updateData);
          
          setPriceList(prev => prev.map(p => {
            if (p.id === item.id) {
              return {
                ...p,
                price: Number(result.price),
                supplierName: result.supplierName || p.supplierName,
                lastPriceUpdate: new Date().toISOString(),
              };
            }
            return p;
          }));
          
          updated++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to update price for ${item.name}:`, error);
        failed++;
      }
    }
    
    setUpdatingPriceId(null);
    setUpdatingAllPrices(false);
    alert(`Обновлено: ${updated}, Ошибок: ${failed}`);
  };

  // Автоматическое добавление позиции в справочник, если её нет
  const autoAddToPriceList = (
    name: string, 
    unit: string, 
    price: number, 
    type: 'work' | 'rough' | 'finish',
    category?: string,
    subcategory?: string
  ) => {
    if (!name || !name.trim()) return;
    
    // Добавляем в справочник только если указана цена
    const priceValue = Number(price) || 0;
    if (priceValue <= 0) return;
    
    setPriceList(prev => {
      const idx = prev.findIndex(p =>
        p.name.toLowerCase().trim() === name.toLowerCase().trim() &&
        p.type === type
      );

      // Определяем значения по умолчанию
      const fallbackUnit = type === 'work' ? 'м²' : type === 'rough' ? 'кг' : 'м²';
      const fallbackCategory = type === 'work'
        ? 'Общие'
        : type === 'rough'
          ? 'Черновые материалы'
          : 'Чистовые материалы';

      // Для отделочных работ, если подкатегория не определена - ставим "Стены" по умолчанию
      let finalSubcategory = subcategory;
      if (type === 'work' && (category === 'Черновые отделочные работы' || category === 'Чистовые отделочные работы')) {
        if (!finalSubcategory) {
          finalSubcategory = 'Стены';
        }
      }

      if (idx === -1) {
        const newItem: PriceItem = {
          id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: name.trim(),
          unit: unit || fallbackUnit,
          price: priceValue,
          category: category || fallbackCategory,
          subcategory: finalSubcategory,
          type
        };

        // Если это работа, раскрываем нужную секцию
        if (type === 'work' && (category || fallbackCategory)) {
          setExpandedPriceSections(prevSections => ({
            ...prevSections,
            [`work-${category || fallbackCategory}`]: true
          }));
        }

        // Save new item to backend
        (async () => {
          try {
            const savedItem = await api.createPriceItem({
              name: newItem.name,
              unit: newItem.unit,
              price: newItem.price,
              category: newItem.category,
              subcategory: newItem.subcategory,
              type: newItem.type,
            });
            setPriceList(prev => prev.map(p => p.id === newItem.id ? savedItem : p));
          } catch (error) {
            console.error('Failed to save auto-added price item:', error);
          }
        })();

        // Save new item to backend
        (async () => {
          try {
            const savedItem = await api.createPriceItem({
              name: newItem.name,
              unit: newItem.unit,
              price: newItem.price,
              category: newItem.category,
              subcategory: newItem.subcategory,
              type: newItem.type,
            });
            setPriceList(prev => prev.map(p => p.id === newItem.id ? savedItem : p));
          } catch (error) {
            console.error('Failed to save auto-added price item:', error);
          }
        })();

        return [...prev, newItem];
      }

      // Обновляем существующую позицию (ед. изм., цену, категорию, подкатегорию)
      const updated = [...prev];
      const existing = updated[idx];
      
      // Для отделочных работ, если подкатегория не определена - ставим "Стены" по умолчанию
      let finalSubcategoryForUpdate = subcategory !== undefined ? subcategory : existing.subcategory;
      if (type === 'work' && (category === 'Черновые отделочные работы' || category === 'Чистовые отделочные работы' || existing.category === 'Черновые отделочные работы' || existing.category === 'Чистовые отделочные работы')) {
        if (!finalSubcategoryForUpdate) {
          finalSubcategoryForUpdate = 'Стены';
        }
      }
      
      updated[idx] = {
        ...existing,
        unit: unit && unit.trim() ? unit : existing.unit || fallbackUnit,
        price: priceValue > 0 ? priceValue : existing.price || 0,
        category: category || existing.category || fallbackCategory,
        subcategory: finalSubcategoryForUpdate
      };
      
      // Раскрываем нужную секцию для работ
      if (type === 'work' && (category || fallbackCategory)) {
        setExpandedPriceSections(prevSections => ({
          ...prevSections,
          [`work-${category || fallbackCategory}`]: true
        }));
      }
      
      return updated;
    });
  };

  // Прокрутка к элементу прайса и его подсветка
  const scrollToPriceItem = (item: PriceItem) => {
    // Раскрываем нужную секцию
    if (item.type === 'work') {
      setExpandedPriceSections(prev => ({ ...prev, [`work-${item.category}`]: true }));
    }
    
    // Закрываем поиск
    setPriceSearchQuery('');
    setPriceSearchFocused(false);
    
    // Подсвечиваем элемент
    setHighlightedPriceId(item.id);
    
    // Прокручиваем к элементу с небольшой задержкой для раскрытия секции
    setTimeout(() => {
      const element = document.getElementById(`price-item-${item.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    // Убираем подсветку через 3 секунды
    setTimeout(() => setHighlightedPriceId(null), 3000);
  };

  // Открыть модалку импорта для конкретной категории/подкатегории
  const openImportModal = (category: string, subcategory?: string) => {
    setImportCategory(category);
    setImportSubcategory(subcategory || '');
    setImportModalOpen(true);
  };

  // Обработка файла Excel
  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Пропускаем заголовок (первую строку)
      const rows = jsonData.slice(1);
      
      const newItems: PriceItem[] = [];
      rows.forEach((row, index) => {
        // Ожидаем формат: Наименование | Ед.изм | Цена
        const name = row[0]?.toString()?.trim();
        const unit = row[1]?.toString()?.trim() || 'шт';
        const price = parseFloat(row[2]) || 0;

        if (name) {
          newItems.push({
            id: `import-${Date.now()}-${index}`,
            name,
            unit,
            price,
            category: importCategory,
            subcategory: importSubcategory || undefined,
            type: 'work'
          });
        }
      });

      if (newItems.length > 0) {
        setPriceList(prev => [...prev, ...newItems]);
        setExpandedPriceSections(prev => ({ ...prev, [`work-${importCategory}`]: true }));
        alert(`Успешно импортировано ${newItems.length} позиций!`);
      } else {
        alert('Не найдено позиций для импорта. Проверьте формат файла.');
      }
    } catch (error) {
      console.error('Error importing Excel:', error);
      alert('Ошибка при чтении файла. Убедитесь, что это корректный Excel файл.');
    }

    // Сбрасываем input для возможности повторной загрузки того же файла
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setImportModalOpen(false);
  };

  const NavContent = () => (
    <>
      <div className="p-6 flex items-center border-b border-architect-100 dark:border-architect-700 min-h-[81px]">
          <div className="flex items-center gap-3 w-full">
            <Box className="w-8 h-8 text-architect-900 dark:text-white shrink-0" />
            <span className="font-bold text-xl tracking-tight dark:text-white whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">m7crm</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 text-architect-900 dark:text-white">
            <X className="w-6 h-6" />
          </button>
      </div>
      <nav className="flex-1 p-4 space-y-1 mt-4 overflow-y-auto">
          <button onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <LayoutDashboard className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Дашборд</span>
          </button>
          <button onClick={() => { setActiveTab('tasks'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'tasks' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <CheckSquare className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Задачи</span>
          </button>
          <button onClick={() => { setActiveTab('sales'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'sales' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <TrendingUp className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Продажи</span>
          </button>
          <button onClick={() => { setActiveTab('objects'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'objects' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <Building className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Объекты</span>
          </button>
          <button onClick={() => { setActiveTab('projects'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'projects' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <Folder className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Проекты</span>
          </button>
          <button onClick={() => { setActiveTab('executors'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'executors' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <Users className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Исполнители</span>
          </button>
          <button onClick={() => { setActiveTab('warehouse'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'warehouse' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <Warehouse className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Склад</span>
          </button>
          <button onClick={() => { setActiveTab('prices'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'prices' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <CreditCard className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Прайсы</span>
          </button>
          <button onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 shadow-lg' : 'text-architect-500 hover:bg-architect-50 dark:hover:bg-architect-700'}`}>
            <Settings className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Настройки</span>
          </button>
      </nav>
      <div className="p-4 border-t border-architect-100 dark:border-architect-700">
          <button onClick={() => { logout(); setState(AppState.LOGIN); }} className="w-full flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <LogOut className="w-5 h-5 shrink-0" /> 
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">Выйти</span>
          </button>
      </div>
    </>
  );

  // Проверяем наличие токена в localStorage ПЕРЕД всеми проверками
  // Это предотвращает мигание формы входа при обновлении страницы
  const savedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  // Если есть токен, но user еще не загружен, показываем загрузку (даже если isLoading false)
  // Это критично для предотвращения мигания формы входа
  if (savedToken && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-architect-50 dark:bg-architect-900">
        <Loader2 className="w-8 h-8 text-architect-900 dark:text-white animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-architect-50 dark:bg-architect-900">
        <Loader2 className="w-8 h-8 text-architect-900 dark:text-white animate-spin" />
      </div>
    );
  }

  // Show superadmin panel if logged in as superadmin
  if (isSuperadmin) {
    return <SuperAdminPanel onLogout={handleSuperadminLogout} />;
  }

  // Показываем страницу входа только если нет токена и нет пользователя
  if (state === AppState.LOGIN || (!user && !savedToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-architect-50 dark:bg-architect-900 p-4 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-architect-800 rounded-2xl shadow-2xl border border-architect-100 dark:border-architect-700 p-8 text-center">
            <div className="flex flex-col items-center mb-8">
                <div className="bg-architect-900 dark:bg-architect-100 p-3 rounded-xl mb-4"><Box className="w-8 h-8 text-white dark:text-architect-900" /></div>
                <h1 className="text-3xl font-bold text-architect-900 dark:text-white mb-1">m7crm</h1>
                <p className="text-architect-500 dark:text-architect-400 text-sm">
                  {showRegister ? 'Регистрация администратора' : 'Вход в систему управления проектами'}
                </p>
            </div>
            
            {showRegister ? (
              <>
                {registerError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-600 dark:text-red-400">{registerError}</p>
                  </div>
                )}
                <form onSubmit={handleRegister} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-architect-500 dark:text-architect-400 uppercase mb-1.5 ml-1">E-mail</label>
                    <input 
                      type="email" 
                      required 
                      value={registerData.email} 
                      onChange={e => { setRegisterData({ ...registerData, email: e.target.value }); setRegisterError(null); }} 
                      className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-xl outline-none dark:text-white text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-architect-500 dark:text-architect-400 uppercase mb-1.5 ml-1">Пароль</label>
                    <input 
                      type="password" 
                      required 
                      minLength={8}
                      value={registerData.password} 
                      onChange={e => { setRegisterData({ ...registerData, password: e.target.value }); setRegisterError(null); }} 
                      className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-xl outline-none dark:text-white text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-architect-500 dark:text-architect-400 uppercase mb-1.5 ml-1">Имя</label>
                    <input 
                      type="text" 
                      required 
                      value={registerData.name} 
                      onChange={e => { setRegisterData({ ...registerData, name: e.target.value }); setRegisterError(null); }} 
                      className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-xl outline-none dark:text-white text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-architect-500 dark:text-architect-400 uppercase mb-1.5 ml-1">Название организации</label>
                    <input 
                      type="text" 
                      required 
                      value={registerData.organizationName} 
                      onChange={e => { setRegisterData({ ...registerData, organizationName: e.target.value }); setRegisterError(null); }} 
                      className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-xl outline-none dark:text-white text-sm" 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isRegistering}
                    className="w-full bg-architect-900 dark:bg-white text-white dark:text-architect-900 font-bold py-3 rounded-xl hover:opacity-90 flex items-center justify-center gap-2 text-sm mt-4 disabled:opacity-50"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Регистрация...
                      </>
                    ) : (
                      <>
                        Зарегистрироваться <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowRegister(false); setRegisterError(null); }}
                    className="w-full text-architect-500 hover:text-architect-700 dark:hover:text-architect-300 text-sm mt-2"
                  >
                    Уже есть аккаунт? Войти
                  </button>
                </form>
              </>
            ) : (
              <>
                {loginError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>
                  </div>
                )}
                <form onSubmit={handleLogin} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-architect-500 dark:text-architect-400 uppercase mb-1.5 ml-1">E-mail</label>
                    <input 
                      type="text" 
                      required 
                      value={email} 
                      onChange={e => { setEmail(e.target.value); setLoginError(null); }} 
                      placeholder="email@example.com"
                      className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-xl outline-none dark:text-white text-sm" 
                    />
                    <p className="text-xs text-architect-400 dark:text-architect-500 mt-1 ml-1">
                      Введите email для входа
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-architect-500 dark:text-architect-400 uppercase mb-1.5 ml-1">Пароль</label>
                    <input 
                      type="password" 
                      required 
                      value={password} 
                      onChange={e => { setPassword(e.target.value); setLoginError(null); }} 
                      className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-xl outline-none dark:text-white text-sm" 
                    />
                  </div>
                  <button type="submit" className="w-full bg-architect-900 dark:bg-white text-white dark:text-architect-900 font-bold py-3 rounded-xl hover:opacity-90 flex items-center justify-center gap-2 text-sm mt-4">
                    Войти <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRegister(true)}
                    className="w-full text-architect-500 hover:text-architect-700 dark:hover:text-architect-300 text-sm mt-2"
                  >
                    Нет аккаунта? Зарегистрироваться
                  </button>
                </form>
              </>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-architect-50 dark:bg-architect-900 transition-colors overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-architect-800 shadow-2xl flex flex-col transition-transform duration-300 text-left">
            <NavContent />
          </div>
        </div>
      )}
      <aside className="hidden md:flex w-20 hover:w-64 transition-all duration-300 group overflow-hidden border-r border-architect-200 dark:border-architect-700 bg-white dark:bg-architect-800 flex-col sticky top-0 h-screen shrink-0 z-50 text-left">
        <NavContent />
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative text-left">
        <header className="bg-white dark:bg-architect-800 border-b border-architect-200 dark:border-architect-700 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shrink-0 text-left">
            <div className="flex items-center gap-3 text-left">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg text-architect-900 dark:text-white">
                  <Menu className="w-6 h-6" />
                </button>
                <div className="text-left">
                    <h2 className="font-bold text-lg text-architect-900 dark:text-white capitalize">
                      {activeTab === 'dashboard' ? 'Дашборд' : 
                       activeTab === 'tasks' ? 'Задачи' : 
                       activeTab === 'sales' ? 'Продажи' : 
                       activeTab === 'objects' ? 'Объекты' : 
                       activeTab === 'projects' ? 'Проекты' : 
                       activeTab === 'executors' ? 'Исполнители' : 
                       activeTab === 'warehouse' ? 'Склад' : 
                       activeTab === 'prices' ? 'Прайс-листы' : 
                       activeTab === 'settings' ? 'Настройки' : 'Главная'}
                    </h2>
                </div>
            </div>
            {state === AppState.VIEW_PROJECT && (
              <button onClick={() => setState(AppState.PROJECT_LIST)} className="text-xs font-bold text-architect-500 hover:text-architect-900 dark:hover:white flex items-center gap-1">
                <X className="w-4 h-4" /> Закрыть
              </button>
            )}
        </header>

        <section className="flex-1 overflow-y-auto p-4 md:p-8 text-left">
            {activeTab === 'dashboard' && (
                <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                    <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-lg border border-architect-100 dark:border-architect-700 p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-architect-900 dark:bg-architect-100 p-3 rounded-xl">
                                <LayoutDashboard className="w-8 h-8 text-white dark:text-architect-900" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-architect-900 dark:text-white">Дашборд</h1>
                                <p className="text-architect-500 dark:text-architect-400 text-sm">Панель управления и аналитика</p>
                            </div>
                        </div>
                        <div className="space-y-4 text-architect-700 dark:text-architect-300">
                            <p className="text-lg font-semibold text-architect-900 dark:text-white mb-4">В этом разделе будет отображаться:</p>
                            <ul className="space-y-3 list-disc list-inside">
                                <li><strong>Сводки по маркетингу</strong> - статистика по рекламным кампаниям, источникам лидов, конверсиям</li>
                                <li><strong>Лиды</strong> - количество новых лидов, в работе, конверсия в замеры</li>
                                <li><strong>Замеры</strong> - запланированные и выполненные замеры, конверсия в договоры</li>
                                <li><strong>Договоры</strong> - количество подписанных договоров, сумма сделок, средний чек</li>
                                <li><strong>Объекты в работе</strong> - текущие активные объекты, этапы выполнения, сроки</li>
                                <li><strong>Прибыль и расходы</strong> - финансовая аналитика, доходы, расходы, прибыльность</li>
                                <li><strong>Показатели работы сотрудников</strong> - KPI менеджеров, прорабов, мастеров</li>
                                <li><strong>Уведомления о нарушениях сроков</strong> - задачи с просрочкой, предупреждения о приближающихся дедлайнах</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'tasks' && (
                <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                    <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-lg border border-architect-100 dark:border-architect-700 p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-architect-900 dark:bg-architect-100 p-3 rounded-xl">
                                <CheckSquare className="w-8 h-8 text-white dark:text-architect-900" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-architect-900 dark:text-white">Задачи</h1>
                                <p className="text-architect-500 dark:text-architect-400 text-sm">Управление задачами в формате канбан</p>
                            </div>
                        </div>
                        <div className="space-y-4 text-architect-700 dark:text-architect-300">
                            <p className="text-lg font-semibold text-architect-900 dark:text-white mb-4">В этом разделе будет реализовано:</p>
                            <ul className="space-y-3 list-disc list-inside">
                                <li><strong>Канбан-доска с 3 столбцами:</strong>
                                    <ul className="ml-6 mt-2 space-y-2 list-disc">
                                        <li>Задачи на сегодня</li>
                                        <li>Задачи на завтра</li>
                                        <li>Задачи на неделю</li>
                                    </ul>
                                </li>
                                <li><strong>Карточки задач</strong> - с информацией о задаче, исполнителе, приоритете, статусе</li>
                                <li><strong>Перетаскивание задач</strong> - между столбцами для изменения сроков</li>
                                <li><strong>Фильтры и сортировка</strong> - по исполнителю, приоритету, типу задачи</li>
                                <li><strong>Уведомления</strong> - о просроченных задачах и приближающихся дедлайнах</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'sales' && (
                <div className="animate-in fade-in duration-300">
                    <DealsKanban hasPermission={hasPermission} />
                </div>
            )}
            {activeTab === 'objects' && (
                <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                    <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-lg border border-architect-100 dark:border-architect-700 p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-architect-900 dark:bg-architect-100 p-3 rounded-xl">
                                <Building className="w-8 h-8 text-white dark:text-architect-900" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-architect-900 dark:text-white">Объекты</h1>
                                <p className="text-architect-500 dark:text-architect-400 text-sm">Управление объектами в работе</p>
                            </div>
                        </div>
                        <div className="space-y-4 text-architect-700 dark:text-architect-300">
                            <p className="text-lg font-semibold text-architect-900 dark:text-white mb-4">В этом разделе будет реализовано:</p>
                            <ul className="space-y-3 list-disc list-inside">
                                <li><strong>Карточки объектов</strong> - с полной информацией о текущих объектах в работе</li>
                                <li><strong>График работ</strong> - календарный план выполнения работ, этапы, сроки</li>
                                <li><strong>Текущее состояние</strong> - статус объекта, процент выполнения, фотоотчеты</li>
                                <li><strong>Отчеты о выполненных работах</strong> - прорабы и мастера смогут добавлять:
                                    <ul className="ml-6 mt-2 space-y-2 list-disc">
                                        <li>Текстовые отчеты</li>
                                        <li>Фотоотчеты выполненных работ</li>
                                        <li>Информацию о затраченном времени</li>
                                    </ul>
                                </li>
                                <li><strong>Акты о выполненных работах</strong> - менеджер или прораб сможет формировать акты для клиента</li>
                                <li><strong>Команда объекта</strong> - назначенные прорабы, мастера, подрядчики</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'executors' && (
                <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                    <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-lg border border-architect-100 dark:border-architect-700 p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-architect-900 dark:bg-architect-100 p-3 rounded-xl">
                                <Users className="w-8 h-8 text-white dark:text-architect-900" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-architect-900 dark:text-white">Исполнители</h1>
                                <p className="text-architect-500 dark:text-architect-400 text-sm">Управление исполнителями работ</p>
                            </div>
                        </div>
                        <div className="space-y-4 text-architect-700 dark:text-architect-300">
                            <p className="text-lg font-semibold text-architect-900 dark:text-white mb-4">В этом разделе будет реализовано:</p>
                            <ul className="space-y-3 list-disc list-inside">
                                <li><strong>Таблица с карточками исполнителей</strong> - прорабы, мастера, подрядчики</li>
                                <li><strong>Информация о каждом исполнителе:</strong>
                                    <ul className="ml-6 mt-2 space-y-2 list-disc">
                                        <li>Контактные данные</li>
                                        <li>Специализация и навыки</li>
                                        <li>Текущие объекты и задачи</li>
                                        <li>История работы</li>
                                        <li>Рейтинг и отзывы</li>
                                    </ul>
                                </li>
                                <li><strong>Категории подрядчиков</strong> - потолочники, кондиционерщики, дизайнеры и т.д.</li>
                                <li><strong>Назначение на объекты</strong> - возможность назначить исполнителя на конкретный объект или задачу</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'warehouse' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Vertical menu */}
                        <aside className="w-full lg:w-80 space-y-6 shrink-0">
                            <div className="rounded-xl border border-architect-200 dark:border-architect-700 p-2 bg-white dark:bg-architect-800 shadow-sm overflow-hidden">
                                <nav className="space-y-1">
                                    <button
                                        onClick={() => { setWarehouseSubTab('purchase-requests'); localStorage.setItem('warehouseSubTab', 'purchase-requests'); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                            warehouseSubTab === 'purchase-requests'
                                                ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900'
                                                : 'text-architect-600 dark:text-architect-400 hover:bg-architect-50 dark:hover:bg-architect-700'
                                        }`}
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        <span>Заявки на закупку</span>
                                    </button>
                                    <button
                                        onClick={() => { setWarehouseSubTab('project-materials'); localStorage.setItem('warehouseSubTab', 'project-materials'); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                            warehouseSubTab === 'project-materials'
                                                ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900'
                                                : 'text-architect-600 dark:text-architect-400 hover:bg-architect-50 dark:hover:bg-architect-700'
                                        }`}
                                    >
                                        <Package2 className="w-4 h-4" />
                                        <span>Материалы на объектах</span>
                                    </button>
                                    <button
                                        onClick={() => { setWarehouseSubTab('tools'); localStorage.setItem('warehouseSubTab', 'tools'); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                            warehouseSubTab === 'tools'
                                                ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900'
                                                : 'text-architect-600 dark:text-architect-400 hover:bg-architect-50 dark:hover:bg-architect-700'
                                        }`}
                                    >
                                        <Wrench className="w-4 h-4" />
                                        <span>Инструменты</span>
                                    </button>
                                    <button
                                        onClick={() => { setWarehouseSubTab('returns'); localStorage.setItem('warehouseSubTab', 'returns'); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                            warehouseSubTab === 'returns'
                                                ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900'
                                                : 'text-architect-600 dark:text-architect-400 hover:bg-architect-50 dark:hover:bg-architect-700'
                                        }`}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        <span>Возвраты</span>
                                    </button>
                                    <button
                                        onClick={() => { setWarehouseSubTab('operations'); localStorage.setItem('warehouseSubTab', 'operations'); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                            warehouseSubTab === 'operations'
                                                ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900'
                                                : 'text-architect-600 dark:text-architect-400 hover:bg-architect-50 dark:hover:bg-architect-700'
                                        }`}
                                    >
                                        <History className="w-4 h-4" />
                                        <span>История операций</span>
                                    </button>
                                </nav>
                            </div>
                        </aside>
                        {/* Content area */}
                        <div className="flex-1">
                            <div className="bg-white dark:bg-architect-800 rounded-xl border border-architect-200 dark:border-architect-700 shadow-sm p-6">
                                {warehouseSubTab === 'purchase-requests' && (
                                    <div>
                                        <PurchaseRequestsList
                                            onSelectRequest={(request) => setSelectedPurchaseRequest(request)}
                                            onCreateNew={() => setShowPurchaseRequestForm(true)}
                                            hasPermission={hasPermission}
                                            refreshTrigger={warehouseRefreshTrigger}
                                        />
                                        {selectedPurchaseRequest && (
                                            <PurchaseRequestDetails
                                                request={selectedPurchaseRequest}
                                                onClose={() => setSelectedPurchaseRequest(null)}
                                                onUpdate={() => {
                                                    setSelectedPurchaseRequest(null);
                                                    setWarehouseRefreshTrigger(Date.now());
                                                }}
                                                hasPermission={hasPermission}
                                            />
                                        )}
                                        {showPurchaseRequestForm && (
                                            <PurchaseRequestForm
                                                onClose={() => setShowPurchaseRequestForm(false)}
                                                onSuccess={() => {
                                                    setShowPurchaseRequestForm(false);
                                                    setWarehouseRefreshTrigger(Date.now());
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                                {warehouseSubTab === 'project-materials' && (
                                    <div>
                                        {selectedProjectForMaterials ? (
                                            <ProjectMaterialsCard
                                                project={selectedProjectForMaterials}
                                                onClose={() => setSelectedProjectForMaterials(null)}
                                                onRefresh={() => setWarehouseRefreshTrigger(Date.now())}
                                                hasPermission={hasPermission}
                                            />
                                        ) : (
                                            <ProjectMaterialsList
                                                onSelectProject={(project) => setSelectedProjectForMaterials(project)}
                                                hasPermission={hasPermission}
                                                refreshTrigger={warehouseRefreshTrigger}
                                            />
                                        )}
                                    </div>
                                )}
                                {warehouseSubTab === 'tools' && (
                                    <div>
                                        <ToolsList
                                            onSelectTool={(tool) => setSelectedTool(tool)}
                                            onCreateNew={() => setShowToolForm(true)}
                                            onEditTool={(tool) => {
                                                setSelectedTool(tool);
                                                setShowToolForm(true);
                                            }}
                                            hasPermission={hasPermission}
                                            refreshTrigger={warehouseRefreshTrigger}
                                        />
                                        {selectedTool && !showToolForm && (
                                            <ToolDetails
                                                tool={selectedTool}
                                                onClose={() => setSelectedTool(null)}
                                                onUpdate={() => {
                                                    setSelectedTool(null);
                                                    setWarehouseRefreshTrigger(Date.now());
                                                }}
                                                hasPermission={hasPermission}
                                                onEdit={() => {
                                                    setShowToolForm(true);
                                                }}
                                            />
                                        )}
                                        {showToolForm && (
                                            <ToolForm
                                                initialData={selectedTool || undefined}
                                                onClose={() => {
                                                    setShowToolForm(false);
                                                    if (selectedTool) {
                                                        setSelectedTool(null);
                                                    }
                                                }}
                                                onSuccess={() => {
                                                    setShowToolForm(false);
                                                    setSelectedTool(null);
                                                    setWarehouseRefreshTrigger(Date.now());
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                                {warehouseSubTab === 'returns' && (
                                    <div>
                                        <ReturnsList
                                            onCreateNew={() => setShowReturnForm(true)}
                                            hasPermission={hasPermission}
                                            refreshTrigger={warehouseRefreshTrigger}
                                        />
                                        {showReturnForm && (
                                            <ReturnForm
                                                onClose={() => setShowReturnForm(false)}
                                                onSuccess={() => {
                                                    setShowReturnForm(false);
                                                    setWarehouseRefreshTrigger(Date.now());
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                                {warehouseSubTab === 'operations' && (
                                    <div>
                                        <OperationsList hasPermission={hasPermission} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'projects' && (
                <>
                    {state === AppState.PROJECT_LIST && (
                        <div className="animate-in fade-in duration-300 text-left">
                            <div className="flex items-center justify-between mb-8 text-left">
                                <div className="relative w-full max-w-md text-left">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-architect-400" />
                                    <input type="text" placeholder="Поиск по проектам..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl outline-none dark:text-white text-sm" />
                                </div>
                                <button onClick={() => setState(AppState.UPLOAD)} className="bg-architect-900 dark:bg-white text-white dark:text-architect-900 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                  <Plus className="w-4 h-4" /> Новый проект
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 text-left">
                                {projects.map(project => (
                                    <div key={project.id} onClick={() => selectProject(project)} className="group bg-white dark:bg-architect-800 rounded-2xl border border-architect-200 dark:border-architect-700 overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left">
                                        <div className="aspect-[16/10] bg-architect-100 dark:bg-architect-900 relative flex items-center justify-center overflow-hidden">
                                            {project.planPreview ? <img src={getImageUrl(project.planPreview) || project.planPreview} alt="Preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <ImageIcon className="w-12 h-12 text-architect-200" />}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                              <span className="text-white text-sm font-medium flex items-center gap-1">Открыть <ChevronRight className="w-4 h-4" /></span>
                                            </div>
                                        </div>
                                        <div className="p-4 text-left">
                                          <h3 className="font-bold text-architect-900 dark:text-white truncate mb-1 text-base">{project.name}</h3>
                                          <div className="flex items-center justify-between text-xs text-architect-400">
                                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                                            <span>{project.analysis?.totalAreaEstimate || '—'} м²</span>
                                          </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {state === AppState.UPLOAD && <PlanUploader onFileSelect={handleFileSelect} />}

                    {state === AppState.ANALYZING && (
                        <div className="flex flex-col items-center justify-center py-20 text-center mx-auto">
                            <Loader2 className="w-12 h-12 text-architect-800 dark:text-architect-100 animate-spin mb-4" />
                            <h3 className="text-2xl font-semibold text-architect-800 dark:text-architect-100">Анализ помещения...</h3>
                            <div className="w-full max-w-xs h-2 bg-architect-200 dark:bg-architect-700 rounded-full mt-6 overflow-hidden mx-auto">
                              <div className="h-full bg-architect-800 dark:bg-architect-100 transition-all duration-300" style={{ width: `${analysisProgress}%` }}></div>
                            </div>
                        </div>
                    )}

                    {state === AppState.VIEW_PROJECT && currentProject && (
                        <div className="flex flex-col lg:flex-row gap-8 relative text-left">
                            <aside className="w-full lg:w-80 space-y-6 shrink-0 text-left">
                                <div className="hidden lg:block rounded-xl border border-architect-200 dark:border-architect-700 p-2 bg-white dark:bg-architect-800 shadow-sm overflow-hidden text-left">
                                    <span className="block text-xs font-bold text-architect-500 uppercase tracking-widest mb-2 px-2">Исходный план</span>
                                    {currentProject.planPreview && <img src={getImageUrl(currentProject.planPreview) || currentProject.planPreview} alt="Original Plan" className="w-full rounded-lg" />}
                                </div>
                                
                                <div className="space-y-3 text-left">
                                    <div className="flex items-center justify-between px-1 text-left">
                                      <h4 className="font-bold dark:text-white text-sm uppercase tracking-wider text-architect-500">Помещения</h4>
                                      <button onClick={handleAddRoom} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Добавить
                                      </button>
                                    </div>
                                    <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide text-left">
                                        <div onClick={() => setSelectedRoom(null)} className={`relative flex-shrink-0 w-64 lg:w-full group p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-md ${selectedRoom === null ? 'border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-600' : 'border-architect-200 dark:border-architect-700 bg-white dark:bg-architect-800'}`}>
                                            <div className="flex items-center gap-3 mb-4 pr-10 text-left">
                                                <div className={`p-2 rounded-md ${selectedRoom === null ? 'bg-purple-100 dark:bg-purple-800 text-purple-700' : 'bg-architect-100 text-architect-500 dark:bg-architect-700'}`}>
                                                  <LayoutTemplate className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 text-left">
                                                  <h4 className={`font-bold text-xs truncate ${selectedRoom === null ? 'text-purple-900 dark:text-purple-100' : 'text-architect-800 dark:text-white'}`}>Паспорт объекта</h4>
                                                  <p className="text-[11px] text-architect-400">Общая смета | 3D макет</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 pr-2 overflow-hidden text-left">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-architect-600 dark:text-architect-400 whitespace-nowrap shrink-0"><Maximize2 className="w-3 h-3" /><span>{totals.area.toFixed(1)} <span className="opacity-60 font-normal">м²</span></span></div>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-architect-600 dark:text-architect-400 whitespace-nowrap shrink-0"><Ruler className="w-3 h-3" /><span>{totals.perimeter.toFixed(1)} <span className="opacity-60 font-normal">м</span></span></div>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-architect-600 dark:text-architect-400 whitespace-nowrap shrink-0"><ArrowUpToLine className="w-3 h-3" /><span>{currentProject.analysis?.ceilingHeight || '2.7'} <span className="opacity-60 font-normal">м</span></span></div>
                                            </div>
                                            <div className={`absolute bottom-4 right-4 transition-all duration-300 flex items-center justify-center ${selectedRoom === null ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 w-8 h-8 rounded-full shadow-lg scale-110' : 'text-architect-400 opacity-40 group-hover:opacity-100 group-hover:text-architect-900 dark:group-hover:text-white'}`}>
                                              <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                        {currentProject.analysis?.rooms.map(room => (
                                            <div key={room.id} onClick={() => setSelectedRoom(room)} className={`flex-shrink-0 w-64 lg:w-full relative rounded-xl border transition-all duration-300 group ${selectedRoom?.id === room.id ? 'border-architect-800 dark:border-white bg-white dark:bg-architect-700 shadow-lg ring-1 ring-architect-800 dark:ring-white' : 'border-architect-200 dark:border-architect-700 bg-white dark:bg-architect-800 hover:border-architect-300'}`}>
                                                <div className="p-4 cursor-pointer relative text-left">
                                                    <div className="flex justify-between items-start mb-2 pr-10 text-left">
                                                      <h4 className={`font-bold text-xs truncate ${selectedRoom?.id === room.id ? 'text-architect-900 dark:text-white' : 'text-architect-700 dark:text-architect-300'}`}>{room.name}</h4>
                                                    </div>
                                                    <p className="text-[11px] text-architect-500 line-clamp-2 mb-4 pr-10 leading-tight text-left">{room.description}</p>
                                                    <div className="flex items-center gap-x-2 pr-2 overflow-hidden text-left">
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-architect-600 dark:text-architect-400 whitespace-nowrap shrink-0"><Maximize2 className="w-3 h-3" /><span>{room.area || '0'} <span className="opacity-60 font-normal">м²</span></span></div>
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-architect-600 dark:text-architect-400 whitespace-nowrap shrink-0"><Ruler className="w-3 h-3" /><span>{room.perimeter || '0'} <span className="opacity-60 font-normal">м</span></span></div>
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-architect-600 dark:text-architect-400 whitespace-nowrap shrink-0"><Box className="w-3 h-3" /><span>{room.angles || '4'} <span className="opacity-60 font-normal">{getAnglesPlural(room.angles)}</span></span></div>
                                                    </div>
                                                    <div className={`absolute bottom-4 right-4 transition-all duration-300 flex items-center justify-center ${selectedRoom?.id === room.id ? 'bg-architect-900 dark:bg-white text-white dark:text-architect-900 w-8 h-8 rounded-full shadow-lg scale-110' : 'text-architect-400 opacity-40 group-hover:opacity-100 group-hover:text-architect-900 dark:group-hover:text-white'}`}>
                                                      <ArrowRight className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleDeleteProject} className="w-full flex items-center justify-center gap-2 mt-8 py-3 px-4 border border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 active:scale-95 text-left"><Trash2 className="w-4 h-4" /> Удалить проект</button>
                                </div>
                            </aside>

                            <div className="flex-1 space-y-8 animate-in fade-in duration-500 text-left">
                                {!selectedRoom ? (
                                    <>
                                        <div className="bg-white dark:bg-architect-800 rounded-2xl border border-architect-200 dark:border-architect-700 p-8 shadow-sm text-left">
                                            <div className="border-b border-architect-100 dark:border-architect-700 pb-5 mb-6 text-left">
                                                <div className="flex items-center gap-2 text-left">
                                                    <LayoutTemplate className="w-6 h-6 text-purple-500 shrink-0" />
                                                    <input 
                                                        type="text" 
                                                        value={currentProject.name} 
                                                        maxLength={60}
                                                        onChange={e => updateCurrentProject({name: e.target.value})} 
                                                        className="text-2xl font-bold dark:text-white bg-transparent outline-none border-b-2 border-transparent hover:border-architect-200 focus:border-purple-500 transition-colors flex-1 min-w-0" 
                                                        placeholder="Название проекта..."
                                                    />
                                                </div>
                                                <p className="text-architect-500 text-xs font-bold uppercase tracking-widest opacity-60 text-left mt-1">Паспорт объекта недвижимости</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                                <div className="space-y-6 text-left">
                                                    <div className="grid grid-cols-3 gap-4 text-left">
                                                        <div className="text-left"><label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2 text-left"><Maximize2 className="w-3.5 h-3.5" /> Площадь</label>
                                                            <div className="flex items-center gap-2"><div className="flex-1 px-3 py-3 bg-architect-100 dark:bg-architect-700/50 rounded-xl font-mono text-xs font-bold dark:text-white text-left">{totals.area.toFixed(1)}</div><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">м²</span></div>
                                                        </div>
                                                        <div className="text-left"><label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2 text-left"><Ruler className="w-3.5 h-3.5" /> Периметр</label>
                                                            <div className="flex items-center gap-2"><div className="flex-1 px-3 py-3 bg-architect-100 dark:bg-architect-700/50 rounded-xl font-mono text-xs font-bold dark:text-white text-left">{totals.perimeter.toFixed(1)}</div><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">м</span></div>
                                                        </div>
                                                        <div className="text-left"><label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2 text-left"><ArrowUpToLine className="w-3.5 h-3.5" /> Потолки</label>
                                                            <div className="flex items-center gap-2"><input type="text" value={currentProject.analysis?.ceilingHeight || ''} onChange={e => updateAnalysis({ceilingHeight: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full px-3 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl outline-none text-center text-xs font-bold dark:text-white" /><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">м</span></div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4 text-left">
                                                        <div className="text-left"><label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2 text-left"><DoorOpen className="w-3.5 h-3.5" /> Двери</label>
                                                            <div className="flex items-center gap-2 font-mono text-xs font-bold bg-architect-100 dark:bg-architect-700/50 px-3 py-3 rounded-xl dark:text-white">{totals.doors} <span className="text-[10px] font-normal uppercase opacity-60 ml-1">шт</span></div>
                                                        </div>
                                                        <div className="text-left"><label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2 text-left"><Layout className="w-3.5 h-3.5" /> Окна</label>
                                                            <div className="flex items-center gap-2 font-mono text-xs font-bold bg-architect-100 dark:bg-architect-700/50 px-3 py-3 rounded-xl dark:text-white">{totals.windows} <span className="text-[10px] font-normal uppercase opacity-60 ml-1">шт</span></div>
                                                        </div>
                                                        <div className="text-left"><label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2 text-left"><Box className="w-3.5 h-3.5" /> Стены</label>
                                                            <div className="flex items-center gap-2 font-mono text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 px-3 py-3 rounded-xl dark:text-white text-emerald-700 dark:text-emerald-400">{totals.wallArea.toFixed(1)} <span className="text-[10px] font-normal uppercase opacity-60 ml-1">м²</span></div>
                                                        </div>
                                                    </div>
                                                    <div className="text-left"><label className="block text-xs font-bold text-architect-500 uppercase mb-2">Описание объекта</label><textarea value={currentProject.analysis?.globalDescription || ''} onChange={e => updateAnalysis({globalDescription: e.target.value})} rows={4} className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl outline-none text-sm dark:text-white resize-none text-left" /></div>
                                                </div>
                                                <div className="space-y-6 text-left">
                                                    <label className="block text-xs font-bold text-architect-500 uppercase mb-2">Фотографии объекта ({(currentProject.analysis?.propertyPhotos || []).length}/6)</label>
                                                    <div className="grid grid-cols-3 gap-3 text-left">
                                                        {(currentProject.analysis?.propertyPhotos || []).map((photo, i) => (
                                                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden group border border-architect-200"><img src={getImageUrl(photo) || photo} alt="Prop" className="w-full h-full object-cover" /><button onClick={() => handleRemovePropertyPhoto(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button></div>
                                                        ))}
                                                        {(currentProject.analysis?.propertyPhotos?.length || 0) < 6 && (
                                                          <div className="relative aspect-square rounded-xl border-2 border-dashed border-architect-200 flex flex-col items-center justify-center text-architect-400 bg-architect-50 dark:bg-architect-900 cursor-pointer"><Camera className="w-5 h-5" /><input type="file" accept="image/*" className="absolute inset-0 opacity-0" onChange={e => e.target.files?.[0] && handleUploadPropertyPhoto(e.target.files[0])} /></div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Автозаполнение смет */}
                                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 shadow-sm overflow-hidden text-left">
                                            <div className="p-6">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="p-2 bg-purple-500 rounded-xl text-white">
                                                        <Sparkles className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-lg text-purple-900 dark:text-purple-100">Автозаполнение смет</h4>
                                                        <p className="text-xs text-purple-600 dark:text-purple-400">ИИ заполнит сметы всех комнат на основе параметров</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 uppercase mb-2">Состояние объекта</label>
                                                        <select 
                                                            value={propertyCondition} 
                                                            onChange={(e) => setPropertyCondition(e.target.value as PropertyCondition)}
                                                            className="w-full px-4 py-3 bg-white dark:bg-architect-800 border border-purple-200 dark:border-purple-700 rounded-xl outline-none text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
                                                        >
                                                            {PROPERTY_CONDITIONS.map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-[10px] text-purple-500 mt-1">{PROPERTY_CONDITIONS.find(c => c.id === propertyCondition)?.description}</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 uppercase mb-2">Тип ремонта</label>
                                                        <select 
                                                            value={renovationType} 
                                                            onChange={(e) => setRenovationType(e.target.value as RenovationType)}
                                                            className="w-full px-4 py-3 bg-white dark:bg-architect-800 border border-purple-200 dark:border-purple-700 rounded-xl outline-none text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
                                                        >
                                                            {RENOVATION_TYPES.map(t => (
                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-[10px] text-purple-500 mt-1">{RENOVATION_TYPES.find(t => t.id === renovationType)?.description}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        onClick={() => setShowEstimateConfirm(true)} 
                                                        disabled={isGeneratingEstimate || !currentProject?.analysis?.rooms?.length}
                                                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:cursor-not-allowed"
                                                    >
                                                        {isGeneratingEstimate ? (
                                                            <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</>
                                                        ) : (
                                                            <><Sparkles className="w-4 h-4" /> Сгенерировать сметы</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Общая смета по всем комнатам */}
                                        <div className="bg-white dark:bg-architect-800 rounded-2xl border border-architect-200 dark:border-architect-700 shadow-sm overflow-hidden text-left">
                                                    <button 
                                                      onClick={() => setIsGlobalEstimateExpanded(!isGlobalEstimateExpanded)}
                                                      className="w-full flex items-center justify-between p-6 hover:bg-architect-50 dark:hover:bg-architect-900/30 transition-colors text-left"
                                                    >
                                                      <div className="flex items-center gap-3 text-left">
                                                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-xl text-purple-600">
                                                          <Calculator className="w-5 h-5" />
                                                        </div>
                                                        <div className="text-left">
                                                            <h4 className="font-bold text-xl uppercase tracking-wide">Общая смета</h4>
                                                            <p className="text-xs text-architect-500">Суммарные данные по всем помещениям</p>
                                                        </div>
                                                      </div>
                                                      <div className="flex items-center gap-4">
                                                        <button
                                                          onClick={() => setShowExportModal(true)}
                                                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
                                                          title="Экспортировать смету"
                                                        >
                                                          <FileSpreadsheet className="w-4 h-4" />
                                                          <span className="hidden md:inline">Экспорт</span>
                                                        </button>
                                                        <div className="text-right hidden md:block">
                                                            <div className="text-xs text-architect-500">Итого</div>
                                                            <div className="text-lg font-bold text-purple-600">{calculateGlobalTotals().grandTotal.toLocaleString()} ₽</div>
                                                        </div>
                                                        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isGlobalEstimateExpanded ? 'rotate-180' : ''}`} />
                                                      </div>
                                                    </button>
                                                    
                                                    {isGlobalEstimateExpanded && (
                                                      <div className="animate-in fade-in slide-in-from-top-2 duration-300 p-6 pt-0 text-left">
                                                        {/* Итоговые суммы */}
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-architect-50 dark:bg-architect-900/50 rounded-xl">
                                                            <div className="text-center p-3 bg-white dark:bg-architect-800 rounded-lg">
                                                                <div className="text-xs font-bold text-architect-500 uppercase mb-1">Работы</div>
                                                                <div className="text-lg font-bold text-emerald-600">{calculateGlobalTotals().totalWork.toLocaleString()} ₽</div>
                                                            </div>
                                                            <div className="text-center p-3 bg-white dark:bg-architect-800 rounded-lg">
                                                                <div className="text-xs font-bold text-architect-500 uppercase mb-1">Черновые материалы</div>
                                                                <div className="text-lg font-bold text-amber-600">{calculateGlobalTotals().totalRough.toLocaleString()} ₽</div>
                                                            </div>
                                                            <div className="text-center p-3 bg-white dark:bg-architect-800 rounded-lg">
                                                                <div className="text-xs font-bold text-architect-500 uppercase mb-1">Чистовые материалы</div>
                                                                <div className="text-lg font-bold text-blue-600">{calculateGlobalTotals().totalFinish.toLocaleString()} ₽</div>
                                                            </div>
                                                            <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                                                                <div className="text-xs font-bold text-purple-500 uppercase mb-1">Общий итог</div>
                                                                <div className="text-xl font-bold text-purple-600">{calculateGlobalTotals().grandTotal.toLocaleString()} ₽</div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Разбивка по подгруппам работ */}
                                                        <div className="space-y-3 text-left">
                                                            {ALL_WORK_SECTIONS.map((sub, idx) => {
                                                                const isExpanded = !!expandedGlobalEstimateSections[sub];
                                                                const isRoughSection = ROUGH_WORK_SECTIONS.includes(sub);
                                                                const isGlobalOnlySection = GLOBAL_ONLY_SECTIONS.includes(sub);
                                                                const globalData = calculateGlobalEstimation();
                                                                const sectionData = globalData[sub] || { work: 0, rough: 0, finish: 0, items: [] };
                                                                const sectionTotal = sectionData.work + sectionData.rough + sectionData.finish;
                                                                
                                                                // Пропускаем пустые секции (кроме глобальных и секций "Прочие работы" и "Подключение оборудования" - их показываем всегда)
                                                                const alwaysShowSections = ["Прочие работы", "Подключение оборудования"];
                                                                if (sectionTotal === 0 && !isGlobalOnlySection && !alwaysShowSections.includes(sub)) return null;
                                                                
                                                                return (
                                                                    <div key={idx} className="border border-architect-100 dark:border-architect-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-architect-800 text-left">
                                                                        <button 
                                                                            onClick={() => setExpandedGlobalEstimateSections(prev => ({ ...prev, [sub]: !isExpanded }))} 
                                                                            className="w-full flex flex-col md:flex-row md:items-center md:justify-between px-4 py-4 bg-architect-50/50 dark:bg-architect-900/50 hover:bg-architect-100 dark:hover:bg-architect-800 transition-colors text-left"
                                                                        >
                                                                            <div className="flex items-center gap-3 mb-1.5 md:mb-0 text-left">
                                                                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                                <span className="text-sm font-bold text-architect-700 dark:text-architect-300">{sub}</span>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 pl-7 md:pl-0 text-[10px] md:text-xs font-bold text-left md:text-right">
                                                                              <span className="text-emerald-600">Работа = {sectionData.work.toLocaleString()}р.</span>
                                                                              {isRoughSection ? (
                                                                                  <span className="text-amber-600">Материалы = {sectionData.rough.toLocaleString()}р.</span>
                                                                              ) : (
                                                                                  <span className="text-blue-600">Материалы = {sectionData.finish.toLocaleString()}р.</span>
                                                                              )}
                                                                              <span className="text-purple-600 font-bold">Итого = {sectionTotal.toLocaleString()}р.</span>
                                                                            </div>
                                                                        </button>
                                                                        {isExpanded && (
                                                                            <div className="p-3 border-t border-architect-50 dark:border-architect-700 overflow-x-auto text-left">
                                                                                {/* Таблица работ и материалов */}
                                                                                <table className="w-full text-left text-xs min-w-[600px] mb-3">
                                                                                    <thead>
                                                                                        <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter text-left">
                                                                                            <th className="py-1 w-8 text-left">№</th>
                                                                                            <th className="py-1 text-left">Наименование</th>
                                                                                            <th className="py-1 w-16 text-left">Ед.изм</th>
                                                                                            <th className="py-1 w-16 text-right">Кол-во</th>
                                                                                            <th className="py-1 w-24 text-right">Цена</th>
                                                                                            <th className="py-1 w-24 text-right">Стоимость</th>
                                                                                            {isGlobalOnlySection && <th className="py-1 w-8"></th>}
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {/* Для отделочных работ группируем по подкатегориям */}
                                                                                        {SECTIONS_WITH_SUBCATEGORIES.includes(sub) ? (
                                                                                            <>
                                                                                                {FINISHING_SUBCATEGORIES.map((subcat) => {
                                                                                                    const subcatItems = sectionData.items.filter((item: any) => {
                                                                                                        if (item.subcategory) return item.subcategory === subcat;
                                                                                                        return inferSubcategoryFromName(item.name || '') === subcat;
                                                                                                    });
                                                                                                    if (subcatItems.length === 0) return null;
                                                                                                    let itemCounter = 0;
                                                                                                    return (
                                                                                                        <React.Fragment key={subcat}>
                                                                                                            <tr className="bg-architect-100/50 dark:bg-architect-900/50">
                                                                                                                <td colSpan={6} className="py-2 px-2">
                                                                                                                    <span className="text-xs font-bold text-architect-600 dark:text-architect-300">{subcat}</span>
                                                                                                                    <span className="text-[10px] text-architect-400 ml-2">({subcatItems.length})</span>
                                                                                                                </td>
                                                                                                            </tr>
                                                                                                            {subcatItems.map((item: any) => {
                                                                                                                itemCounter++;
                                                                                                                const isMaterial = item.type !== 'work';
                                                                                                                return (
                                                                                                                    <tr key={item.id} className={`border-b border-architect-50 dark:border-architect-900/50 ${item.type === 'work' ? '' : item.type === 'rough' ? 'bg-amber-50/30 dark:bg-amber-900/10' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}>
                                                                                                                        <td className="py-1 text-architect-400 text-left">{itemCounter}</td>
                                                                                                                        <td className="py-1 text-left">
                                                                                                                            <div className="flex items-center justify-between">
                                                                                                                                <span className={`font-medium ${item.type === 'work' ? 'text-emerald-700 dark:text-emerald-400' : item.type === 'rough' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                                                                                                                    {item.type !== 'work' && <span className="text-[10px] mr-1">└</span>}
                                                                                                                                    {item.name || '—'}
                                                                                                                                </span>
                                                                                                                                {isMaterial && (
                                                                                                                                    <div className="flex items-center gap-1 ml-2">
                                                                                                                                        <button
                                                                                                                                            onClick={(e) => {
                                                                                                                                                e.stopPropagation();
                                                                                                                                                setGlobalMaterialLinkItem({ name: item.name, unit: item.unit, type: item.type, supplierUrl: item.supplierUrl });
                                                                                                                                                setGlobalMaterialLinkUrl(item.supplierUrl || '');
                                                                                                                                                setShowGlobalMaterialLinkModal(true);
                                                                                                                                            }}
                                                                                                                                            className={`p-0.5 transition-all opacity-60 hover:opacity-100 ${item.supplierUrl ? 'text-blue-500 hover:text-blue-600' : 'text-architect-300 hover:text-architect-500'}`}
                                                                                                                                            title={item.supplierUrl ? `Ссылка: ${item.supplierUrl}` : 'Добавить ссылку'}
                                                                                                                                        >
                                                                                                                                            <ExternalLink className="w-3 h-3" />
                                                                                                                                        </button>
                                                                                                                                        {item.supplierUrl && (
                                                                                                                                            <button
                                                                                                                                                onClick={async (e) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                    setUpdatingGlobalMaterialId(item.id);
                                                                                                                                                    await handleRefreshGlobalMaterialPrice(item.name, item.unit, item.type, item.supplierUrl);
                                                                                                                                                    setUpdatingGlobalMaterialId(null);
                                                                                                                                                }}
                                                                                                                                                disabled={updatingGlobalMaterialId === item.id}
                                                                                                                                                className="p-0.5 text-emerald-500 hover:text-emerald-600 transition-all opacity-60 hover:opacity-100 disabled:opacity-30"
                                                                                                                                                title="Обновить цену во всех комнатах"
                                                                                                                                            >
                                                                                                                                                <RefreshCw className={`w-3 h-3 ${updatingGlobalMaterialId === item.id ? 'animate-spin' : ''}`} />
                                                                                                                                            </button>
                                                                                                                                        )}
                                                                                                                                    </div>
                                                                                                                                )}
                                                                                                                            </div>
                                                                                                                        </td>
                                                                                                                        <td className="py-1 text-architect-500 text-left">{item.unit}</td>
                                                                                                                        <td className="py-1 font-bold text-right">{item.quantity.toLocaleString()}</td>
                                                                                                                        <td className="py-1 text-architect-600 dark:text-architect-400 text-right">{item.price.toLocaleString()}</td>
                                                                                                                        <td className="py-1 font-bold text-architect-900 dark:text-white text-right">{(item.total || 0).toLocaleString()}</td>
                                                                                                                    </tr>
                                                                                                                );
                                                                                                            })}
                                                                                                        </React.Fragment>
                                                                                                    );
                                                                                                })}
                                                                                            </>
                                                                                        ) : isGlobalOnlySection ? (
                                                                                            /* Редактируемый рендеринг для глобальных секций (Умный дом, Накладные расходы) */
                                                                                            <>
                                                                                                {sectionData.items.map((item: any, i: number) => (
                                                                                                    <tr key={item.id} className="border-b border-architect-50 dark:border-architect-900/50 group/row hover:bg-architect-50/50 dark:hover:bg-architect-900/30">
                                                                                                        <td className="py-1 text-architect-400 text-left">{i + 1}</td>
                                                                                                        <td className="py-1 text-left relative">
                                                                                                            <input
                                                                                                                type="text"
                                                                                                                value={item.name || ''}
                                                                                                                onChange={(e) => {
                                                                                                                    handleUpdateGlobalSectionItem(sub, item.id, 'name', e.target.value);
                                                                                                                    if (e.target.value.length >= 2) {
                                                                                                                        setGlobalSectionActiveSearchId(item.id);
                                                                                                                    } else {
                                                                                                                        setGlobalSectionActiveSearchId(null);
                                                                                                                    }
                                                                                                                }}
                                                                                                                onFocus={() => item.name && item.name.length >= 2 && setGlobalSectionActiveSearchId(item.id)}
                                                                                                                placeholder="Введите название для поиска..."
                                                                                                                className="w-full bg-transparent outline-none text-xs text-emerald-700 dark:text-emerald-400 font-medium"
                                                                                                            />
                                                                                                            {/* Выпадающий список из справочника */}
                                                                                                            {globalSectionActiveSearchId === item.id && (
                                                                                                                <div className="absolute left-0 top-full z-50 w-80 max-h-48 overflow-y-auto bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-600 rounded-lg shadow-xl">
                                                                                                                    {priceList
                                                                                                                        .filter(p => p.category === sub && p.name.toLowerCase().includes((item.name || '').toLowerCase()))
                                                                                                                        .slice(0, 10)
                                                                                                                        .map(p => (
                                                                                                                            <button
                                                                                                                                key={p.id}
                                                                                                                                onClick={() => handleSelectFromDictionaryForGlobalSection(sub, item.id, p.name)}
                                                                                                                                className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/30 flex justify-between items-center"
                                                                                                                            >
                                                                                                                                <span className="font-medium text-architect-700 dark:text-architect-300">{p.name}</span>
                                                                                                                                <span className="text-architect-400">{p.price}₽/{p.unit}</span>
                                                                                                                            </button>
                                                                                                                        ))
                                                                                                                    }
                                                                                                                    {priceList.filter(p => p.category === sub && p.name.toLowerCase().includes((item.name || '').toLowerCase())).length === 0 && (
                                                                                                                        <div className="px-3 py-2 text-xs text-architect-400">Нет позиций в справочнике</div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </td>
                                                                                                        <td className="py-1 text-left">
                                                                                                            <input
                                                                                                                type="text"
                                                                                                                value={item.unit || 'шт'}
                                                                                                                onChange={(e) => handleUpdateGlobalSectionItem(sub, item.id, 'unit', e.target.value)}
                                                                                                                className="w-full bg-transparent outline-none text-xs text-architect-500"
                                                                                                            />
                                                                                                        </td>
                                                                                                        <td className="py-1 text-right">
                                                                                                            <input
                                                                                                                type="number"
                                                                                                                value={item.quantity || 0}
                                                                                                                onChange={(e) => handleUpdateGlobalSectionItem(sub, item.id, 'quantity', Number(e.target.value))}
                                                                                                                className="w-full bg-transparent outline-none text-xs font-bold text-right"
                                                                                                            />
                                                                                                        </td>
                                                                                                        <td className="py-1 text-right">
                                                                                                            <input
                                                                                                                type="number"
                                                                                                                value={item.price || 0}
                                                                                                                onChange={(e) => handleUpdateGlobalSectionItem(sub, item.id, 'price', Number(e.target.value))}
                                                                                                                className="w-full bg-transparent outline-none text-xs text-architect-600 dark:text-architect-400 text-right"
                                                                                                            />
                                                                                                        </td>
                                                                                                        <td className="py-1 font-bold text-architect-900 dark:text-white text-right">{(item.total || 0).toLocaleString()}</td>
                                                                                                        <td className="py-1 w-8 text-center">
                                                                                                            <button
                                                                                                                onClick={() => handleDeleteGlobalSectionItem(sub, item.id)}
                                                                                                                className="p-1 text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover/row:opacity-100"
                                                                                                                title="Удалить"
                                                                                                            >
                                                                                                                <Trash2 className="w-3 h-3" />
                                                                                                            </button>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                                {sectionData.items.length === 0 && (
                                                                                                    <tr>
                                                                                                        <td colSpan={7} className="py-4 text-center text-architect-400 text-xs">
                                                                                                            Нет позиций. Нажмите "Добавить" чтобы создать.
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                )}
                                                                                            </>
                                                                                        ) : (
                                                                                            /* Обычный рендеринг для остальных секций */
                                                                                            sectionData.items.map((item: any, i: number) => {
                                                                                                const isMaterial = item.type !== 'work';
                                                                                                return (
                                                                                                    <tr key={item.id} className={`border-b border-architect-50 dark:border-architect-900/50 ${item.type === 'work' ? '' : item.type === 'rough' ? 'bg-amber-50/30 dark:bg-amber-900/10' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}>
                                                                                                        <td className="py-1 text-architect-400 text-left">{i + 1}</td>
                                                                                                        <td className="py-1 text-left">
                                                                                                            <div className="flex items-center justify-between">
                                                                                                                <span className={`font-medium ${item.type === 'work' ? 'text-emerald-700 dark:text-emerald-400' : item.type === 'rough' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                                                                                                    {item.type !== 'work' && <span className="text-[10px] mr-1">└</span>}
                                                                                                                    {item.name || '—'}
                                                                                                                </span>
                                                                                                                {isMaterial && (
                                                                                                                    <div className="flex items-center gap-1 ml-2">
                                                                                                                        <button
                                                                                                                            onClick={(e) => {
                                                                                                                                e.stopPropagation();
                                                                                                                                setGlobalMaterialLinkItem({ name: item.name, unit: item.unit, type: item.type, supplierUrl: item.supplierUrl });
                                                                                                                                setGlobalMaterialLinkUrl(item.supplierUrl || '');
                                                                                                                                setShowGlobalMaterialLinkModal(true);
                                                                                                                            }}
                                                                                                                            className={`p-0.5 transition-all opacity-60 hover:opacity-100 ${item.supplierUrl ? 'text-blue-500 hover:text-blue-600' : 'text-architect-300 hover:text-architect-500'}`}
                                                                                                                            title={item.supplierUrl ? `Ссылка: ${item.supplierUrl}` : 'Добавить ссылку'}
                                                                                                                        >
                                                                                                                            <ExternalLink className="w-3 h-3" />
                                                                                                                        </button>
                                                                                                                        {item.supplierUrl && (
                                                                                                                            <button
                                                                                                                                onClick={async (e) => {
                                                                                                                                    e.stopPropagation();
                                                                                                                                    setUpdatingGlobalMaterialId(item.id);
                                                                                                                                    await handleRefreshGlobalMaterialPrice(item.name, item.unit, item.type, item.supplierUrl);
                                                                                                                                    setUpdatingGlobalMaterialId(null);
                                                                                                                                }}
                                                                                                                                disabled={updatingGlobalMaterialId === item.id}
                                                                                                                                className="p-0.5 text-emerald-500 hover:text-emerald-600 transition-all opacity-60 hover:opacity-100 disabled:opacity-30"
                                                                                                                                title="Обновить цену во всех комнатах"
                                                                                                                            >
                                                                                                                                <RefreshCw className={`w-3 h-3 ${updatingGlobalMaterialId === item.id ? 'animate-spin' : ''}`} />
                                                                                                                            </button>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        </td>
                                                                                                        <td className="py-1 text-architect-500 text-left">{item.unit}</td>
                                                                                                        <td className="py-1 font-bold text-right">{item.quantity.toLocaleString()}</td>
                                                                                                        <td className="py-1 text-architect-600 dark:text-architect-400 text-right">{item.price.toLocaleString()}</td>
                                                                                                        <td className="py-1 font-bold text-architect-900 dark:text-white text-right">{(item.total || 0).toLocaleString()}</td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })
                                                                                        )}
                                                                                    </tbody>
                                                                                </table>
                                                                                
                                                                                {/* Кнопка добавления для глобальных секций */}
                                                                                {isGlobalOnlySection && (
                                                                                    <button
                                                                                        onClick={() => handleAddGlobalSectionItem(sub)}
                                                                                        className="w-full py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-dashed border-emerald-300 dark:border-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-2 mb-3"
                                                                                    >
                                                                                        <Plus className="w-3 h-3" /> Добавить позицию
                                                                                    </button>
                                                                                )}
                                                                                
                                                                                {/* Итоги по разделу */}
                                                                                <div className={`grid ${isGlobalOnlySection ? 'grid-cols-1' : 'grid-cols-3'} gap-3 text-center mt-3 pt-3 border-t border-architect-100 dark:border-architect-700`}>
                                                                                    {!isGlobalOnlySection && (
                                                                                        <>
                                                                                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                                                                                <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Работы</div>
                                                                                                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">{sectionData.work.toLocaleString()} ₽</div>
                                                                                            </div>
                                                                                            {isRoughSection ? (
                                                                                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                                                                                    <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">Черновые материалы</div>
                                                                                                    <div className="text-base font-bold text-amber-700 dark:text-amber-400">{sectionData.rough.toLocaleString()} ₽</div>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                                                                    <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">Чистовые материалы</div>
                                                                                                    <div className="text-base font-bold text-blue-700 dark:text-blue-400">{sectionData.finish.toLocaleString()} ₽</div>
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                                                                        <div className="text-[10px] font-bold text-purple-600 uppercase mb-1">Итого по разделу</div>
                                                                                        <div className="text-base font-bold text-purple-700 dark:text-purple-400">{sectionTotal.toLocaleString()} ₽</div>
                                                                                    </div>
                                                                                </div>
                                                                                <p className="text-[10px] text-architect-400 mt-2 text-center">
                                                                                    {isGlobalOnlySection 
                                                                                        ? 'Эти работы относятся ко всему объекту, а не к конкретным комнатам.' 
                                                                                        : 'Данные суммированы со всех помещений проекта. Одинаковые позиции объединены.'}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        
                                                        {calculateGlobalTotals().grandTotal === 0 && (
                                                            <div className="text-center py-8 text-architect-400">
                                                                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                                <p className="text-sm font-medium">Сметы по комнатам ещё не заполнены</p>
                                                                <p className="text-xs mt-1">Добавьте работы и материалы в сметы отдельных помещений</p>
                                                            </div>
                                                        )}
                                                      </div>
                                                    )}
                                        </div>
                                        
                                        {/* 3D Изометрическая визуализация */}
                                        <div className="space-y-4 text-left">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
                                              <h3 className="text-xl font-bold dark:text-white">3D Изометрическая визуализация</h3>
                                              <div className="flex items-center gap-3">
                                                  {/* Архитектурный стиль */}
                                                  <div className="flex items-center gap-2 relative">
                                                      <div className="relative">
                                                          <button onMouseEnter={() => setShowStyleTooltip(true)} onMouseLeave={() => setShowStyleTooltip(false)} className="text-architect-400 hover:text-architect-800 dark:hover:text-white transition-colors">
                                                              <CircleHelp className="w-4 h-4" />
                                                          </button>
                                                          {showStyleTooltip && (
                                                              <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-architect-900 text-white text-[12px] rounded-xl shadow-2xl z-50 text-left">
                                                                  <p className="font-bold border-b border-white/20 pb-1 mb-2">{currentProject.analysis?.architecturalStyle}</p>
                                                                  <p className="leading-relaxed opacity-90">{STYLE_DESCRIPTIONS[currentProject.analysis?.architecturalStyle || 'Современный']}</p>
                                                              </div>
                                                          )}
                                                      </div>
                                                      <select value={currentProject.analysis?.architecturalStyle || ''} onChange={(e) => handleUpdateStyle(e.target.value)} className="px-3 py-2 text-sm border border-architect-300 dark:border-architect-600 rounded-lg bg-architect-50 dark:bg-architect-900 text-architect-900 dark:text-white outline-none min-w-[150px]">
                                                          {PREDEFINED_STYLES.map(style => (<option key={style} value={style}>{style}</option>))}
                                                      </select>
                                                      <div className="w-10 h-10 shrink-0 bg-architect-50 dark:bg-architect-900 rounded-lg border border-architect-300 dark:border-architect-600 flex items-center justify-center cursor-pointer relative group overflow-hidden" title="Загрузить референс стиля">
                                                          {isDetectingStyle ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : currentProject.analysis?.styleReferenceImage ? <img src={currentProject.analysis.styleReferenceImage} alt="Ref" className="w-full h-full object-cover" /> : <ImagePlus className="w-5 h-5 text-architect-400" />}
                                                          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleStyleImageUpload(e.target.files[0])} />
                                                      </div>
                                                  </div>
                                                  <button onClick={handleGenerateGlobal} disabled={isGeneratingGlobal} className="bg-architect-900 dark:bg-white text-white dark:text-architect-900 px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all whitespace-nowrap">{isGeneratingGlobal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />} Сгенерировать макет</button>
                                              </div>
                                            </div>
                                            <div className="space-y-4">
                                                {/* Основное изображение (последнее сгенерированное) */}
                                                <div className="bg-white dark:bg-architect-800 rounded-[32px] border border-architect-200 dark:border-architect-700 p-2 min-h-[400px] flex items-center justify-center relative overflow-hidden text-left">
                                                    {isGeneratingGlobal ? (
                                                        <GenerationLoader planUrl={currentProject.planPreview || null} label="Создаем 3D модель..." />
                                                    ) : currentProject.global3DImages && currentProject.global3DImages.length > 0 ? (
                                                        <img 
                                                            src={getImageUrl(currentProject.global3DImages[0]) || currentProject.global3DImages[0]} 
                                                            alt="Global 3D" 
                                                            className="w-full h-auto rounded-[24px]" 
                                                        />
                                                    ) : (
                                                        <div className="text-architect-300 flex flex-col items-center">
                                                            <ImageIcon className="w-20 h-20 mb-2 opacity-20" />
                                                            <p className="text-xs font-bold uppercase tracking-widest opacity-40">Макет еще не создан</p>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Сетка предыдущих изображений (6 колонок) */}
                                                {currentProject.global3DImages && currentProject.global3DImages.length > 1 && (
                                                    <div>
                                                        <h4 className="text-sm font-bold text-architect-500 uppercase mb-2">История генераций</h4>
                                                        <div className="grid grid-cols-6 gap-2">
                                                            {currentProject.global3DImages.slice(1).map((imageUrl, index) => (
                                                                <div 
                                                                    key={index} 
                                                                    className="aspect-square rounded-xl overflow-hidden border border-architect-200 dark:border-architect-700 cursor-pointer hover:opacity-80 hover:border-architect-400 transition-all group relative"
                                                                    onClick={() => {
                                                                        // При клике переместить изображение в начало
                                                                        const newImages = [
                                                                            imageUrl, 
                                                                            ...currentProject.global3DImages!.filter((_, i) => i !== index + 1)
                                                                        ];
                                                                        updateCurrentProject({ global3DImages: newImages });
                                                                        api.updateProject(currentProject.id, { global3dImages: newImages });
                                                                    }}
                                                                >
                                                                    <img 
                                                                        src={getImageUrl(imageUrl) || imageUrl} 
                                                                        alt={`Previous ${index + 1}`} 
                                                                        className="w-full h-full object-cover" 
                                                                    />
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteGlobal3DImage(index + 1);
                                                                        }}
                                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                                                                        title="Удалить изображение"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="animate-in fade-in duration-500 space-y-8 text-left">
                                        <div className="bg-white dark:bg-architect-800 rounded-2xl border border-architect-200 dark:border-architect-700 p-8 shadow-sm text-left">
                                            <div className="flex justify-between items-center border-b border-architect-100 dark:border-architect-700 pb-5 mb-6 text-left">
                                                <div className="text-left">
                                                  <h2 className="text-2xl font-bold dark:text-white mb-1 flex items-center gap-3 text-left">
                                                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-xl text-purple-600"><FileImage className="w-5 h-5" /></div> Комната: {selectedRoom.name}
                                                  </h2>
                                                  <p className="text-architect-500 text-xs font-bold uppercase tracking-widest opacity-60 text-left">Параметры помещения</p>
                                                </div>
                                                <button onClick={() => handleDeleteRoom(selectedRoom.id)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"><Trash2 className="w-4 h-4" /> Удалить</button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                                <div className="space-y-6 text-left">
                                                    <div className="text-left"><label className="block text-xs font-bold text-architect-500 uppercase mb-2">Название</label><input type="text" value={selectedRoom.name} onChange={e => handleUpdateRoom({...selectedRoom, name: e.target.value})} className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl outline-none dark:text-white text-left" /></div>
                                                    <div className="grid grid-cols-3 gap-4 text-left">
                                                        <div className="text-left">
                                                            <label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2"><Maximize2 className="w-3.5 h-3.5" /> Площадь</label>
                                                            <div className="flex items-center gap-2"><input type="text" value={selectedRoom.area || ''} onChange={e => handleUpdateRoom({...selectedRoom, area: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full px-3 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl text-center text-sm font-bold dark:text-white text-left" /><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">м²</span></div>
                                                        </div>
                                                        <div className="text-left">
                                                            <label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2"><Ruler className="w-3.5 h-3.5" /> Периметр</label>
                                                            <div className="flex items-center gap-2"><input type="text" value={selectedRoom.perimeter || ''} onChange={e => updateRoomParam(selectedRoom, 'perimeter', e.target.value.replace(/[^0-9.]/g, ''))} className="w-full px-3 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl text-center text-sm font-bold dark:text-white text-left" /><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">м</span></div>
                                                        </div>
                                                        <div className="text-left">
                                                            <label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2"><Hash className="w-3.5 h-3.5" /> Углы</label>
                                                            <div className="flex items-center gap-2"><input type="text" value={selectedRoom.angles || ''} onChange={e => handleUpdateRoom({...selectedRoom, angles: e.target.value.replace(/[^0-9]/g, '')})} className="w-full px-3 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl text-center text-sm font-bold dark:text-white text-left" /><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">{getAnglesPlural(selectedRoom.angles)}</span></div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4 text-left">
                                                        <div className="text-left">
                                                            <label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2"><DoorOpen className="w-3.5 h-3.5" /> Двери</label>
                                                            <div className="flex items-center gap-2"><input type="text" value={selectedRoom.doors || ''} onChange={e => updateRoomParam(selectedRoom, 'doors', e.target.value.replace(/[^0-9]/g, ''))} className="w-full px-3 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl text-center text-sm font-bold dark:text-white text-left" /><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">шт</span></div>
                                                        </div>
                                                        <div className="text-left">
                                                            <label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2"><Layout className="w-3.5 h-3.5" /> Окна</label>
                                                            <div className="flex items-center gap-2"><input type="text" value={selectedRoom.windows || ''} onChange={e => updateRoomParam(selectedRoom, 'windows', e.target.value.replace(/[^0-9]/g, ''))} className="w-full px-3 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl text-center text-sm font-bold dark:text-white text-left" /><span className="text-[10px] font-bold text-architect-400 uppercase shrink-0">шт</span></div>
                                                        </div>
                                                        <div className="text-left">
                                                            <label className="flex items-center gap-1.5 text-xs font-bold text-architect-500 uppercase mb-2 text-emerald-600 dark:text-emerald-400"><Box className="w-3.5 h-3.5" /> Стены</label>
                                                            <div className="flex items-center gap-2 text-left">
                                                                <input 
                                                                    type="text" 
                                                                    value={selectedRoom.wallArea || ''} 
                                                                    onChange={e => handleUpdateRoom({...selectedRoom, wallArea: e.target.value.replace(/[^0-9.]/g, '')})} 
                                                                    className="w-full px-3 py-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-center text-sm font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-left"
                                                                />
                                                                <span className="text-[10px] font-bold text-architect-400 uppercase shrink-0 ml-1">м²</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-left"><label className="block text-xs font-bold text-architect-500 uppercase mb-2">Описание</label><textarea value={selectedRoom.description} onChange={e => handleUpdateRoom({...selectedRoom, description: e.target.value})} rows={3} className="w-full px-4 py-3 bg-architect-50 dark:bg-architect-900 border border-architect-200 rounded-xl outline-none text-sm dark:text-white resize-none text-left" /></div>
                                                </div>
                                                <div className="space-y-6 text-left">
                                                    <label className="block text-xs font-bold text-architect-500 uppercase mb-2">Фотографии комнаты ({(selectedRoom.realPhotos || []).length}/5)</label>
                                                    <div className="grid grid-cols-3 gap-3 text-left">
                                                        {(selectedRoom.realPhotos || []).map((photo, i) => (
                                                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden group border border-architect-200"><img src={photo} alt="Room" className="w-full h-full object-cover" /><button onClick={() => handleRemoveRoomPhoto(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button></div>
                                                        ))}
                                                        {(selectedRoom.realPhotos?.length || 0) < 5 && (
                                                          <div className="relative aspect-square rounded-xl border-2 border-dashed border-architect-200 flex flex-col items-center justify-center text-architect-400 bg-architect-50 dark:bg-architect-900 cursor-pointer"><Camera className="w-5 h-5" /><input type="file" accept="image/*" className="absolute inset-0 opacity-0" onChange={e => e.target.files?.[0] && handleUploadRoomPhoto(e.target.files[0])} /></div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-architect-800 rounded-2xl border border-architect-200 dark:border-architect-700 p-8 shadow-sm text-left">
                                            <div className="space-y-8 text-left">
                                                <div className="text-left">
                                                    <div className="flex items-center justify-between mb-4">
                                                    <button 
                                                      onClick={() => setIsWorksExpanded(!isWorksExpanded)}
                                                        className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 hover:opacity-80 transition-opacity text-left"
                                                    >
                                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-xl text-emerald-600">
                                                          <Calculator className="w-5 h-5" />
                                                        </div>
                                                        <h4 className="font-bold text-xl uppercase tracking-wide">Смета помещения</h4>
                                                        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isWorksExpanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                      
                                                      {/* Кнопка голосового ввода */}
                                                      <button
                                                        onMouseDown={(e) => {
                                                          e.preventDefault();
                                                          if (!isProcessingVoice && !isRecording) {
                                                            startVoiceRecording();
                                                          }
                                                        }}
                                                        onMouseUp={(e) => {
                                                          e.preventDefault();
                                                          if (isRecording) {
                                                            stopVoiceRecording();
                                                          }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                          // Останавливаем только если кнопка была нажата
                                                          if (isRecording && e.buttons === 0) {
                                                            stopVoiceRecording();
                                                          }
                                                        }}
                                                        onTouchStart={(e) => {
                                                          e.preventDefault();
                                                          if (!isProcessingVoice && !isRecording) {
                                                            startVoiceRecording();
                                                          }
                                                        }}
                                                        onTouchEnd={(e) => {
                                                          e.preventDefault();
                                                          if (isRecording) {
                                                            stopVoiceRecording();
                                                          }
                                                        }}
                                                        onTouchCancel={(e) => {
                                                          e.preventDefault();
                                                          if (isRecording) {
                                                            stopVoiceRecording();
                                                          }
                                                        }}
                                                        disabled={isProcessingVoice}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 select-none ${
                                                          isRecording 
                                                            ? 'bg-red-500 text-white animate-pulse' 
                                                            : isProcessingVoice
                                                              ? 'bg-purple-400 text-white cursor-wait'
                                                              : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900'
                                                        }`}
                                                        title="Удерживайте и говорите для добавления позиций"
                                                      >
                                                        {isProcessingVoice ? (
                                                          <><Loader2 className="w-4 h-4 animate-spin" /> Обработка...</>
                                                        ) : isRecording ? (
                                                          <><MicOff className="w-4 h-4" /> Отпустите...</>
                                                        ) : (
                                                          <><Mic className="w-4 h-4" /> Голосом</>
                                                        )}
                                                      </button>
                                                    </div>
                                                    
                                                    {/* Показываем транскрипт во время записи */}
                                                    {(isRecording || voiceTranscript) && (
                                                      <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-800">
                                                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm">
                                                          {isRecording && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                                                          <span className="font-medium">{isRecording ? 'Слушаю...' : 'Распознано:'}</span>
                                                        </div>
                                                        <p className="text-sm text-architect-700 dark:text-architect-300 mt-1">
                                                          {voiceTranscript || 'Говорите...'}
                                                        </p>
                                                      </div>
                                                    )}
                                                    
                                                    {isWorksExpanded && (
                                                      <div className="animate-in fade-in slide-in-from-top-2 duration-300 text-left">
                                                        <div className="space-y-3 text-left">
                                                            {WORK_SUBSECTIONS.map((sub, idx) => {
                                                                const isExpanded = !!expandedEstimateSections[sub];
                                                                const isRoughSection = ROUGH_WORK_SECTIONS.includes(sub);
                                                                const section = selectedRoom.estimation?.works?.[sub] || { items: [] };
                                                                const items = section.items || [];
                                                                const subtotalWork = calculateSubtotalByType(items, 'work');
                                                                const subtotalRough = calculateSubtotalByType(items, 'rough');
                                                                const subtotalFinish = calculateSubtotalByType(items, 'finish');
                                                                
                                                                return (
                                                                    <div key={idx} className="border border-architect-100 dark:border-architect-700 rounded-xl shadow-sm bg-white dark:bg-architect-800 text-left">
                                                                        <button 
                                                                            onClick={() => setExpandedEstimateSections(prev => ({ ...prev, [sub]: !isExpanded }))} 
                                                                            className="w-full flex flex-col md:flex-row md:items-center md:justify-between px-4 py-4 bg-architect-50/50 dark:bg-architect-900/50 hover:bg-architect-100 dark:hover:bg-architect-800 transition-colors text-left rounded-t-xl"
                                                                        >
                                                                            <div className="flex items-center gap-3 mb-1.5 md:mb-0 text-left">
                                                                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                                <span className="text-sm font-bold text-architect-700 dark:text-architect-300">{sub}</span>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 pl-7 md:pl-0 text-[10px] md:text-xs font-bold text-left md:text-right">
                                                                              <span className="text-emerald-600">Работа = {subtotalWork.toLocaleString()}р.,</span>
                                                                              {isRoughSection ? (
                                                                                  <span className="text-amber-600">Материалы = {subtotalRough.toLocaleString()}р.</span>
                                                                              ) : (
                                                                                  <span className="text-blue-600">Материалы = {subtotalFinish.toLocaleString()}р.</span>
                                                                              )}
                                                                            </div>
                                                                        </button>
                                                                        {isExpanded && (
                                                                            <div className="px-3 py-2 border-t border-architect-50 dark:border-architect-700 text-left" style={{ overflow: 'visible', position: 'relative', zIndex: 1 }}>
                                                                                {/* Для отделочных работ показываем подразделы без сворачивания */}
                                                                                {SECTIONS_WITH_SUBCATEGORIES.includes(sub) ? (
                                                                                    <table className="w-full text-left text-xs" style={{ overflow: 'visible' }}>
                                                                                        <thead>
                                                                                            <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter text-left text-[10px]">
                                                                                                <th className="py-0.5 w-6 text-left">№</th>
                                                                                                <th className="py-0.5 text-left">Наименование</th>
                                                                                                <th className="py-0.5 w-14 text-left">Ед.изм</th>
                                                                                                <th className="py-0.5 w-14 text-left">Кол-во</th>
                                                                                                <th className="py-0.5 w-16 text-left">Цена</th>
                                                                                                <th className="py-0.5 w-20 text-left">Стоимость</th>
                                                                                                <th className="py-0.5 w-6 text-left"></th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {FINISHING_SUBCATEGORIES.map((subcat) => {
                                                                                                // Фильтруем по subcategory или определяем по названию для старых позиций
                                                                                                const subcatItems = items.filter((item: any) => {
                                                                                                    if (item.subcategory) {
                                                                                                        return item.subcategory === subcat;
                                                                                                    }
                                                                                                    return inferSubcategoryFromName(item.name || '') === subcat;
                                                                                                });
                                                                                                let itemCounter = 0;
                                                                                                return (
                                                                                                    <React.Fragment key={subcat}>
                                                                                                        {/* Заголовок подкатегории */}
                                                                                                        <tr className="bg-architect-100/50 dark:bg-architect-900/50">
                                                                                                            <td colSpan={7} className="py-2 px-2">
                                                                                                                <div className="flex items-center justify-between">
                                                                                                                    <span className="text-xs font-bold text-architect-600 dark:text-architect-300">{subcat}</span>
                                                                                                                    <span className="text-[10px] text-architect-400">({subcatItems.length})</span>
                                                                                                                </div>
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                        {/* Позиции подкатегории */}
                                                                                                        {subcatItems.map((item: any) => {
                                                                                                            itemCounter++;
                                                                                                            return (
                                                                                                                <React.Fragment key={item.id}>
                                                                                                                    <tr className="border-b border-architect-50 dark:border-architect-900/50 group text-left">
                                                                                                                        <td className="py-0.5 text-architect-400 text-left text-xs leading-tight">{itemCounter}</td>
                                                                                                                        <td className="py-0.5 text-left" style={{ position: 'relative', overflow: 'visible' }}>
                                                                                                                            <div className="flex items-center gap-2 text-left">
                                                                                                                                <input 
                                                                                                                                  type="text" 
                                                                                                                                  value={item.name} 
                                                                                                                                  data-search-input
                                                                                                                                  onFocus={() => setActiveSearchId(item.id)}
                                                                                                                                  onChange={(e) => handleUpdateEstimationItem('works', item.id, 'name', e.target.value, sub)} 
                                                                                                                                  className="flex-1 bg-transparent outline-none focus:text-purple-500 font-bold text-left text-xs h-5 leading-tight" 
                                                                                                                                  placeholder="Работа..." 
                                                                                                                                />
                                                                                                                                <button onClick={() => handleAddMaterialToWork(item.id, sub)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all ${isRoughSection ? 'text-amber-600 bg-amber-50 hover:text-amber-700' : 'text-blue-600 bg-blue-50 hover:text-blue-700'}`}>+ {isRoughSection ? 'черн.' : 'чист.'}</button>
                                                                                                                            </div>
                                                                                                                            {activeSearchId === item.id && (
                                                                                                                                <div data-search-dropdown className="absolute top-full left-0 z-[9999] w-full bg-white dark:bg-architect-700 shadow-2xl border-2 border-purple-300 dark:border-purple-600 rounded-lg max-h-48 overflow-y-auto text-left" style={{ position: 'absolute' }}>
                                                                                                                                    {priceList
                                                                                                                                        .filter(p => p.type === 'work' && p.category === sub && p.subcategory === subcat)
                                                                                                                                        .filter(p => !item.name || p.name.toLowerCase().includes(item.name.toLowerCase()))
                                                                                                                                        .map(p => (
                                                                                                                                        <div key={p.id} onClick={() => handleSelectFromDictionary(item.id, p.name, sub)} className="px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer text-[11px] font-medium text-left">{p.name} — {p.price} р/{p.unit}</div>
                                                                                                                                    ))}
                                                                                                                                    {priceList.filter(p => p.type === 'work' && p.category === sub && p.subcategory === subcat).filter(p => !item.name || p.name.toLowerCase().includes(item.name.toLowerCase())).length === 0 && (
                                                                                                                                        <div className="px-3 py-2 text-[11px] text-architect-400 text-center">Нет позиций в справочнике</div>
                                                                                                                                    )}
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </td>
                                                                                                                        <td className="py-0.5 text-left"><input type="text" value={item.unit} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'unit', e.target.value, sub)} className="w-full bg-transparent outline-none text-left text-xs h-5 leading-tight" /></td>
                                                                                                                        <td className="py-0.5 text-left"><input type="number" value={item.quantity} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'quantity', e.target.value, sub)} className="w-full bg-transparent outline-none font-bold text-left text-xs h-5 leading-tight" /></td>
                                                                                                                        <td className="py-0.5 text-left"><input type="number" value={item.price} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'price', e.target.value, sub)} className="w-full bg-transparent outline-none font-bold text-left text-xs h-5 leading-tight" /></td>
                                                                                                                        <td className="py-0.5 font-bold text-architect-900 dark:text-white text-left text-xs leading-tight">{(item.total || 0).toLocaleString()}</td>
                                                                                                                        <td className="py-0.5 text-left"><button onClick={() => handleDeleteEstimationItem('works', item.id, sub)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all text-left"><Trash2 className="w-3 h-3" /></button></td>
                                                                                                                    </tr>
                                                                                                                    {(item.linkedMaterials || []).map((mat: any) => (
                                                                                                                        <tr key={mat.id} className="border-b border-architect-50 dark:border-architect-900/30 group bg-architect-50/30 dark:bg-architect-900/10 text-left">
                                                                                                                            <td className="py-0.5 text-left"></td>
                                                                                                                            <td className="py-0.5 pl-[16px] relative text-left">
                                                                                                                                <div className="flex items-center text-left">
                                                                                                                                    <span className="text-[10px] font-bold text-architect-300 mr-1">└</span>
                                                                                                                                    <input 
                                                                                                                                        type="text" 
                                                                                                                                        value={mat.name} 
                                                                                                                                        data-search-input
                                                                                                                                        onFocus={() => setActiveSearchId(mat.id)}
                                                                                                                                        onChange={(e) => handleUpdateEstimationItem('works', item.id, 'name', e.target.value, sub, mat.id)} 
                                                                                                                                        className={`flex-1 bg-transparent outline-none text-[10px] font-medium h-4 leading-tight ${mat.type === 'rough' ? 'text-amber-600' : 'text-blue-600'} text-left`} 
                                                                                                                                        placeholder={`${isRoughSection ? 'Черновой' : 'Чистовой'} материал...`} 
                                                                                                                                    />
                                                                                                                                    <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                                                                                                                        <button 
                                                                                                                                                        onClick={() => {
                                                                                                                                                            setUrlModalData({
                                                                                                                                                                isOpen: true,
                                                                                                                                                                currentUrl: mat.supplierUrl || '',
                                                                                                                                                                onSave: (url) => handleUpdateEstimationItem('works', item.id, 'supplierUrl', url, sub, mat.id)
                                                                                                                                                            });
                                                                                                                                                        }}
                                                                                                                                            className={`p-0.5 transition-all opacity-60 hover:opacity-100 ${mat.supplierUrl ? 'text-blue-500 hover:text-blue-600' : 'text-architect-300 hover:text-architect-500'}`}
                                                                                                                                            title={mat.supplierUrl ? `Ссылка: ${mat.supplierUrl}` : 'Добавить ссылку на товар'}
                                                                                                                                        >
                                                                                                                                            <ExternalLink className="w-3 h-3" />
                                                                                                                                        </button>
                                                                                                                                        {mat.supplierUrl && (
                                                                                                                                            <button 
                                                                                                                                                onClick={async () => {
                                                                                                                                                    try {
                                                                                                                                                        const result = await api.parseSupplierPrice(mat.supplierUrl);
                                                                                                                                                        if (result.price) {
                                                                                                                                                            handleUpdateEstimationItem('works', item.id, 'price', result.price, sub, mat.id);
                                                                                                                                                            alert(`Цена обновлена: ${result.price} ₽`);
                                                                                                                                                        } else {
                                                                                                                                                            alert('Не удалось получить цену');
                                                                                                                                                        }
                                                                                                                                                    } catch (e: any) {
                                                                                                                                                        alert(`Ошибка: ${e.message || 'Не удалось обновить цену'}`);
                                                                                                                                                    }
                                                                                                                                                }}
                                                                                                                                                className="p-0.5 text-emerald-500 hover:text-emerald-600 transition-all opacity-60 hover:opacity-100"
                                                                                                                                                title="Обновить цену с сайта"
                                                                                                                                            >
                                                                                                                                                <RefreshCw className="w-3 h-3" />
                                                                                                                                            </button>
                                                                                                                                        )}
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                                {activeSearchId === mat.id && (
                                                                                                                                    <div data-search-dropdown className="absolute top-full left-0 z-50 w-full bg-white dark:bg-architect-700 shadow-xl border border-architect-200 dark:border-architect-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto text-left">
                                                                                                                                        {priceList
                                                                                                                                            .filter(p => p.type === (isRoughSection ? 'rough' : 'finish'))
                                                                                                                                            .filter(p => !mat.name || p.name.toLowerCase().includes(mat.name.toLowerCase()))
                                                                                                                                            .map(p => (
                                                                                                                                            <div key={p.id} onClick={() => handleSelectFromDictionary(mat.id, p.name, sub, item.id)} className={`px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer text-[11px] ${p.type === 'rough' ? 'text-amber-700' : 'text-blue-700'} text-left`}>{p.name} — {p.price} р/{p.unit}</div>
                                                                                                                                        ))}
                                                                                                                                        {priceList.filter(p => p.type === (isRoughSection ? 'rough' : 'finish')).filter(p => !mat.name || p.name.toLowerCase().includes(mat.name.toLowerCase())).length === 0 && (
                                                                                                                                            <div className="px-3 py-2 text-[11px] text-architect-400 text-center">Нет позиций в справочнике</div>
                                                                                                                                        )}
                                                                                                                                    </div>
                                                                                                                                )}
                                                                                                                            </td>
                                                                                                                            <td className="py-0.5 text-left"><input type="text" value={mat.unit} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'unit', e.target.value, sub, mat.id)} className="w-full bg-transparent outline-none text-[10px] h-4 leading-tight text-left" /></td>
                                                                                                                            <td className="py-0.5 text-left"><input type="number" value={mat.quantity} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'quantity', e.target.value, sub, mat.id)} className="w-full bg-transparent outline-none font-bold text-[10px] h-4 leading-tight text-left" /></td>
                                                                                                                            <td className="py-0.5 text-left"><input type="number" value={mat.price} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'price', e.target.value, sub, mat.id)} className="w-full bg-transparent outline-none font-bold text-[10px] h-4 leading-tight text-left" /></td>
                                                                                                                            <td className="py-0.5 font-bold text-architect-500 text-left text-xs leading-tight">{(mat.total || 0).toLocaleString()}</td>
                                                                                                                            <td className="py-0.5 text-left"><button onClick={() => handleDeleteEstimationItem('works', item.id, sub, mat.id)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all text-left"><Trash2 className="w-3 h-3" /></button></td>
                                                                                                                        </tr>
                                                                                                                    ))}
                                                                                                                </React.Fragment>
                                                                                                            );
                                                                                                        })}
                                                                                                        {/* Кнопка добавления работы в подкатегорию */}
                                                                                                        <tr>
                                                                                                            <td colSpan={7} className="py-1 px-2">
                                                                                                                <button onClick={() => handleAddEstimationItemWithSubcategory('works', sub, subcat)} className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors text-left">
                                                                                                                    <Plus className="w-3 h-3" /> Добавить
                                                                                                                </button>
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    </React.Fragment>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                ) : (
                                                                                    /* Обычный рендеринг для остальных секций */
                                                                                    <>
                                                                                        <table className="w-full text-left text-xs" style={{ overflow: 'visible' }}>
                                                                                            <thead>
                                                                                                <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter text-left text-[10px]">
                                                                                                    <th className="py-0.5 w-6 text-left">№</th>
                                                                                                    <th className="py-0.5 text-left">Наименование</th>
                                                                                                    <th className="py-0.5 w-14 text-left">Ед.изм</th>
                                                                                                    <th className="py-0.5 w-14 text-left">Кол-во</th>
                                                                                                    <th className="py-0.5 w-16 text-left">Цена</th>
                                                                                                    <th className="py-0.5 w-20 text-left">Стоимость</th>
                                                                                                    <th className="py-0.5 w-6 text-left"></th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody>
                                                                                                {items.map((item, i) => (
                                                                                                    <React.Fragment key={item.id}>
                                                                                                        <tr className="border-b border-architect-50 dark:border-architect-900/50 group text-left">
                                                                                                            <td className="py-0.5 text-architect-400 text-left text-xs leading-tight">{i + 1}</td>
                                                                                                            <td className="py-0.5 text-left" style={{ position: 'relative', overflow: 'visible' }}>
                                                                                                                <div className="flex items-center gap-2 text-left">
                                                                                                                    <input 
                                                                                                                      type="text" 
                                                                                                                      value={item.name} 
                                                                                                                      data-search-input
                                                                                                                      onFocus={() => setActiveSearchId(item.id)}
                                                                                                                      onChange={(e) => handleUpdateEstimationItem('works', item.id, 'name', e.target.value, sub)} 
                                                                                                                      className="flex-1 bg-transparent outline-none focus:text-purple-500 font-bold text-left text-xs h-5 leading-tight" 
                                                                                                                      placeholder="Работа..." 
                                                                                                                    />
                                                                                                                    <button onClick={() => handleAddMaterialToWork(item.id, sub)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all ${isRoughSection ? 'text-amber-600 bg-amber-50 hover:text-amber-700' : 'text-blue-600 bg-blue-50 hover:text-blue-700'}`}>+ {isRoughSection ? 'черн.' : 'чист.'}</button>
                                                                                                                </div>
                                                                                                                {activeSearchId === item.id && (
                                                                                                                    <div data-search-dropdown className="absolute top-full left-0 z-[9999] w-full bg-white dark:bg-architect-700 shadow-2xl border-2 border-purple-300 dark:border-purple-600 rounded-lg max-h-48 overflow-y-auto text-left" style={{ position: 'absolute' }}>
                                                                                                                        {priceList
                                                                                                                            .filter(p => p.type === 'work' && (p.category === sub || p.category === 'Общие'))
                                                                                                                            .filter(p => !item.name || p.name.toLowerCase().includes(item.name.toLowerCase()))
                                                                                                                            .map(p => (
                                                                                                                            <div key={p.id} onClick={() => handleSelectFromDictionary(item.id, p.name, sub)} className="px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer text-[11px] font-medium text-left">{p.name} — {p.price} р/{p.unit}</div>
                                                                                                                        ))}
                                                                                                                        {priceList.filter(p => p.type === 'work' && (p.category === sub || p.category === 'Общие')).filter(p => !item.name || p.name.toLowerCase().includes(item.name.toLowerCase())).length === 0 && (
                                                                                                                            <div className="px-3 py-2 text-[11px] text-architect-400 text-center">Нет позиций в справочнике</div>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </td>
                                                                                                            <td className="py-0.5 text-left"><input type="text" value={item.unit} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'unit', e.target.value, sub)} className="w-full bg-transparent outline-none text-left text-xs h-5 leading-tight" /></td>
                                                                                                            <td className="py-0.5 text-left"><input type="number" value={item.quantity} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'quantity', e.target.value, sub)} className="w-full bg-transparent outline-none font-bold text-left text-xs h-5 leading-tight" /></td>
                                                                                                            <td className="py-0.5 text-left"><input type="number" value={item.price} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'price', e.target.value, sub)} className="w-full bg-transparent outline-none font-bold text-left text-xs h-5 leading-tight" /></td>
                                                                                                            <td className="py-0.5 font-bold text-architect-900 dark:text-white text-left text-xs leading-tight">{(item.total || 0).toLocaleString()}</td>
                                                                                                            <td className="py-0.5 text-left"><button onClick={() => handleDeleteEstimationItem('works', item.id, sub)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all text-left"><Trash2 className="w-3 h-3" /></button></td>
                                                                                                        </tr>
                                                                                                        {(item.linkedMaterials || []).map((mat: any) => (
                                                                                                            <tr key={mat.id} className="border-b border-architect-50 dark:border-architect-900/30 group bg-architect-50/30 dark:bg-architect-900/10 text-left">
                                                                                                                <td className="py-0.5 text-left"></td>
                                                                                                                <td className="py-0.5 pl-[16px] relative text-left">
                                                                                                                    <div className="flex items-center text-left">
                                                                                                                        <span className="text-[10px] font-bold text-architect-300 mr-1">└</span>
                                                                                                                        <input 
                                                                                                                            type="text" 
                                                                                                                            value={mat.name} 
                                                                                                                            data-search-input
                                                                                                                            onFocus={() => setActiveSearchId(mat.id)}
                                                                                                                            onChange={(e) => handleUpdateEstimationItem('works', item.id, 'name', e.target.value, sub, mat.id)} 
                                                                                                                            className={`flex-1 bg-transparent outline-none text-[10px] font-medium h-4 leading-tight ${mat.type === 'rough' ? 'text-amber-600' : 'text-blue-600'} text-left`} 
                                                                                                                            placeholder={`${isRoughSection ? 'Черновой' : 'Чистовой'} материал...`} 
                                                                                                                        />
                                                                                                                        <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                                                                                                            <button 
                                                                                                                                                        onClick={() => {
                                                                                                                                                            setUrlModalData({
                                                                                                                                                                isOpen: true,
                                                                                                                                                                currentUrl: mat.supplierUrl || '',
                                                                                                                                                                onSave: (url) => handleUpdateEstimationItem('works', item.id, 'supplierUrl', url, sub, mat.id)
                                                                                                                                                            });
                                                                                                                                                        }}
                                                                                                                                className={`p-0.5 transition-all opacity-60 hover:opacity-100 ${mat.supplierUrl ? 'text-blue-500 hover:text-blue-600' : 'text-architect-300 hover:text-architect-500'}`}
                                                                                                                                title={mat.supplierUrl ? `Ссылка: ${mat.supplierUrl}` : 'Добавить ссылку на товар'}
                                                                                                                            >
                                                                                                                                <ExternalLink className="w-3 h-3" />
                                                                                                                            </button>
                                                                                                                            {mat.supplierUrl && (
                                                                                                                                <button 
                                                                                                                                    onClick={async () => {
                                                                                                                                        try {
                                                                                                                                            const result = await api.parseSupplierPrice(mat.supplierUrl);
                                                                                                                                            if (result.price) {
                                                                                                                                                handleUpdateEstimationItem('works', item.id, 'price', result.price, sub, mat.id);
                                                                                                                                                alert(`Цена обновлена: ${result.price} ₽`);
                                                                                                                                            } else {
                                                                                                                                                alert('Не удалось получить цену');
                                                                                                                                            }
                                                                                                                                        } catch (e: any) {
                                                                                                                                            alert(`Ошибка: ${e.message || 'Не удалось обновить цену'}`);
                                                                                                                                        }
                                                                                                                                    }}
                                                                                                                                    className="p-0.5 text-emerald-500 hover:text-emerald-600 transition-all opacity-60 hover:opacity-100"
                                                                                                                                    title="Обновить цену с сайта"
                                                                                                                                >
                                                                                                                                    <RefreshCw className="w-3 h-3" />
                                                                                                                                </button>
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    {activeSearchId === mat.id && (
                                                                                                                        <div data-search-dropdown className="absolute top-full left-0 z-50 w-full bg-white dark:bg-architect-700 shadow-xl border border-architect-200 dark:border-architect-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto text-left">
                                                                                                                            {priceList
                                                                                                                                .filter(p => p.type === (isRoughSection ? 'rough' : 'finish'))
                                                                                                                                .filter(p => !mat.name || p.name.toLowerCase().includes(mat.name.toLowerCase()))
                                                                                                                                .map(p => (
                                                                                                                                <div key={p.id} onClick={() => handleSelectFromDictionary(mat.id, p.name, sub, item.id)} className={`px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer text-[11px] ${p.type === 'rough' ? 'text-amber-700' : 'text-blue-700'} text-left`}>{p.name} — {p.price} р/{p.unit}</div>
                                                                                                                            ))}
                                                                                                                            {priceList.filter(p => p.type === (isRoughSection ? 'rough' : 'finish')).filter(p => !mat.name || p.name.toLowerCase().includes(mat.name.toLowerCase())).length === 0 && (
                                                                                                                                <div className="px-3 py-2 text-[11px] text-architect-400 text-center">Нет позиций в справочнике</div>
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </td>
                                                                                                                <td className="py-0.5 text-left"><input type="text" value={mat.unit} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'unit', e.target.value, sub, mat.id)} className="w-full bg-transparent outline-none text-[10px] h-4 leading-tight text-left" /></td>
                                                                                                                <td className="py-0.5 text-left"><input type="number" value={mat.quantity} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'quantity', e.target.value, sub, mat.id)} className="w-full bg-transparent outline-none font-bold text-[10px] h-4 leading-tight text-left" /></td>
                                                                                                                <td className="py-0.5 text-left"><input type="number" value={mat.price} onChange={(e) => handleUpdateEstimationItem('works', item.id, 'price', e.target.value, sub, mat.id)} className="w-full bg-transparent outline-none font-bold text-[10px] h-4 leading-tight text-left" /></td>
                                                                                                                <td className="py-0.5 font-bold text-architect-500 text-left text-xs leading-tight">{(mat.total || 0).toLocaleString()}</td>
                                                                                                                <td className="py-0.5 text-left"><button onClick={() => handleDeleteEstimationItem('works', item.id, sub, mat.id)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all text-left"><Trash2 className="w-3 h-3" /></button></td>
                                                                                                            </tr>
                                                                                                        ))}
                                                                                                    </React.Fragment>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                        <button onClick={() => handleAddEstimationItem('works', sub)} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors text-left relative z-0">
                                                                                          <Plus className="w-3.5 h-3.5" /> Добавить работу
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                      </div>
                                                    )}
                                                </div>

                                                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-architect-100 dark:border-architect-700 text-left">
                                                    <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 shadow-sm text-left">
                                                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-1.5">Итого работы</p>
                                                        <p className="text-3xl font-bold text-emerald-600">{calculateTotalForRoom('work').toLocaleString()} <span className="text-sm font-normal">руб.</span></p>
                                                    </div>
                                                    <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 shadow-sm text-left">
                                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1.5">Итого черн. мат.</p>
                                                        <p className="text-3xl font-bold text-emerald-600">{calculateTotalForRoom('rough').toLocaleString()} <span className="text-sm font-normal">руб.</span></p>
                                                    </div>
                                                    <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 shadow-sm text-left">
                                                        <p className="text-sm font-bold text-blue-800 dark:text-blue-400 uppercase tracking-widest mb-1.5">Итого чист. мат.</p>
                                                        <p className="text-3xl font-bold text-emerald-600">{calculateTotalForRoom('finish').toLocaleString()} <span className="text-sm font-normal">руб.</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-architect-800 rounded-2xl border border-architect-200 dark:border-architect-700 p-8 shadow-sm text-left">
                                            <div className="flex justify-between items-center border-b border-architect-100 dark:border-architect-700 pb-5 mb-6 text-left">
                                                <h3 className="text-xl font-bold dark:text-white flex items-center gap-3 text-left"><div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-xl text-indigo-600"><Palette className="w-5 h-5" /></div> Студия Дизайна</h3>
                                                <button onClick={handleAddFurniture} className="text-xs flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition-all active:scale-95"><Plus className="w-4 h-4" />Добавить мебель</button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 text-left">
                                                {selectedRoom.furniture.map((item) => (
                                                    <div key={item.id} className="border border-architect-200 dark:border-architect-700 rounded-[20px] p-4 bg-architect-50 dark:bg-architect-900 flex gap-4 items-start relative group shadow-sm transition-all hover:shadow-md text-left">
                                                        <div className="w-16 h-16 shrink-0 bg-white dark:bg-architect-800 rounded-2xl border border-architect-200 flex items-center justify-center overflow-hidden cursor-pointer relative shadow-sm text-left">
                                                            {item.image ? <img src={item.image} alt="Furn" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-architect-200" />}
                                                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleFurnitureImageUpload(item.id, e.target.files[0])} />
                                                        </div>
                                                        <div className="flex-1 min-w-0 text-left"><input type="text" value={item.name} onChange={(e) => handleUpdateFurniture(item.id, 'name', e.target.value)} placeholder="Название..." className="w-full bg-transparent text-sm font-bold text-architect-800 dark:text-white border-b border-transparent focus:border-architect-200 outline-none pb-1 mt-1 transition-all text-left" /></div>
                                                        <button onClick={() => handleDeleteFurniture(item.id)} className="absolute top-2.5 right-2.5 p-1.5 text-architect-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-left"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                                {selectedRoom.furniture.length === 0 && (
                                                    <div className="col-span-full py-12 text-center border-2 border-dashed border-architect-100 dark:border-architect-700 rounded-[32px] opacity-40">
                                                      <Armchair className="w-12 h-12 text-architect-300 mx-auto mb-3" />
                                                      <p className="text-xs font-bold uppercase tracking-[0.2em]">Список мебели пуст</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex justify-end pt-4 text-left">
                                                <button onClick={handleGenerateRoom} disabled={isGeneratingRoom} className="w-full md:w-auto bg-architect-900 dark:bg-white text-white dark:text-architect-900 px-12 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:shadow-xl active:scale-95 transition-all">{isGeneratingRoom ? <Loader2 className="w-5 h-5 animate-spin" /> : <Home className="w-5 h-5" />}<span>{isGeneratingRoom ? 'Генерация дизайна...' : 'Сгенерировать Интерьер'}</span></button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 text-left">
                                            {/* Основное изображение (последнее сгенерированное) */}
                                            <div className="bg-white dark:bg-architect-800 rounded-[40px] border border-architect-200 dark:border-architect-700 p-2 min-h-[500px] flex items-center justify-center relative overflow-hidden">
                                                {isGeneratingRoom ? (
                                                    <GenerationLoader planUrl={currentProject.planPreview || null} label={`Отрисовываем ${selectedRoom.name}...`} />
                                                ) : currentProject.roomImages?.[selectedRoom.id] && currentProject.roomImages[selectedRoom.id].length > 0 ? (
                                                    <img 
                                                        src={getImageUrl(currentProject.roomImages[selectedRoom.id][0]) || currentProject.roomImages[selectedRoom.id][0]} 
                                                        alt="Room interior" 
                                                        className="w-full h-auto rounded-[32px]" 
                                                    />
                                                ) : (
                                                    <div className="text-architect-200 flex flex-col items-center">
                                                        <ImageIcon className="w-20 h-20 mb-2 opacity-10" />
                                                        <p className="text-xs font-bold uppercase tracking-widest opacity-30">Интерьер еще не создан</p>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Сетка предыдущих изображений (6 колонок) */}
                                            {currentProject.roomImages?.[selectedRoom.id] && currentProject.roomImages[selectedRoom.id].length > 1 && (
                                                <div>
                                                    <h4 className="text-sm font-bold text-architect-500 uppercase mb-2">История генераций</h4>
                                                    <div className="grid grid-cols-6 gap-2">
                                                        {currentProject.roomImages[selectedRoom.id].slice(1).map((imageUrl, index) => (
                                                            <div 
                                                                key={index} 
                                                                className="aspect-square rounded-xl overflow-hidden border border-architect-200 dark:border-architect-700 cursor-pointer hover:opacity-80 hover:border-architect-400 transition-all group relative"
                                                                onClick={() => {
                                                                    // При клике переместить изображение в начало
                                                                    const newImages = [
                                                                        imageUrl, 
                                                                        ...currentProject.roomImages![selectedRoom.id].filter((_, i) => i !== index + 1)
                                                                    ];
                                                                    const updatedRoomImages = { ...currentProject.roomImages, [selectedRoom.id]: newImages };
                                                                    updateCurrentProject({ roomImages: updatedRoomImages });
                                                                    api.updateProject(currentProject.id, { roomImages: updatedRoomImages });
                                                                }}
                                                            >
                                                                <img 
                                                                    src={getImageUrl(imageUrl) || imageUrl} 
                                                                    alt={`Previous ${index + 1}`} 
                                                                    className="w-full h-full object-cover" 
                                                                />
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteRoomImage(selectedRoom.id, index + 1);
                                                                    }}
                                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                                                                    title="Удалить изображение"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
            {activeTab === 'prices' && (
                <div className="animate-in fade-in duration-300 space-y-6 text-left">
                    {/* Табы для переключения между типами */}
                    <div className="flex gap-2 bg-white dark:bg-architect-800 p-2 rounded-xl border border-architect-200 dark:border-architect-700">
                        <button 
                            onClick={() => setActivePriceTab('works')} 
                            className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activePriceTab === 'works' ? 'bg-emerald-500 text-white shadow-lg' : 'text-architect-600 hover:bg-architect-50 dark:hover:bg-architect-700'}`}
                        >
                            <span className="flex items-center justify-center gap-2"><Hammer className="w-4 h-4" /> Работы</span>
                        </button>
                        <button 
                            onClick={() => setActivePriceTab('rough')} 
                            className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activePriceTab === 'rough' ? 'bg-amber-500 text-white shadow-lg' : 'text-architect-600 hover:bg-architect-50 dark:hover:bg-architect-700'}`}
                        >
                            <span className="flex items-center justify-center gap-2"><Package className="w-4 h-4" /> Черновые материалы</span>
                        </button>
                        <button 
                            onClick={() => setActivePriceTab('finish')} 
                            className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activePriceTab === 'finish' ? 'bg-blue-500 text-white shadow-lg' : 'text-architect-600 hover:bg-architect-50 dark:hover:bg-architect-700'}`}
                        >
                            <span className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Чистовые материалы</span>
                        </button>
                    </div>

                    {/* Блок работ (разделённый по подгруппам) */}
                    {activePriceTab === 'works' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 shrink-0"><Hammer className="w-5 h-5 text-emerald-500" /> Справочник работ</h3>
                                {/* Поиск */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-architect-400" />
                                    <input 
                                        type="text" 
                                        value={priceSearchQuery}
                                        onChange={e => setPriceSearchQuery(e.target.value)}
                                        onFocus={() => setPriceSearchFocused(true)}
                                        onBlur={() => setTimeout(() => setPriceSearchFocused(false), 200)}
                                        placeholder="Поиск по работам..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm dark:text-white transition-all"
                                    />
                                    {/* Выпадающий список результатов */}
                                    {priceSearchFocused && priceSearchQuery && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                                            {priceList
                                                .filter(p => p.type === 'work' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase()))
                                                .slice(0, 15)
                                                .map(item => (
                                                    <div 
                                                        key={item.id}
                                                        onClick={() => scrollToPriceItem(item)}
                                                        className="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer border-b border-architect-50 dark:border-architect-700 last:border-0"
                                                    >
                                                        <div className="text-sm font-medium dark:text-white">{item.name}</div>
                                                        <div className="text-[10px] text-architect-400 mt-0.5">{item.category} • {item.price} ₽/{item.unit}</div>
                                                    </div>
                                                ))
                                            }
                                            {priceList.filter(p => p.type === 'work' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-4 text-center text-sm text-architect-400">Ничего не найдено</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3">
                                {ALL_WORK_SECTIONS.map((sub, idx) => {
                                    const isExpanded = !!expandedPriceSections[`work-${sub}`];
                                    const isFinishingSection = sub === 'Черновые отделочные работы' || sub === 'Чистовые отделочные работы';
                                    // Для отделочных работ считаем только позиции с подкатегориями
                                    const items = priceList.filter(p => {
                                        if (p.type === 'work' && p.category === sub) {
                                            if (isFinishingSection) {
                                                return p.subcategory && p.subcategory.trim() !== '';
                                            }
                                            return true;
                                        }
                                        return false;
                                    });
                                    
                                    return (
                                        <div key={idx} className="border border-architect-100 dark:border-architect-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-architect-800">
                                            <div className="w-full flex items-center justify-between px-4 py-4 bg-architect-50/50 dark:bg-architect-900/50">
                                                <button 
                                                    onClick={() => setExpandedPriceSections(prev => ({ ...prev, [`work-${sub}`]: !isExpanded }))} 
                                                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                                >
                                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                    <span className="text-sm font-bold text-architect-700 dark:text-architect-300">{sub}</span>
                                                    <span className="text-xs text-architect-400">({items.length} позиций)</span>
                                                </button>
                                                {!isFinishingSection && !hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                                    <span className="text-xs text-architect-400">Только просмотр</span>
                                                )}
                                            </div>
                                            {isExpanded && (
                                                <div className="p-4 border-t border-architect-50 dark:border-architect-700">
                                                    {/* Отделочные работы с подразделами */}
                                                    {isFinishingSection ? (
                                                        <div className="space-y-4">
                                                            {FINISHING_SUBSECTIONS.map((subSec) => {
                                                                const subItems = items.filter(item => item.subcategory === subSec);
                                                                // Статические классы для каждого подраздела
                                                                const headerBg = subSec === 'Стены' 
                                                                    ? 'bg-purple-50 dark:bg-purple-900/20' 
                                                                    : subSec === 'Пол' 
                                                                        ? 'bg-amber-50 dark:bg-amber-900/20' 
                                                                        : 'bg-cyan-50 dark:bg-cyan-900/20';
                                                                const titleClass = subSec === 'Стены' 
                                                                    ? 'text-purple-700 dark:text-purple-400' 
                                                                    : subSec === 'Пол' 
                                                                        ? 'text-amber-700 dark:text-amber-400' 
                                                                        : 'text-cyan-700 dark:text-cyan-400';
                                                                const btnClass = subSec === 'Стены' 
                                                                    ? 'text-purple-600 hover:bg-purple-100' 
                                                                    : subSec === 'Пол' 
                                                                        ? 'text-amber-600 hover:bg-amber-100' 
                                                                        : 'text-cyan-600 hover:bg-cyan-100';
                                                                
                                                                return (
                                                                    <div key={subSec} className="border border-architect-100 dark:border-architect-700 rounded-lg overflow-hidden">
                                                                        {/* Заголовок подраздела */}
                                                                        <div className={`flex items-center justify-between px-3 py-2 ${headerBg}`}>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`text-sm font-bold ${titleClass}`}>{subSec}</span>
                                                                                <span className="text-xs text-architect-400">({subItems.length})</span>
                                                                            </div>
                                                                        </div>
                                                                        {/* Таблица работ */}
                                                                        <div className="overflow-x-auto">
                                                                            {subItems.length > 0 ? (
                                                                                <table className="w-full text-left text-xs min-w-[400px]">
                                                                                    <tbody>
                                                                                        {subItems.map((item, i) => (
                                                                                            <tr key={item.id} id={`price-item-${item.id}`} className={`border-b border-architect-50 dark:border-architect-900/50 group transition-all duration-500 ${highlightedPriceId === item.id ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500' : ''}`}>
                                                                                                <td className="py-1.5 px-2 text-architect-400 w-6">{i + 1}</td>
                                                                                                <td className="py-1.5 px-2">
                                                                                                    <input 
                                                                                                        type="text" 
                                                                                                        value={item.name} 
                                                                                                        onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                                                                                        className="w-full bg-transparent outline-none focus:text-emerald-600 font-medium text-xs" 
                                                                                                        placeholder="Название работы..." 
                                                                                                    />
                                                                                                </td>
                                                                                                <td className="py-1.5 px-2 w-16">
                                                                                                    <input 
                                                                                                        type="text" 
                                                                                                        value={item.unit} 
                                                                                                        onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                                                                                        className="w-full bg-transparent outline-none text-architect-500 text-xs" 
                                                                                                    />
                                                                                                </td>
                                                                                                <td className="py-1.5 px-2 w-20">
                                                                                                    <div className="flex items-center gap-1">
                                                                                                        <input 
                                                                                                            type="number" 
                                                                                                            value={item.price} 
                                                                                                            onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                                                                                            className="w-full bg-transparent outline-none font-bold text-xs" 
                                                                                                        />
                                                                                                        <span className="text-architect-400 text-[10px]">₽</span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td className="py-1.5 px-2 w-6">
                                                                                                    <button onClick={() => handleDeletePriceItem(item.id)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                                                                                        <Trash2 className="w-3 h-3" />
                                                                                                    </button>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            ) : (
                                                                                <div className="text-center py-3 text-architect-400 text-xs">
                                                                                    Нет позиций
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {/* Кнопки добавления внизу подраздела */}
                                                                        {hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                                                            <div className="flex items-center justify-start gap-2 px-3 py-2 border-t border-architect-50 dark:border-architect-700">
                                                                                <button 
                                                                                    onClick={() => { handleAddPriceItem('work', sub, subSec); }}
                                                                                    className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-white dark:bg-architect-800 rounded transition-all ${btnClass}`}
                                                                                >
                                                                                    <Plus className="w-2.5 h-2.5" />
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => openImportModal(sub, subSec)}
                                                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-all"
                                                                                >
                                                                                    <Upload className="w-2.5 h-2.5" /> xlsx
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        /* Обычные работы без подразделов */
                                                        <div className="overflow-x-auto">
                                                            {items.length > 0 ? (
                                                                <table className="w-full text-left text-xs min-w-[500px]">
                                                                    <thead>
                                                                        <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter">
                                                                            <th className="py-2 w-8">№</th>
                                                                            <th className="py-2">Наименование</th>
                                                                            <th className="py-2 w-20">Ед.изм</th>
                                                                            <th className="py-2 w-24">Цена</th>
                                                                            <th className="py-2 w-8"></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {items.map((item, i) => (
                                                                            <tr key={item.id} id={`price-item-${item.id}`} className={`border-b border-architect-50 dark:border-architect-900/50 group transition-all duration-500 ${highlightedPriceId === item.id ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500' : ''}`}>
                                                                                <td className="py-2 text-architect-400">{i + 1}</td>
                                                                                <td className="py-2">
                                                                                    <input 
                                                                                        type="text" 
                                                                                        value={item.name} 
                                                                                        onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                                                                        className="w-full bg-transparent outline-none focus:text-emerald-600 font-medium" 
                                                                                        placeholder="Название работы..." 
                                                                                    />
                                                                                </td>
                                                                                <td className="py-2">
                                                                                    <input 
                                                                                        type="text" 
                                                                                        value={item.unit} 
                                                                                        onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                                                                        className="w-full bg-transparent outline-none text-architect-500" 
                                                                                    />
                                                                                </td>
                                                                                <td className="py-2">
                                                                                    <div className="flex items-center gap-1">
                                                                                        <input 
                                                                                            type="number" 
                                                                                            value={item.price} 
                                                                                            onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                                                                            className="w-full bg-transparent outline-none font-bold" 
                                                                                        />
                                                                                        <span className="text-architect-400">₽</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2">
                                                                                    <button onClick={() => handleDeletePriceItem(item.id)} className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div className="text-center py-6 text-architect-400">
                                                                    <p className="text-sm">Нет позиций в этой категории</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Кнопки добавления внизу обычной секции */}
                                                    {!isFinishingSection && hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                                        <div className="flex items-center justify-start gap-2 px-4 py-3 border-t border-architect-50 dark:border-architect-700">
                                                            <button 
                                                                onClick={() => { handleAddPriceItem('work', sub); setExpandedPriceSections(prev => ({ ...prev, [`work-${sub}`]: true })); }}
                                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                                                            >
                                                                <Plus className="w-3 h-3" /> Добавить
                                                            </button>
                                                            <button 
                                                                onClick={() => openImportModal(sub)}
                                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                                                            >
                                                                <Upload className="w-3 h-3" /> Загрузить
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Блок черновых материалов */}
                    {activePriceTab === 'rough' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 shrink-0"><Package className="w-5 h-5 text-amber-500" /> Черновые материалы</h3>
                                {/* Поиск */}
                                <div className="relative flex-1 max-w-md min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-architect-400" />
                                    <input 
                                        type="text" 
                                        value={priceSearchQuery}
                                        onChange={e => setPriceSearchQuery(e.target.value)}
                                        onFocus={() => setPriceSearchFocused(true)}
                                        onBlur={() => setTimeout(() => setPriceSearchFocused(false), 200)}
                                        placeholder="Поиск материала..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm dark:text-white transition-all"
                                    />
                                    {priceSearchFocused && priceSearchQuery && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                                            {priceList
                                                .filter(p => p.type === 'rough' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase()))
                                                .slice(0, 15)
                                                .map(item => (
                                                    <div 
                                                        key={item.id}
                                                        onClick={() => scrollToPriceItem(item)}
                                                        className="px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer border-b border-architect-50 dark:border-architect-700 last:border-0"
                                                    >
                                                        <div className="text-sm font-medium dark:text-white">{item.name}</div>
                                                        <div className="text-[10px] text-architect-400 mt-0.5">{item.price} ₽/{item.unit}</div>
                                                    </div>
                                                ))
                                            }
                                            {priceList.filter(p => p.type === 'rough' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-4 text-center text-sm text-architect-400">Ничего не найдено</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Кнопка обновить все цены */}
                                {hasPermission(PERMISSIONS.EDIT_PRICES) && priceList.filter(p => p.type === 'rough' && p.supplierUrl).length > 0 && (
                                  <button
                                    onClick={() => handleUpdateAllPricesWithUrls('rough')}
                                    disabled={updatingAllPrices}
                                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <RefreshCw className={`w-4 h-4 ${updatingAllPrices ? 'animate-spin' : ''}`} /> 
                                    {updatingAllPrices ? 'Обновление...' : 'Обновить все цены'}
                                  </button>
                                )}
                            </div>
                            <div className="bg-white dark:bg-architect-800 rounded-xl border border-architect-200 dark:border-architect-700 overflow-hidden">
                                {priceList.filter(p => p.type === 'rough').length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs min-w-[500px]">
                                            <thead>
                                                <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter bg-architect-50/50 dark:bg-architect-900/50">
                                                    <th className="py-3 px-4 w-8">№</th>
                                                    <th className="py-3 px-4">Наименование</th>
                                                    <th className="py-3 px-4 w-32">Категория</th>
                                                    <th className="py-3 px-4 w-20">Ед.изм</th>
                                                    <th className="py-3 px-4 w-24">Цена</th>
                                                    {hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                                      <th className="py-3 px-4">Ссылка</th>
                                                    )}
                                                    <th className="py-3 px-4 w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {priceList.filter(p => p.type === 'rough').map((item, i) => (
                                                    <tr key={item.id} id={`price-item-${item.id}`} className={`border-b border-architect-50 dark:border-architect-900/50 group hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-all duration-500 ${highlightedPriceId === item.id ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-500' : ''}`}>
                                                        <td className="py-3 px-4 text-architect-400">{i + 1}</td>
                                                        <td className="py-3 px-4">
                                                            <input 
                                                                type="text" 
                                                                value={item.name} 
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                                                className="w-full bg-transparent outline-none focus:text-amber-600 font-medium" 
                                                                placeholder="Название материала..." 
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <select 
                                                                value={item.category} 
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'category', e.target.value)}
                                                                className="w-full bg-transparent outline-none text-architect-500 text-[11px]"
                                                            >
                                                                {ROUGH_WORK_SECTIONS.map(cat => (
                                                                    <option key={cat} value={cat}>{cat}</option>
                                                                ))}
                                                                <option value="Черновые материалы">Общие</option>
                                                            </select>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <input 
                                                                type="text" 
                                                                value={item.unit} 
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                                                className="w-full bg-transparent outline-none text-architect-500" 
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-1">
                                                                <input 
                                                                    type="number" 
                                                                    value={item.price} 
                                                                    onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                                                    className="w-full bg-transparent outline-none font-bold" 
                                                                />
                                                                <span className="text-architect-400">₽</span>
                                                            </div>
                                                        </td>
                                                        {hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                                          <td className="py-3 px-4">
                                                            <div className="flex items-center gap-1">
                                                              <input
                                                                type="url"
                                                                value={item.supplierUrl || ''}
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'supplierUrl', e.target.value)}
                                                                placeholder="https://..."
                                                                className="flex-1 bg-transparent outline-none text-[10px] text-architect-500 dark:text-architect-400"
                                                              />
                                                              {item.supplierUrl && (
                                                                <div className="flex items-center gap-1">
                                                                  <a
                                                                    href={item.supplierUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-0.5 text-blue-400 hover:text-blue-600 transition-colors"
                                                                    title="Открыть ссылку"
                                                                  >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                  </a>
                                                                  <button
                                                                    onClick={() => handleUpdatePriceFromUrl(item)}
                                                                    disabled={updatingPriceId === item.id}
                                                                    className="p-0.5 text-emerald-400 opacity-0 group-hover:opacity-100 hover:text-emerald-600 transition-all disabled:opacity-50"
                                                                    title="Обновить цену"
                                                                  >
                                                                    {updatingPriceId === item.id ? (
                                                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                      <RefreshCw className="w-3 h-3" />
                                                                    )}
                                                                  </button>
                                                                </div>
                                                              )}
                                                            </div>
                                                          </td>
                                                        )}
                                                        <td className="py-3 px-4">
                                                            <button onClick={() => handleDeletePriceItem(item.id)} className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-architect-400">
                                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm font-medium">Нет черновых материалов</p>
                                        <p className="text-xs mt-1">Добавьте материалы для использования в сметах</p>
                                    </div>
                                )}
                                {/* Кнопки добавления внизу черновых материалов */}
                                {hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                    <div className="flex items-center justify-start gap-2 px-4 py-3 border-t border-architect-50 dark:border-architect-700">
                                        <button 
                                            onClick={() => handleAddPriceItem('rough', 'Черновые материалы')}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all"
                                        >
                                            <Plus className="w-3 h-3" /> Добавить
                                        </button>
                                        <button 
                                            onClick={() => openImportModal('Черновые материалы')}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                                        >
                                            <Upload className="w-3 h-3" /> Загрузить
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Блок чистовых материалов */}
                    {activePriceTab === 'finish' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 shrink-0"><Sparkles className="w-5 h-5 text-blue-500" /> Чистовые материалы</h3>
                                {/* Поиск */}
                                <div className="relative flex-1 max-w-md min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-architect-400" />
                                    <input 
                                        type="text" 
                                        value={priceSearchQuery}
                                        onChange={e => setPriceSearchQuery(e.target.value)}
                                        onFocus={() => setPriceSearchFocused(true)}
                                        onBlur={() => setTimeout(() => setPriceSearchFocused(false), 200)}
                                        placeholder="Поиск материала..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm dark:text-white transition-all"
                                    />
                                    {priceSearchFocused && priceSearchQuery && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                                            {priceList
                                                .filter(p => p.type === 'finish' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase()))
                                                .slice(0, 15)
                                                .map(item => (
                                                    <div 
                                                        key={item.id}
                                                        onClick={() => scrollToPriceItem(item)}
                                                        className="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-architect-50 dark:border-architect-700 last:border-0"
                                                    >
                                                        <div className="text-sm font-medium dark:text-white">{item.name}</div>
                                                        <div className="text-[10px] text-architect-400 mt-0.5">{item.price} ₽/{item.unit}</div>
                                                    </div>
                                                ))
                                            }
                                            {priceList.filter(p => p.type === 'finish' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-4 text-center text-sm text-architect-400">Ничего не найдено</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Кнопка обновить все цены */}
                                {hasPermission(PERMISSIONS.EDIT_PRICES) && priceList.filter(p => p.type === 'finish' && p.supplierUrl).length > 0 && (
                                  <button
                                    onClick={() => handleUpdateAllPricesWithUrls('finish')}
                                    disabled={updatingAllPrices}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <RefreshCw className={`w-4 h-4 ${updatingAllPrices ? 'animate-spin' : ''}`} /> 
                                    {updatingAllPrices ? 'Обновление...' : 'Обновить все цены'}
                                  </button>
                                )}
                            </div>
                            <div className="bg-white dark:bg-architect-800 rounded-xl border border-architect-200 dark:border-architect-700 overflow-hidden">
                                {priceList.filter(p => p.type === 'finish').length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs min-w-[500px]">
                                            <thead>
                                                <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter bg-architect-50/50 dark:bg-architect-900/50">
                                                    <th className="py-3 px-4 w-8">№</th>
                                                    <th className="py-3 px-4">Наименование</th>
                                                    <th className="py-3 px-4 w-32">Категория</th>
                                                    <th className="py-3 px-4 w-20">Ед.изм</th>
                                                    <th className="py-3 px-4 w-24">Цена</th>
                                                    {hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                                      <th className="py-3 px-4">Ссылка</th>
                                                    )}
                                                    <th className="py-3 px-4 w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {priceList.filter(p => p.type === 'finish').map((item, i) => (
                                                    <tr key={item.id} id={`price-item-${item.id}`} className={`border-b border-architect-50 dark:border-architect-900/50 group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all duration-500 ${highlightedPriceId === item.id ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500' : ''}`}>
                                                        <td className="py-3 px-4 text-architect-400">{i + 1}</td>
                                                        <td className="py-3 px-4">
                                                            <input 
                                                                type="text" 
                                                                value={item.name} 
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                                                className="w-full bg-transparent outline-none focus:text-blue-600 font-medium" 
                                                                placeholder="Название материала..." 
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <select 
                                                                value={item.category} 
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'category', e.target.value)}
                                                                className="w-full bg-transparent outline-none text-architect-500 text-[11px]"
                                                            >
                                                                {FINISH_WORK_SECTIONS.map(cat => (
                                                                    <option key={cat} value={cat}>{cat}</option>
                                                                ))}
                                                                <option value="Чистовые материалы">Общие</option>
                                                            </select>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <input 
                                                                type="text" 
                                                                value={item.unit} 
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                                                className="w-full bg-transparent outline-none text-architect-500" 
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-1">
                                                                <input 
                                                                    type="number" 
                                                                    value={item.price} 
                                                                    onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                                                    className="w-full bg-transparent outline-none font-bold" 
                                                                />
                                                                <span className="text-architect-400">₽</span>
                                                            </div>
                                                        </td>
                                                        {hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                                          <td className="py-3 px-4">
                                                            <div className="flex items-center gap-1">
                                                              <input
                                                                type="url"
                                                                value={item.supplierUrl || ''}
                                                                onChange={(e) => handleUpdatePriceItem(item.id, 'supplierUrl', e.target.value)}
                                                                placeholder="https://..."
                                                                className="flex-1 bg-transparent outline-none text-[10px] text-architect-500 dark:text-architect-400"
                                                              />
                                                              {item.supplierUrl && (
                                                                <div className="flex items-center gap-1">
                                                                  <a
                                                                    href={item.supplierUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-0.5 text-blue-400 hover:text-blue-600 transition-colors"
                                                                    title="Открыть ссылку"
                                                                  >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                  </a>
                                                                  <button
                                                                    onClick={() => handleUpdatePriceFromUrl(item)}
                                                                    disabled={updatingPriceId === item.id}
                                                                    className="p-0.5 text-emerald-400 opacity-0 group-hover:opacity-100 hover:text-emerald-600 transition-all disabled:opacity-50"
                                                                    title="Обновить цену"
                                                                  >
                                                                    {updatingPriceId === item.id ? (
                                                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                      <RefreshCw className="w-3 h-3" />
                                                                    )}
                                                                  </button>
                                                                </div>
                                                              )}
                                                            </div>
                                                          </td>
                                                        )}
                                                        <td className="py-3 px-4">
                                                            <button onClick={() => handleDeletePriceItem(item.id)} className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-architect-400">
                                        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm font-medium">Нет чистовых материалов</p>
                                        <p className="text-xs mt-1">Добавьте материалы для использования в сметах</p>
                                    </div>
                                )}
                                {/* Кнопки добавления внизу чистовых материалов */}
                                {hasPermission(PERMISSIONS.EDIT_PRICES) && (
                                    <div className="flex items-center justify-start gap-2 px-4 py-3 border-t border-architect-50 dark:border-architect-700">
                                        <button 
                                            onClick={() => handleAddPriceItem('finish', 'Чистовые материалы')}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                                        >
                                            <Plus className="w-3 h-3" /> Добавить
                                        </button>
                                        <button 
                                            onClick={() => openImportModal('Чистовые материалы')}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                                        >
                                            <Upload className="w-3 h-3" /> Загрузить
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'settings' && (
                <div className="animate-in fade-in duration-300 space-y-6">
                  <div className="bg-white dark:bg-architect-800 rounded-xl border border-architect-200 dark:border-architect-700 p-6">
                    <h2 className="text-xl font-bold dark:text-white mb-4">Внешний вид</h2>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isDarkMode ? <Moon className="w-5 h-5 text-architect-500" /> : <Sun className="w-5 h-5 text-architect-500" />}
                        <span className="text-sm font-medium dark:text-white">{isDarkMode ? 'Темная тема' : 'Светлая тема'}</span>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className="px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
                      >
                        {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        <span>Переключить</span>
                      </button>
                    </div>
                  </div>
                  <UsersManagement />
                </div>
            )}
        </section>

        {/* Suppliers Modal */}
        {hasPermission(PERMISSIONS.EDIT_PRICES) && (
          <SuppliersModal
            isOpen={showSuppliersModal}
            onClose={() => setShowSuppliersModal(false)}
            materialType={activePriceTab === 'rough' ? 'rough' : 'finish'}
            materials={priceList.filter(p => p.type === activePriceTab)}
            onUpdate={loadPriceItems}
          />
        )}
      </main>

      {editingImage && <ImageEditorModal imageUrl={editingImage} onClose={() => setEditingImage(null)} onSave={newUrl => { if (currentProject) { if (currentProject.global3DImages?.includes(editingImage)) { const index = currentProject.global3DImages.indexOf(editingImage); const updated = [...currentProject.global3DImages]; updated[index] = newUrl; updateCurrentProject({ global3DImages: updated }); api.updateProject(currentProject.id, { global3dImages: updated }); } else if (selectedRoom && currentProject.roomImages?.[selectedRoom.id]?.includes(editingImage)) { const roomImages = currentProject.roomImages[selectedRoom.id]; const index = roomImages.indexOf(editingImage); const updated = [...roomImages]; updated[index] = newUrl; updateCurrentProject({ roomImages: { ...(currentProject.roomImages || {}), [selectedRoom.id]: updated } }); api.updateProject(currentProject.id, { roomImages: { ...currentProject.roomImages, [selectedRoom.id]: updated } }); } } setEditingImage(null); }} />}

      {showExportModal && (
        <EstimateExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExportEstimate}
        />
      )}
      
      {/* Модальное окно подтверждения генерации смет */}
      {showEstimateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            {/* Заголовок */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-architect-100 dark:border-architect-700">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                <Info className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg dark:text-white">Подтверждение</h3>
                <p className="text-sm text-architect-500">Генерация смет для всех комнат</p>
              </div>
            </div>
            
            {/* Содержимое */}
            <div className="px-6 py-5">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  ⚠️ Все существующие данные в сметах комнат будут полностью удалены и заменены новыми!
                </p>
              </div>
              <p className="text-sm text-architect-600 dark:text-architect-400">
                Будут сгенерированы новые сметы для {currentProject?.analysis?.rooms?.length || 0} комнат на основе выбранных параметров:
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-architect-600 dark:text-architect-400">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span className="font-medium">Состояние:</span> {PROPERTY_CONDITIONS.find(c => c.id === propertyCondition)?.name}
                </li>
                <li className="flex items-center gap-2 text-architect-600 dark:text-architect-400">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span className="font-medium">Тип ремонта:</span> {RENOVATION_TYPES.find(t => t.id === renovationType)?.name}
                </li>
              </ul>
            </div>
            
            {/* Кнопки */}
            <div className="px-6 py-4 bg-architect-50 dark:bg-architect-900/50 border-t border-architect-100 dark:border-architect-700 flex gap-3">
              <button
                onClick={() => setShowEstimateConfirm(false)}
                className="flex-1 px-4 py-3 text-sm font-bold text-architect-600 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-xl transition-all"
              >
                Отмена
              </button>
              <button
                onClick={() => { setShowEstimateConfirm(false); generateAutoEstimation(); }}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Сгенерировать
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно импорта из Excel */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Заголовок */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-architect-100 dark:border-architect-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg dark:text-white">Импорт из Excel</h3>
                  <p className="text-xs text-architect-500">{importCategory}{importSubcategory && ` → ${importSubcategory}`}</p>
                </div>
              </div>
              <button 
                onClick={() => setImportModalOpen(false)}
                className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-architect-400" />
              </button>
            </div>
            
            {/* Инструкции */}
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" /> Формат файла Excel
                </h4>
                <p className="text-sm text-blue-600 dark:text-blue-300 mb-3">
                  Файл должен содержать таблицу со следующими колонками:
                </p>
                <div className="bg-white dark:bg-architect-900 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-blue-100 dark:bg-blue-900/50">
                        <th className="py-2 px-3 text-left font-bold text-blue-700 dark:text-blue-300 border-r border-blue-200 dark:border-blue-800">A: Наименование</th>
                        <th className="py-2 px-3 text-left font-bold text-blue-700 dark:text-blue-300 border-r border-blue-200 dark:border-blue-800">B: Ед.изм</th>
                        <th className="py-2 px-3 text-left font-bold text-blue-700 dark:text-blue-300">C: Цена</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-blue-100 dark:border-blue-800">
                        <td className="py-2 px-3 text-architect-600 dark:text-architect-400 border-r border-blue-100 dark:border-blue-800">Штукатурка по маякам</td>
                        <td className="py-2 px-3 text-architect-500 border-r border-blue-100 dark:border-blue-800">м²</td>
                        <td className="py-2 px-3 text-architect-600 dark:text-architect-400">850</td>
                      </tr>
                      <tr className="border-t border-blue-100 dark:border-blue-800">
                        <td className="py-2 px-3 text-architect-600 dark:text-architect-400 border-r border-blue-100 dark:border-blue-800">Грунтовка стен</td>
                        <td className="py-2 px-3 text-architect-500 border-r border-blue-100 dark:border-blue-800">м²</td>
                        <td className="py-2 px-3 text-architect-600 dark:text-architect-400">120</td>
                      </tr>
                      <tr className="border-t border-blue-100 dark:border-blue-800 text-architect-400">
                        <td className="py-2 px-3 border-r border-blue-100 dark:border-blue-800">...</td>
                        <td className="py-2 px-3 border-r border-blue-100 dark:border-blue-800">...</td>
                        <td className="py-2 px-3">...</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-architect-600 dark:text-architect-400">
                <p className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  Первая строка будет пропущена (заголовки)
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  Поддерживаются форматы .xlsx и .xls
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">!</span>
                  Пустые строки и строки без названия будут пропущены
                </p>
              </div>
            </div>
            
            {/* Кнопки */}
            <div className="px-6 py-4 bg-architect-50 dark:bg-architect-900/50 border-t border-architect-100 dark:border-architect-700 flex gap-3">
              <button
                onClick={() => setImportModalOpen(false)}
                className="flex-1 px-4 py-3 text-sm font-bold text-architect-600 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-xl transition-all"
              >
                Отмена
              </button>
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                />
                <span className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all w-full">
                  <Upload className="w-4 h-4" /> Выбрать файл
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для ввода ссылки на товар */}
      {urlModalData.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="px-6 py-5 border-b border-architect-100 dark:border-architect-700">
              <h3 className="font-bold text-lg dark:text-white">Ссылка на товар</h3>
              <p className="text-sm text-architect-500">Введите или вставьте ссылку на товар</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={urlModalData.currentUrl}
                  onChange={(e) => setUrlModalData(prev => ({ ...prev, currentUrl: e.target.value }))}
                  placeholder="https://..."
                  className="flex-1 px-4 py-3 border border-architect-200 dark:border-architect-600 rounded-xl bg-white dark:bg-architect-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  autoFocus
                />
                {urlModalData.currentUrl && (
                  <a
                    href={urlModalData.currentUrl.startsWith('http') ? urlModalData.currentUrl : `https://${urlModalData.currentUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 text-blue-600 rounded-xl transition-colors"
                    title="Открыть ссылку в новой вкладке"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-architect-50 dark:bg-architect-900/50 border-t border-architect-100 dark:border-architect-700 flex gap-3">
              <button
                onClick={() => setUrlModalData({ isOpen: false, currentUrl: '', onSave: () => {} })}
                className="flex-1 px-4 py-3 text-sm font-bold text-architect-600 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-xl transition-all"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  urlModalData.onSave(urlModalData.currentUrl);
                  setUrlModalData({ isOpen: false, currentUrl: '', onSave: () => {} });
                }}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для ссылки материала в общей смете */}
      {showGlobalMaterialLinkModal && globalMaterialLinkItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="px-6 py-5 border-b border-architect-100 dark:border-architect-700">
              <h3 className="font-bold text-lg dark:text-white">Ссылка на материал</h3>
              <p className="text-sm text-architect-500">{globalMaterialLinkItem.name}</p>
              <p className="text-xs text-architect-400 mt-1">Изменение применится ко всем комнатам</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={globalMaterialLinkUrl}
                  onChange={(e) => setGlobalMaterialLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-4 py-3 border border-architect-200 dark:border-architect-600 rounded-xl bg-white dark:bg-architect-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  autoFocus
                />
                {globalMaterialLinkUrl && (
                  <a
                    href={globalMaterialLinkUrl.startsWith('http') ? globalMaterialLinkUrl : `https://${globalMaterialLinkUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 text-blue-600 rounded-xl transition-colors"
                    title="Открыть ссылку в новой вкладке"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-architect-50 dark:bg-architect-900/50 border-t border-architect-100 dark:border-architect-700 flex gap-3">
              <button
                onClick={() => {
                  setShowGlobalMaterialLinkModal(false);
                  setGlobalMaterialLinkItem(null);
                  setGlobalMaterialLinkUrl('');
                }}
                className="flex-1 px-4 py-3 text-sm font-bold text-architect-600 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-xl transition-all"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  if (globalMaterialLinkItem) {
                    await handleUpdateGlobalMaterial(
                      globalMaterialLinkItem.name,
                      globalMaterialLinkItem.unit,
                      globalMaterialLinkItem.type,
                      'supplierUrl',
                      globalMaterialLinkUrl
                    );
                  }
                  setShowGlobalMaterialLinkModal(false);
                  setGlobalMaterialLinkItem(null);
                  setGlobalMaterialLinkUrl('');
                }}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all"
              >
                Сохранить во всех комнатах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
