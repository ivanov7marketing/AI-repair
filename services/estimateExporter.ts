import * as XLSX from 'xlsx';
import { Project, ExportOptions, EstimationItem, Room } from '../types';

// Константы (импортируются из App.tsx, но для экспортера делаем локальные копии)
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

const GLOBAL_ONLY_SECTIONS = ["Умный дом", "Накладные расходы"];
const WORK_SUBSECTIONS = [...ROUGH_WORK_SECTIONS, ...FINISH_WORK_SECTIONS];
const ALL_WORK_SECTIONS = [...WORK_SUBSECTIONS, ...GLOBAL_ONLY_SECTIONS];
const FINISHING_SUBCATEGORIES = ['Пол', 'Стены', 'Потолок'];
const SECTIONS_WITH_SUBCATEGORIES = ['Черновые отделочные работы', 'Чистовые отделочные работы'];

// Функция для определения подкатегории по названию
const inferSubcategoryFromName = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('пол') || lowerName.includes('пола') || lowerName.includes('полу')) {
    return 'Пол';
  } else if (lowerName.includes('потолок') || lowerName.includes('потолка') || lowerName.includes('потолку')) {
    return 'Потолок';
  } else {
    return 'Стены';
  }
};

// Подсчет суммы по типу
const calculateSubtotalByType = (items: EstimationItem[], type?: 'work' | 'rough' | 'finish'): number => {
  return items.reduce((sum, item) => {
    if (!type || item.type === type) {
      return sum + (Number(item.total) || 0);
    }
    return sum;
  }, 0);
};

// Подготовка данных для экспорта
interface ExportDataRow {
  number: number;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
  type: string;
  subcategory?: string;
  isSubcategoryHeader?: boolean;
  isSectionTotal?: boolean;
  sectionName?: string;
}

interface ExportSectionData {
  sectionName: string;
  rows: ExportDataRow[];
  workTotal: number;
  roughTotal: number;
  finishTotal: number;
  grandTotal: number;
}

interface ExportRoomData {
  roomName: string;
  sections: ExportSectionData[];
  workTotal: number;
  roughTotal: number;
  finishTotal: number;
  grandTotal: number;
}

// Подготовка данных комнаты для экспорта
function prepareRoomData(room: Room, options: ExportOptions): ExportRoomData {
  const sections: ExportSectionData[] = [];
  let roomWorkTotal = 0;
  let roomRoughTotal = 0;
  let roomFinishTotal = 0;

  if (!room.estimation) {
    return {
      roomName: room.name,
      sections: [],
      workTotal: 0,
      roughTotal: 0,
      finishTotal: 0,
      grandTotal: 0
    };
  }

  // Обрабатываем работы по секциям
  if (options.includeWorks || options.includeRoughMaterials || options.includeFinishMaterials) {
    WORK_SUBSECTIONS.forEach(sectionName => {
      const section = room.estimation?.works?.[sectionName];
      const isRoughSection = ROUGH_WORK_SECTIONS.includes(sectionName);
      
      // Check if section has any data to process
      const hasWorks = section?.items && section.items.length > 0;
      const hasRoughMaterials = isRoughSection && options.includeRoughMaterials && room.estimation?.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0;
      const hasFinishMaterials = !isRoughSection && options.includeFinishMaterials && room.estimation?.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0;
      
      // Skip section only if it has no works AND no materials to include
      if (!hasWorks && !hasRoughMaterials && !hasFinishMaterials) return;

      const rows: ExportDataRow[] = [];
      let sectionWorkTotal = 0;
      let sectionRoughTotal = 0;
      let sectionFinishTotal = 0;
      let itemCounter = 0;

      // Определяем, есть ли подкатегории для этой секции
      const hasSubcategories = SECTIONS_WITH_SUBCATEGORIES.includes(sectionName);

      if (hasSubcategories && section?.items) {
        // Группируем по подкатегориям
        FINISHING_SUBCATEGORIES.forEach(subcat => {
          const subcatItems = section.items.filter((item: EstimationItem) => {
            if (item.subcategory) return item.subcategory === subcat;
            return inferSubcategoryFromName(item.name || '') === subcat;
          });

          if (subcatItems.length === 0) return;

          // Фильтруем элементы по опциям экспорта перед добавлением заголовка
          const filteredSubcatItems: EstimationItem[] = [];
          subcatItems.forEach((item: EstimationItem) => {
            if (options.includeWorks && item.type === 'work') {
              filteredSubcatItems.push(item);
            } else if (item.type !== 'work') {
              if ((options.includeRoughMaterials && item.type === 'rough') ||
                  (options.includeFinishMaterials && item.type === 'finish')) {
                filteredSubcatItems.push(item);
              }
            }
          });

          // Добавляем заголовок подкатегории только если есть элементы для экспорта
          if (filteredSubcatItems.length === 0) return;

          // Заголовок подкатегории
          rows.push({
            number: 0,
            name: subcat,
            unit: '',
            quantity: 0,
            price: 0,
            total: 0,
            type: '',
            subcategory: subcat,
            isSubcategoryHeader: true
          });

          // Элементы подкатегории
          filteredSubcatItems.forEach((item: EstimationItem) => {
            // Process linked materials FIRST, even if works are not included
            // This ensures materials from linkedMaterials are included when only materials are selected
            if (item.linkedMaterials && (options.includeRoughMaterials || options.includeFinishMaterials)) {
              item.linkedMaterials.forEach((mat: EstimationItem) => {
                if ((options.includeRoughMaterials && mat.type === 'rough') ||
                    (options.includeFinishMaterials && mat.type === 'finish')) {
                  itemCounter++;
                  rows.push({
                    number: itemCounter,
                    name: `  └ ${mat.name || ''}`,
                    unit: mat.unit || '',
                    quantity: Number(mat.quantity) || 0,
                    price: Number(mat.price) || 0,
                    total: Number(mat.total) || 0,
                    type: mat.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.',
                    subcategory: subcat
                  });
                  if (mat.type === 'rough') {
                    sectionRoughTotal += Number(mat.total) || 0;
                  } else {
                    sectionFinishTotal += Number(mat.total) || 0;
                  }
                }
              });
            }

            // Работа
            if (options.includeWorks && item.type === 'work') {
              itemCounter++;
              rows.push({
                number: itemCounter,
                name: item.name || '',
                unit: item.unit || '',
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
                total: Number(item.total) || 0,
                type: 'Работа',
                subcategory: subcat
              });
              sectionWorkTotal += Number(item.total) || 0;
            } else if (item.type !== 'work') {
              // Отдельные материалы в секции работ (если есть)
              if ((options.includeRoughMaterials && item.type === 'rough') ||
                  (options.includeFinishMaterials && item.type === 'finish')) {
                itemCounter++;
                rows.push({
                  number: itemCounter,
                  name: item.name || '',
                  unit: item.unit || '',
                  quantity: Number(item.quantity) || 0,
                  price: Number(item.price) || 0,
                  total: Number(item.total) || 0,
                  type: item.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.',
                  subcategory: subcat
                });
                if (item.type === 'rough') {
                  sectionRoughTotal += Number(item.total) || 0;
                } else {
                  sectionFinishTotal += Number(item.total) || 0;
                }
              }
            }
          });
        });
      } else if (section?.items) {
        // Без подкатегорий - обрабатываем напрямую
        section.items.forEach((item: EstimationItem) => {
          // Process linked materials FIRST, even if works are not included
          // This ensures materials from linkedMaterials are included when only materials are selected
          if (item.linkedMaterials && (options.includeRoughMaterials || options.includeFinishMaterials)) {
            item.linkedMaterials.forEach((mat: EstimationItem) => {
              if ((options.includeRoughMaterials && mat.type === 'rough') ||
                  (options.includeFinishMaterials && mat.type === 'finish')) {
                itemCounter++;
                rows.push({
                  number: itemCounter,
                  name: `  └ ${mat.name || ''}`,
                  unit: mat.unit || '',
                  quantity: Number(mat.quantity) || 0,
                  price: Number(mat.price) || 0,
                  total: Number(mat.total) || 0,
                  type: mat.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.'
                });
                if (mat.type === 'rough') {
                  sectionRoughTotal += Number(mat.total) || 0;
                } else {
                  sectionFinishTotal += Number(mat.total) || 0;
                }
              }
            });
          }

          // Работа
          if (options.includeWorks && item.type === 'work') {
            itemCounter++;
            rows.push({
              number: itemCounter,
              name: item.name || '',
              unit: item.unit || '',
              quantity: Number(item.quantity) || 0,
              price: Number(item.price) || 0,
              total: Number(item.total) || 0,
              type: 'Работа'
            });
            sectionWorkTotal += Number(item.total) || 0;
          } else if (item.type !== 'work') {
            // Отдельные материалы
            if ((options.includeRoughMaterials && item.type === 'rough') ||
                (options.includeFinishMaterials && item.type === 'finish')) {
              itemCounter++;
              rows.push({
                number: itemCounter,
                name: item.name || '',
                unit: item.unit || '',
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
                total: Number(item.total) || 0,
                type: item.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.'
              });
              if (item.type === 'rough') {
                sectionRoughTotal += Number(item.total) || 0;
              } else {
                sectionFinishTotal += Number(item.total) || 0;
              }
            }
          }
        });
      }

      // Добавляем отдельные секции материалов (обрабатываем даже если секция работ пустая)
      if (isRoughSection && options.includeRoughMaterials && room.estimation.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0) {
        room.estimation.roughMaterials.items.forEach((mat: EstimationItem) => {
          itemCounter++;
          rows.push({
            number: itemCounter,
            name: mat.name || '',
            unit: mat.unit || '',
            quantity: Number(mat.quantity) || 0,
            price: Number(mat.price) || 0,
            total: Number(mat.total) || 0,
            type: 'Черн.мат.'
          });
          sectionRoughTotal += Number(mat.total) || 0;
        });
      }

      if (!isRoughSection && options.includeFinishMaterials && room.estimation.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0) {
        room.estimation.finishMaterials.items.forEach((mat: EstimationItem) => {
          itemCounter++;
          rows.push({
            number: itemCounter,
            name: mat.name || '',
            unit: mat.unit || '',
            quantity: Number(mat.quantity) || 0,
            price: Number(mat.price) || 0,
            total: Number(mat.total) || 0,
            type: 'Чист.мат.'
          });
          sectionFinishTotal += Number(mat.total) || 0;
        });
      }

      if (rows.length > 0) {
        // Calculate section grand total based on selected options
        let sectionGrandTotal = 0;
        if (options.includeWorks) sectionGrandTotal += sectionWorkTotal;
        if (options.includeRoughMaterials) sectionGrandTotal += sectionRoughTotal;
        if (options.includeFinishMaterials) sectionGrandTotal += sectionFinishTotal;
        
        // Итого по секции
        rows.push({
          number: 0,
          name: 'Итого по секции',
          unit: '',
          quantity: 0,
          price: 0,
          total: sectionGrandTotal,
          type: '',
          isSectionTotal: true,
          sectionName: sectionName
        });

        sections.push({
          sectionName,
          rows,
          workTotal: sectionWorkTotal,
          roughTotal: sectionRoughTotal,
          finishTotal: sectionFinishTotal,
          grandTotal: sectionGrandTotal
        });

        roomWorkTotal += sectionWorkTotal;
        roomRoughTotal += sectionRoughTotal;
        roomFinishTotal += sectionFinishTotal;
      }
    });
  }

  // Calculate room grand total based on selected options
  let roomGrandTotal = 0;
  if (options.includeWorks) roomGrandTotal += roomWorkTotal;
  if (options.includeRoughMaterials) roomGrandTotal += roomRoughTotal;
  if (options.includeFinishMaterials) roomGrandTotal += roomFinishTotal;
  
  return {
    roomName: room.name,
    sections,
    workTotal: roomWorkTotal,
    roughTotal: roomRoughTotal,
    finishTotal: roomFinishTotal,
    grandTotal: roomGrandTotal
  };
}

// Подготовка данных общей сметы (без разбивки по комнатам)
function prepareGlobalData(project: Project, options: ExportOptions): ExportSectionData[] {
  const rooms = project.analysis?.rooms || [];
  const globalWorks = project.analysis?.globalWorks || {};
  const sections: ExportSectionData[] = [];

  // Инициализируем секции
  const sectionData: Record<string, {
    items: EstimationItem[];
    workTotal: number;
    roughTotal: number;
    finishTotal: number;
  }> = {};

  ALL_WORK_SECTIONS.forEach(sectionName => {
    sectionData[sectionName] = {
      items: [],
      workTotal: 0,
      roughTotal: 0,
      finishTotal: 0
    };
  });

  // Собираем данные из всех комнат
  if (options.includeWorks || options.includeRoughMaterials || options.includeFinishMaterials) {
    rooms.forEach(room => {
      // Process room if it has works OR materials to include
      const hasWorks = room.estimation?.works;
      const hasRoughMaterials = options.includeRoughMaterials && room.estimation?.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0;
      const hasFinishMaterials = options.includeFinishMaterials && room.estimation?.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0;
      
      if (!hasWorks && !hasRoughMaterials && !hasFinishMaterials) return;

      WORK_SUBSECTIONS.forEach(sectionName => {
        const section = room.estimation.works[sectionName];
        const isRoughSection = ROUGH_WORK_SECTIONS.includes(sectionName);
        
        // Check if section has any data to process
        const hasWorksInSection = section?.items && section.items.length > 0;
        const hasRoughMaterialsInSection = isRoughSection && options.includeRoughMaterials && room.estimation?.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0;
        const hasFinishMaterialsInSection = !isRoughSection && options.includeFinishMaterials && room.estimation?.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0;
        
        // Skip section only if it has no works AND no materials to include
        if (!hasWorksInSection && !hasRoughMaterialsInSection && !hasFinishMaterialsInSection) return;

        // Process works if section exists
        if (section?.items) {
          section.items.forEach((item: EstimationItem) => {
            // Process linked materials FIRST, even if works are not included
            // This ensures materials from linkedMaterials are included when only materials are selected
            if (item.linkedMaterials && (options.includeRoughMaterials || options.includeFinishMaterials)) {
              item.linkedMaterials.forEach((mat: EstimationItem) => {
                if ((options.includeRoughMaterials && mat.type === 'rough') ||
                    (options.includeFinishMaterials && mat.type === 'finish')) {
                  const existingMat = sectionData[sectionName].items.find(
                    i => i.name === mat.name && i.unit === mat.unit && Number(i.price) === Number(mat.price) && i.type === mat.type
                  );
                  if (existingMat) {
                    existingMat.quantity = Number(existingMat.quantity) + Number(mat.quantity);
                    existingMat.total = Number(existingMat.total) + Number(mat.total);
                  } else {
                    sectionData[sectionName].items.push({
                      ...mat,
                      quantity: Number(mat.quantity),
                      total: Number(mat.total),
                      price: Number(mat.price)
                    });
                  }
                  if (mat.type === 'rough') {
                    sectionData[sectionName].roughTotal += Number(mat.total) || 0;
                  } else {
                    sectionData[sectionName].finishTotal += Number(mat.total) || 0;
                  }
                }
              });
            }

            // Работа
            if (options.includeWorks && item.type === 'work') {
              const existing = sectionData[sectionName].items.find(
                i => i.name === item.name && i.unit === item.unit && Number(i.price) === Number(item.price) && i.type === item.type
              );
              if (existing) {
                existing.quantity = Number(existing.quantity) + Number(item.quantity);
                existing.total = Number(existing.total) + Number(item.total);
              } else {
                sectionData[sectionName].items.push({
                  ...item,
                  quantity: Number(item.quantity),
                  total: Number(item.total),
                  price: Number(item.price)
                });
              }
              sectionData[sectionName].workTotal += Number(item.total) || 0;
            }
          });
        }

        // Отдельные секции материалов (обрабатываем даже если секция работ пустая)
        // ВАЖНО: Материалы из roughMaterials/finishMaterials могут дублировать материалы из linkedMaterials
        // Если материал уже есть в items (добавлен из linkedMaterials), НЕ добавляем его в roughTotal/finishTotal
        // Потому что он уже был добавлен при обработке linkedMaterials
        if (isRoughSection && options.includeRoughMaterials && room.estimation.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0) {
          room.estimation.roughMaterials.items.forEach((mat: EstimationItem) => {
            const existingMat = sectionData[sectionName].items.find(
              i => i.name === mat.name && i.unit === mat.unit && Number(i.price) === Number(mat.price) && i.type === mat.type
            );
            if (existingMat) {
              // Материал уже есть (добавлен из linkedMaterials) - обновляем количество и стоимость
              // НЕ добавляем в roughTotal, потому что он уже был добавлен при обработке linkedMaterials
              existingMat.quantity = Number(existingMat.quantity) + Number(mat.quantity);
              existingMat.total = Number(existingMat.total) + Number(mat.total);
            } else {
              // Новый материал - добавляем полностью
              sectionData[sectionName].items.push({
                ...mat,
                quantity: Number(mat.quantity),
                total: Number(mat.total),
                price: Number(mat.price)
              });
              sectionData[sectionName].roughTotal += Number(mat.total) || 0;
            }
          });
        }

        if (!isRoughSection && options.includeFinishMaterials && room.estimation.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0) {
          room.estimation.finishMaterials.items.forEach((mat: EstimationItem) => {
            const existingMat = sectionData[sectionName].items.find(
              i => i.name === mat.name && i.unit === mat.unit && Number(i.price) === Number(mat.price) && i.type === mat.type
            );
            if (existingMat) {
              // Материал уже есть (добавлен из linkedMaterials) - обновляем количество и стоимость
              // НЕ добавляем в finishTotal, потому что он уже был добавлен при обработке linkedMaterials
              existingMat.quantity = Number(existingMat.quantity) + Number(mat.quantity);
              existingMat.total = Number(existingMat.total) + Number(mat.total);
            } else {
              // Новый материал - добавляем полностью
              sectionData[sectionName].items.push({
                ...mat,
                quantity: Number(mat.quantity),
                total: Number(mat.total),
                price: Number(mat.price)
              });
              sectionData[sectionName].finishTotal += Number(mat.total) || 0;
            }
          });
        }
      });
    });

    // Глобальные секции
    GLOBAL_ONLY_SECTIONS.forEach(sectionName => {
      const section = globalWorks[sectionName];
      if (section?.items) {
        section.items.forEach((item: EstimationItem) => {
          if (options.includeWorks && item.type === 'work') {
            sectionData[sectionName].items.push({ ...item });
            sectionData[sectionName].workTotal += Number(item.total) || 0;
          } else if (options.includeRoughMaterials && item.type === 'rough') {
            sectionData[sectionName].items.push({ ...item });
            sectionData[sectionName].roughTotal += Number(item.total) || 0;
          } else if (options.includeFinishMaterials && item.type === 'finish') {
            sectionData[sectionName].items.push({ ...item });
            sectionData[sectionName].finishTotal += Number(item.total) || 0;
          }
        });
      }
    });
  }

  // Формируем строки для каждой секции
  ALL_WORK_SECTIONS.forEach(sectionName => {
    const data = sectionData[sectionName];
    if (data.items.length === 0) return;

    const rows: ExportDataRow[] = [];
    let itemCounter = 0;
    const hasSubcategories = SECTIONS_WITH_SUBCATEGORIES.includes(sectionName);

    // Используем уже установленные значения из data (они были установлены при обработке linkedMaterials и материалов из отдельных секций)
    // Не пересчитываем их из элементов, чтобы избежать двойного подсчета

    if (hasSubcategories) {
      FINISHING_SUBCATEGORIES.forEach(subcat => {
        const subcatItems = data.items.filter((item: EstimationItem) => {
          if (item.subcategory) return item.subcategory === subcat;
          return inferSubcategoryFromName(item.name || '') === subcat;
        });

        if (subcatItems.length === 0) return;

        // Фильтруем элементы по опциям экспорта перед добавлением заголовка
        const filteredSubcatItems: EstimationItem[] = [];
        subcatItems.forEach((item: EstimationItem) => {
          const isWork = item.type === 'work';
          const isRoughMaterial = item.type === 'rough';
          const isFinishMaterial = item.type === 'finish';
          
          if (isWork && options.includeWorks) {
            filteredSubcatItems.push(item);
          } else if (isRoughMaterial && options.includeRoughMaterials) {
            filteredSubcatItems.push(item);
          } else if (isFinishMaterial && options.includeFinishMaterials) {
            filteredSubcatItems.push(item);
          }
        });

        // Добавляем заголовок подкатегории только если есть элементы для экспорта
        if (filteredSubcatItems.length === 0) return;

        rows.push({
          number: 0,
          name: subcat,
          unit: '',
          quantity: 0,
          price: 0,
          total: 0,
          type: '',
          subcategory: subcat,
          isSubcategoryHeader: true
        });

        filteredSubcatItems.forEach((item: EstimationItem) => {
          const isWork = item.type === 'work';
          
          itemCounter++;
          const isLinkedMaterial = item.name?.startsWith('  └') || false;

          rows.push({
            number: itemCounter,
            name: isLinkedMaterial ? item.name : (isWork ? item.name || '' : `  └ ${item.name || ''}`),
            unit: item.unit || '',
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            total: Number(item.total) || 0,
            type: isWork ? 'Работа' : (item.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.'),
            subcategory: subcat
          });

          // Не пересчитываем - значения уже установлены в data при обработке
        });
      });
    } else {
      data.items.forEach((item: EstimationItem) => {
        // Filter items based on export options
        const isWork = item.type === 'work';
        const isRoughMaterial = item.type === 'rough';
        const isFinishMaterial = item.type === 'finish';
        
        // Skip if item type doesn't match export options
        if (isWork && !options.includeWorks) return;
        if (isRoughMaterial && !options.includeRoughMaterials) return;
        if (isFinishMaterial && !options.includeFinishMaterials) return;
        
        itemCounter++;
        const isLinkedMaterial = item.name?.startsWith('  └') || false;

        rows.push({
          number: itemCounter,
          name: isLinkedMaterial ? item.name : (isWork ? item.name || '' : `  └ ${item.name || ''}`),
          unit: item.unit || '',
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          total: Number(item.total) || 0,
          type: isWork ? 'Работа' : (item.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.')
        });

        // Не пересчитываем - значения уже установлены в data при обработке
      });
    }

    if (rows.length > 0) {
      // Используем уже установленные значения из data (они были установлены при обработке linkedMaterials и материалов из отдельных секций)
      // Calculate grand total based on selected options
      let grandTotal = 0;
      if (options.includeWorks) grandTotal += data.workTotal;
      if (options.includeRoughMaterials) grandTotal += data.roughTotal;
      if (options.includeFinishMaterials) grandTotal += data.finishTotal;
      
      rows.push({
        number: 0,
        name: 'Итого по секции',
        unit: '',
        quantity: 0,
        price: 0,
        total: grandTotal,
        type: '',
        isSectionTotal: true,
        sectionName: sectionName
      });

      sections.push({
        sectionName,
        rows,
        workTotal: data.workTotal,
        roughTotal: data.roughTotal,
        finishTotal: data.finishTotal,
        grandTotal: grandTotal
      });
    }
  });

  return sections;
}

// Создание листа для комнаты
function createRoomWorksheet(roomData: ExportRoomData, options: ExportOptions): XLSX.WorkSheet {
  const rows: any[][] = [];

  // Заголовок комнаты
  rows.push([roomData.roomName]);
  rows.push([]);

  // Заголовки таблицы
  rows.push(['№', 'Наименование', 'Ед. изм.', 'Количество', 'Цена', 'Стоимость', 'Тип']);

  // Данные по секциям
  roomData.sections.forEach(section => {
    // Заголовок секции
    rows.push([section.sectionName, '', '', '', '', '', '']);
    section.rows.forEach(row => {
      if (row.isSubcategoryHeader) {
        rows.push(['', row.name, '', '', '', '', '']);
      } else if (row.isSectionTotal) {
        rows.push(['', 'Итого по секции', '', '', '', row.total, '']);
      } else {
        rows.push([
          row.number || '',
          row.name,
          row.unit,
          row.quantity,
          row.price,
          row.total,
          row.type
        ]);
      }
    });
    rows.push([]);
  });

  // Итоги по комнате
  rows.push(['', 'ИТОГО ПО КОМНАТЕ', '', '', '', roomData.grandTotal, '']);
  if (options.includeWorks) {
    rows.push(['', '  Работы:', '', '', '', roomData.workTotal, '']);
  }
  if (options.includeRoughMaterials) {
    rows.push(['', '  Черновые материалы:', '', '', '', roomData.roughTotal, '']);
  }
  if (options.includeFinishMaterials) {
    rows.push(['', '  Чистовые материалы:', '', '', '', roomData.finishTotal, '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Форматирование
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // Ширина колонок
  ws['!cols'] = [
    { wch: 5 },   // №
    { wch: 40 },  // Наименование
    { wch: 10 },  // Ед. изм.
    { wch: 12 },  // Количество
    { wch: 12 },  // Цена
    { wch: 15 },  // Стоимость
    { wch: 12 }   // Тип
  ];

  return ws;
}

// Создание листа для секции
function createSectionWorksheet(sectionData: ExportSectionData, options: ExportOptions): XLSX.WorkSheet {
  const rows: any[][] = [];

  // Заголовок секции
  rows.push([sectionData.sectionName]);
  rows.push([]);

  // Заголовки таблицы
  rows.push(['№', 'Наименование', 'Ед. изм.', 'Количество', 'Цена', 'Стоимость', 'Тип']);

  // Данные
  sectionData.rows.forEach(row => {
    if (row.isSubcategoryHeader) {
      rows.push(['', row.name, '', '', '', '', '']);
    } else if (row.isSectionTotal) {
      rows.push(['', 'Итого по секции', '', '', '', row.total, '']);
    } else {
      rows.push([
        row.number || '',
        row.name,
        row.unit,
        row.quantity,
        row.price,
        row.total,
        row.type
      ]);
    }
  });

  // Итоги по секции
  rows.push([]);
  rows.push(['', 'ИТОГО ПО СЕКЦИИ', '', '', '', sectionData.grandTotal, '']);
  if (options.includeWorks) {
    rows.push(['', '  Работы:', '', '', '', sectionData.workTotal, '']);
  }
  if (options.includeRoughMaterials) {
    rows.push(['', '  Черновые материалы:', '', '', '', sectionData.roughTotal, '']);
  }
  if (options.includeFinishMaterials) {
    rows.push(['', '  Чистовые материалы:', '', '', '', sectionData.finishTotal, '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ширина колонок
  ws['!cols'] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 }
  ];

  return ws;
}

// Создание итогового листа
function createTotalsWorksheet(data: { rooms?: ExportRoomData[], sections?: ExportSectionData[] }, options: ExportOptions): XLSX.WorkSheet {
  const rows: any[][] = [];

  rows.push(['ИТОГОВАЯ СМЕТА']);
  rows.push([]);

  let totalWork = 0;
  let totalRough = 0;
  let totalFinish = 0;

  if (data.rooms) {
    // Режим разбивки по комнатам
    rows.push(['Комната', 'Работы', 'Черновые материалы', 'Чистовые материалы', 'Итого']);
    
    data.rooms.forEach(room => {
      // Calculate room grand total based on selected options
      let roomGrandTotal = 0;
      if (options.includeWorks) roomGrandTotal += room.workTotal;
      if (options.includeRoughMaterials) roomGrandTotal += room.roughTotal;
      if (options.includeFinishMaterials) roomGrandTotal += room.finishTotal;
      
      rows.push([
        room.roomName,
        options.includeWorks ? room.workTotal : 0,
        options.includeRoughMaterials ? room.roughTotal : 0,
        options.includeFinishMaterials ? room.finishTotal : 0,
        roomGrandTotal
      ]);
      totalWork += room.workTotal;
      totalRough += room.roughTotal;
      totalFinish += room.finishTotal;
    });
  } else if (data.sections) {
    // Режим общей сметы
    rows.push(['Секция', 'Работы', 'Черновые материалы', 'Чистовые материалы', 'Итого']);
    
    data.sections.forEach(section => {
      // Calculate section grand total based on selected options
      let sectionGrandTotal = 0;
      if (options.includeWorks) sectionGrandTotal += section.workTotal;
      if (options.includeRoughMaterials) sectionGrandTotal += section.roughTotal;
      if (options.includeFinishMaterials) sectionGrandTotal += section.finishTotal;
      
      rows.push([
        section.sectionName,
        options.includeWorks ? section.workTotal : 0,
        options.includeRoughMaterials ? section.roughTotal : 0,
        options.includeFinishMaterials ? section.finishTotal : 0,
        sectionGrandTotal
      ]);
      totalWork += section.workTotal;
      totalRough += section.roughTotal;
      totalFinish += section.finishTotal;
    });
  }

  rows.push([]);
  // Calculate grand total based on selected options
  let grandTotal = 0;
  if (options.includeWorks) grandTotal += totalWork;
  if (options.includeRoughMaterials) grandTotal += totalRough;
  if (options.includeFinishMaterials) grandTotal += totalFinish;
  
  rows.push(['ОБЩИЙ ИТОГ', 
    options.includeWorks ? totalWork : 0, 
    options.includeRoughMaterials ? totalRough : 0, 
    options.includeFinishMaterials ? totalFinish : 0, 
    grandTotal]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ширина колонок
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 }
  ];

  return ws;
}

// Главная функция экспорта
export function exportEstimateToXLSX(project: Project, options: ExportOptions): void {
  const workbook = XLSX.utils.book_new();

  if (options.groupByRooms) {
    // Режим разбивки по комнатам
    const rooms = project.analysis?.rooms || [];
    const roomDataList: ExportRoomData[] = [];

    rooms.forEach(room => {
      const roomData = prepareRoomData(room, options);
      if (roomData.sections.length > 0) {
        roomDataList.push(roomData);
        const ws = createRoomWorksheet(roomData, options);
        // Ограничиваем длину имени листа до 31 символа (ограничение Excel)
        const sheetName = room.name.length > 31 ? room.name.substring(0, 31) : room.name;
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      }
    });

    // Проверяем, есть ли данные для экспорта
    if (roomDataList.length === 0) {
      throw new Error('Нет данных для экспорта. Убедитесь, что выбраны правильные типы данных (Работы, Черновые материалы, Чистовые материалы).');
    }

    // Итоговый лист
    const totalsWs = createTotalsWorksheet({ rooms: roomDataList }, options);
    XLSX.utils.book_append_sheet(workbook, totalsWs, 'Итого');
  } else {
    // Режим общей сметы
    const sections = prepareGlobalData(project, options);

    // Проверяем, есть ли данные для экспорта
    if (sections.length === 0) {
      throw new Error('Нет данных для экспорта. Убедитесь, что выбраны правильные типы данных (Работы, Черновые материалы, Чистовые материалы).');
    }

    sections.forEach(section => {
      const ws = createSectionWorksheet(section, options);
      // Ограничиваем длину имени листа
      const sheetName = section.sectionName.length > 31 ? section.sectionName.substring(0, 31) : section.sectionName;
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });

    // Итоговый лист
    const totalsWs = createTotalsWorksheet({ sections }, options);
    XLSX.utils.book_append_sheet(workbook, totalsWs, 'Итого');
  }

  // Скачивание файла
  try {
    const fileName = `${project.name}_смета.xlsx`.replace(/[<>:"/\\|?*]/g, '_');
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error('Error writing XLSX file:', error);
    throw new Error('Ошибка при создании файла Excel. Проверьте данные для экспорта.');
  }
}

