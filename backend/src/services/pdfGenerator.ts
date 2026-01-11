import puppeteer from 'puppeteer';

// Project interface (simplified for PDF generation)
interface Project {
  id: string;
  name: string;
  analysis?: {
    rooms?: any[];
    globalWorks?: Record<string, any>;
  } | null;
}

interface ExportOptions {
  includeWorks: boolean;
  includeRoughMaterials: boolean;
  includeFinishMaterials: boolean;
  groupByRooms: boolean;
  format: 'xlsx' | 'pdf';
}

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

// Константы
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

// Функция для определения подкатегории
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

// Функция для округления вверх до 1 знака после запятой
const roundUpToOneDecimal = (value: number): number => {
  return Math.ceil(value * 10) / 10;
};

// Подготовка данных комнаты для PDF
function prepareRoomDataForPDF(room: any, options: ExportOptions): ExportRoomData {
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

    const hasSubcategories = SECTIONS_WITH_SUBCATEGORIES.includes(sectionName);

    if (hasSubcategories && section?.items) {
      FINISHING_SUBCATEGORIES.forEach(subcat => {
        const subcatItems = section.items.filter((item: any) => {
          if (item.subcategory) return item.subcategory === subcat;
          return inferSubcategoryFromName(item.name || '') === subcat;
        });

        if (subcatItems.length === 0) return;

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

        subcatItems.forEach((item: any) => {
          if (options.includeWorks && item.type === 'work') {
            itemCounter++;
            rows.push({
              number: itemCounter,
              name: item.name || '',
              unit: item.unit || '',
              quantity: roundUpToOneDecimal(Number(item.quantity) || 0),
              price: Number(item.price) || 0,
              total: Number(item.total) || 0,
              type: 'Работа',
              subcategory: subcat
            });
            sectionWorkTotal += Number(item.total) || 0;

            if (item.linkedMaterials) {
              item.linkedMaterials.forEach((mat: any) => {
                if ((options.includeRoughMaterials && mat.type === 'rough') ||
                    (options.includeFinishMaterials && mat.type === 'finish')) {
                  itemCounter++;
                  rows.push({
                    number: itemCounter,
                    name: `└ ${mat.name || ''}`,
                    unit: mat.unit || '',
                    quantity: roundUpToOneDecimal(Number(mat.quantity) || 0),
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
          } else if (item.type !== 'work') {
            if ((options.includeRoughMaterials && item.type === 'rough') ||
                (options.includeFinishMaterials && item.type === 'finish')) {
              itemCounter++;
              rows.push({
                number: itemCounter,
                name: item.name || '',
                unit: item.unit || '',
                quantity: roundUpToOneDecimal(Number(item.quantity) || 0),
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
      section.items.forEach((item: any) => {
        if (options.includeWorks && item.type === 'work') {
          itemCounter++;
          rows.push({
            number: itemCounter,
            name: item.name || '',
            unit: item.unit || '',
            quantity: roundUpToOneDecimal(Number(item.quantity) || 0),
            price: Number(item.price) || 0,
            total: Number(item.total) || 0,
            type: 'Работа'
          });
          sectionWorkTotal += Number(item.total) || 0;

          if (item.linkedMaterials) {
            item.linkedMaterials.forEach((mat: any) => {
              if ((options.includeRoughMaterials && mat.type === 'rough') ||
                  (options.includeFinishMaterials && mat.type === 'finish')) {
                itemCounter++;
                rows.push({
                  number: itemCounter,
                  name: `└ ${mat.name || ''}`,
                  unit: mat.unit || '',
                  quantity: roundUpToOneDecimal(Number(mat.quantity) || 0),
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
        } else if (item.type !== 'work') {
          if ((options.includeRoughMaterials && item.type === 'rough') ||
              (options.includeFinishMaterials && item.type === 'finish')) {
            itemCounter++;
            rows.push({
              number: itemCounter,
              name: item.name || '',
              unit: item.unit || '',
              quantity: roundUpToOneDecimal(Number(item.quantity) || 0),
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

    // Отдельные секции материалов (обрабатываем даже если секция работ пустая)
    if (isRoughSection && options.includeRoughMaterials && room.estimation.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0) {
      room.estimation.roughMaterials.items.forEach((mat: any) => {
        itemCounter++;
        rows.push({
          number: itemCounter,
          name: mat.name || '',
          unit: mat.unit || '',
          quantity: roundUpToOneDecimal(Number(mat.quantity) || 0),
          price: Number(mat.price) || 0,
          total: Number(mat.total) || 0,
          type: 'Черн.мат.'
        });
        sectionRoughTotal += Number(mat.total) || 0;
      });
    }

    if (!isRoughSection && options.includeFinishMaterials && room.estimation.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0) {
      room.estimation.finishMaterials.items.forEach((mat: any) => {
        itemCounter++;
        rows.push({
          number: itemCounter,
          name: mat.name || '',
          unit: mat.unit || '',
          quantity: roundUpToOneDecimal(Number(mat.quantity) || 0),
          price: Number(mat.price) || 0,
          total: Number(mat.total) || 0,
          type: 'Чист.мат.'
        });
        sectionFinishTotal += Number(mat.total) || 0;
      });
    }

    // Добавляем секцию если есть работы ИЛИ материалы
    if (rows.length > 0) {
      rows.push({
        number: 0,
        name: 'Итого по секции',
        unit: '',
        quantity: 0,
        price: 0,
        total: sectionWorkTotal + sectionRoughTotal + sectionFinishTotal,
        type: '',
        isSectionTotal: true
      });

      sections.push({
        sectionName,
        rows,
        workTotal: sectionWorkTotal,
        roughTotal: sectionRoughTotal,
        finishTotal: sectionFinishTotal,
        grandTotal: sectionWorkTotal + sectionRoughTotal + sectionFinishTotal
      });

      roomWorkTotal += sectionWorkTotal;
      roomRoughTotal += sectionRoughTotal;
      roomFinishTotal += sectionFinishTotal;
    }
  });

  return {
    roomName: room.name,
    sections,
    workTotal: roomWorkTotal,
    roughTotal: roomRoughTotal,
    finishTotal: roomFinishTotal,
    grandTotal: roomWorkTotal + roomRoughTotal + roomFinishTotal
  };
}

// Подготовка данных общей сметы для PDF
function prepareGlobalDataForPDF(project: Project, options: ExportOptions): ExportSectionData[] {
  const rooms = project.analysis?.rooms || [];
  const globalWorks = project.analysis?.globalWorks || {};
  const sections: ExportSectionData[] = [];

  const sectionData: Record<string, {
    items: any[];
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
        const hasWorks = section?.items && section.items.length > 0;
        const hasRoughMaterials = isRoughSection && options.includeRoughMaterials && room.estimation?.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0;
        const hasFinishMaterials = !isRoughSection && options.includeFinishMaterials && room.estimation?.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0;
        
        // Skip section only if it has no works AND no materials to include
        if (!hasWorks && !hasRoughMaterials && !hasFinishMaterials) return;

        // Process works if section exists
        if (section?.items) {
          section.items.forEach((item: any) => {
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

            if (item.linkedMaterials) {
              item.linkedMaterials.forEach((mat: any) => {
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
                }
              });
            }
          }
          });
        }

        // Add materials from roughMaterials/finishMaterials even if section is empty
        if (isRoughSection && options.includeRoughMaterials && room.estimation.roughMaterials?.items && room.estimation.roughMaterials.items.length > 0) {
          room.estimation.roughMaterials.items.forEach((mat: any) => {
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
          });
        }

        if (!isRoughSection && options.includeFinishMaterials && room.estimation.finishMaterials?.items && room.estimation.finishMaterials.items.length > 0) {
          room.estimation.finishMaterials.items.forEach((mat: any) => {
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
          });
        }
      });
    });

    GLOBAL_ONLY_SECTIONS.forEach(sectionName => {
      const section = globalWorks[sectionName];
      if (section?.items && options.includeWorks) {
        section.items.forEach((item: any) => {
          if (item.type === 'work') {
            sectionData[sectionName].items.push({ ...item });
          }
        });
      }
    });
  }

  ALL_WORK_SECTIONS.forEach(sectionName => {
    const data = sectionData[sectionName];
    if (data.items.length === 0) return;

    const rows: ExportDataRow[] = [];
    let itemCounter = 0;
    const hasSubcategories = SECTIONS_WITH_SUBCATEGORIES.includes(sectionName);

    if (hasSubcategories) {
      FINISHING_SUBCATEGORIES.forEach(subcat => {
        const subcatItems = data.items.filter((item: any) => {
          if (item.subcategory) return item.subcategory === subcat;
          return inferSubcategoryFromName(item.name || '') === subcat;
        });

        if (subcatItems.length === 0) return;

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

        subcatItems.forEach((item: any) => {
          itemCounter++;
          const isWork = item.type === 'work';

          rows.push({
            number: itemCounter,
            name: isWork ? item.name || '' : `└ ${item.name || ''}`,
            unit: item.unit || '',
            quantity: roundUpToOneDecimal(Number(item.quantity) || 0),
            price: Number(item.price) || 0,
            total: Number(item.total) || 0,
            type: isWork ? 'Работа' : (item.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.'),
            subcategory: subcat
          });

          if (item.type === 'work') {
            data.workTotal += Number(item.total) || 0;
          } else if (item.type === 'rough') {
            data.roughTotal += Number(item.total) || 0;
          } else {
            data.finishTotal += Number(item.total) || 0;
          }
        });
      });
    } else {
      data.items.forEach((item: any) => {
        itemCounter++;
        const isWork = item.type === 'work';

        rows.push({
          number: itemCounter,
          name: isWork ? item.name || '' : `└ ${item.name || ''}`,
          unit: item.unit || '',
          quantity: roundUpToOneDecimal(Number(item.quantity) || 0),
          price: Number(item.price) || 0,
          total: Number(item.total) || 0,
          type: isWork ? 'Работа' : (item.type === 'rough' ? 'Черн.мат.' : 'Чист.мат.')
        });

        if (item.type === 'work') {
          data.workTotal += Number(item.total) || 0;
        } else if (item.type === 'rough') {
          data.roughTotal += Number(item.total) || 0;
        } else {
          data.finishTotal += Number(item.total) || 0;
        }
      });
    }

    if (rows.length > 0) {
      rows.push({
        number: 0,
        name: 'Итого по секции',
        unit: '',
        quantity: 0,
        price: 0,
        total: data.workTotal + data.roughTotal + data.finishTotal,
        type: '',
        isSectionTotal: true
      });

      sections.push({
        sectionName,
        rows,
        workTotal: data.workTotal,
        roughTotal: data.roughTotal,
        finishTotal: data.finishTotal,
        grandTotal: data.workTotal + data.roughTotal + data.finishTotal
      });
    }
  });

  return sections;
}

// Генерация HTML для PDF
function generatePDFHTML(project: Project, options: ExportOptions): string {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20mm; font-size: 10pt; }
    h1 { font-size: 18pt; margin-bottom: 10px; text-align: center; }
    h2 { font-size: 14pt; margin-top: 15px; margin-bottom: 8px; background-color: #f0f0f0; padding: 5px; }
    h3 { font-size: 12pt; margin-top: 10px; margin-bottom: 5px; padding: 3px; background-color: #e0e0e0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: avoid; }
    th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 6px; text-align: left; font-weight: bold; }
    td { border: 1px solid #ddd; padding: 5px; }
    .number { text-align: center; width: 30px; }
    .name { width: 40%; }
    .unit { text-align: center; width: 60px; }
    .quantity { text-align: right; width: 70px; }
    .price { text-align: right; width: 80px; }
    .total { text-align: right; width: 100px; font-weight: bold; }
    .type { text-align: center; width: 80px; }
    .subcategory-header { background-color: #e8e8e8; font-weight: bold; }
    .section-total { background-color: #f9f9f9; font-weight: bold; }
    .room-section { page-break-before: always; margin-top: 20px; }
    .room-section:first-child { page-break-before: auto; }
    .totals { margin-top: 20px; padding: 10px; background-color: #f0f0f0; border: 2px solid #333; }
    .grand-total { font-size: 14pt; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Смета проекта: ${project.name}</h1>
  <p style="text-align: center; margin-bottom: 20px;">Дата формирования: ${new Date().toLocaleDateString('ru-RU')}</p>
`;

  if (options.groupByRooms) {
    const rooms = project.analysis?.rooms || [];
    let grandTotalWork = 0;
    let grandTotalRough = 0;
    let grandTotalFinish = 0;

    rooms.forEach((room, roomIndex) => {
      const roomData = prepareRoomDataForPDF(room, options);
      if (roomData.sections.length === 0) return;

      html += `<div class="room-section">`;
      html += `<h2>${roomData.roomName}</h2>`;

      roomData.sections.forEach(section => {
        html += `<h3>${section.sectionName}</h3>`;
        html += `<table>`;
        html += `<thead><tr>
          <th class="number">№</th>
          <th class="name">Наименование</th>
          <th class="unit">Ед. изм.</th>
          <th class="quantity">Кол-во</th>
          <th class="price">Цена</th>
          <th class="total">Стоимость</th>
          <th class="type">Тип</th>
        </tr></thead><tbody>`;

        section.rows.forEach(row => {
          if (row.isSubcategoryHeader) {
            html += `<tr class="subcategory-header"><td colspan="7">${row.name}</td></tr>`;
          } else if (row.isSectionTotal) {
            html += `<tr class="section-total">
              <td colspan="5">Итого по секции</td>
              <td class="total">${row.total.toLocaleString('ru-RU')} р.</td>
              <td></td>
            </tr>`;
          } else {
            html += `<tr>
              <td class="number">${row.number || ''}</td>
              <td class="name">${row.name}</td>
              <td class="unit">${row.unit}</td>
              <td class="quantity">${Number(row.quantity).toFixed(1)}</td>
              <td class="price">${row.price.toLocaleString('ru-RU')} р.</td>
              <td class="total">${row.total.toLocaleString('ru-RU')} р.</td>
              <td class="type">${row.type}</td>
            </tr>`;
          }
        });

        html += `</tbody></table>`;
      });

      html += `<div class="totals">`;
      html += `<p><strong>Итого по комнате "${roomData.roomName}":</strong></p>`;
      if (options.includeWorks) {
        html += `<p>Работы: ${roomData.workTotal.toLocaleString('ru-RU')} р.</p>`;
      }
      if (options.includeRoughMaterials) {
        html += `<p>Черновые материалы: ${roomData.roughTotal.toLocaleString('ru-RU')} р.</p>`;
      }
      if (options.includeFinishMaterials) {
        html += `<p>Чистовые материалы: ${roomData.finishTotal.toLocaleString('ru-RU')} р.</p>`;
      }
      html += `<p class="grand-total">Общий итог: ${roomData.grandTotal.toLocaleString('ru-RU')} р.</p>`;
      html += `</div>`;

      html += `</div>`;

      grandTotalWork += roomData.workTotal;
      grandTotalRough += roomData.roughTotal;
      grandTotalFinish += roomData.finishTotal;
    });

    html += `<div class="totals grand-total" style="page-break-before: always;">`;
    html += `<h2>ОБЩИЙ ИТОГ</h2>`;
    if (options.includeWorks) {
      html += `<p>Работы: ${grandTotalWork.toLocaleString('ru-RU')} р.</p>`;
    }
    if (options.includeRoughMaterials) {
      html += `<p>Черновые материалы: ${grandTotalRough.toLocaleString('ru-RU')} р.</p>`;
    }
    if (options.includeFinishMaterials) {
      html += `<p>Чистовые материалы: ${grandTotalFinish.toLocaleString('ru-RU')} р.</p>`;
    }
    html += `<p class="grand-total">Общий итог: ${(grandTotalWork + grandTotalRough + grandTotalFinish).toLocaleString('ru-RU')} р.</p>`;
    html += `</div>`;
  } else {
    const sections = prepareGlobalDataForPDF(project, options);
    let grandTotalWork = 0;
    let grandTotalRough = 0;
    let grandTotalFinish = 0;

    sections.forEach(section => {
      html += `<h2>${section.sectionName}</h2>`;
      html += `<table>`;
      html += `<thead><tr>
        <th class="number">№</th>
        <th class="name">Наименование</th>
        <th class="unit">Ед. изм.</th>
        <th class="quantity">Кол-во</th>
        <th class="price">Цена</th>
        <th class="total">Стоимость</th>
        <th class="type">Тип</th>
      </tr></thead><tbody>`;

      section.rows.forEach(row => {
        if (row.isSubcategoryHeader) {
          html += `<tr class="subcategory-header"><td colspan="7">${row.name}</td></tr>`;
        } else if (row.isSectionTotal) {
          html += `<tr class="section-total">
            <td colspan="5">Итого по секции</td>
            <td class="total">${row.total.toLocaleString('ru-RU')} р.</td>
            <td></td>
          </tr>`;
        } else {
          html += `<tr>
            <td class="number">${row.number || ''}</td>
            <td class="name">${row.name}</td>
            <td class="unit">${row.unit}</td>
            <td class="quantity">${row.quantity}</td>
            <td class="price">${row.price.toLocaleString('ru-RU')} р.</td>
            <td class="total">${row.total.toLocaleString('ru-RU')} р.</td>
            <td class="type">${row.type}</td>
          </tr>`;
        }
      });

      html += `</tbody></table>`;
      html += `<p><strong>Итого по секции "${section.sectionName}": ${section.grandTotal.toLocaleString('ru-RU')} р.</strong></p>`;
      html += `<br/>`;

      grandTotalWork += section.workTotal;
      grandTotalRough += section.roughTotal;
      grandTotalFinish += section.finishTotal;
    });

    html += `<div class="totals grand-total" style="page-break-before: always;">`;
    html += `<h2>ОБЩИЙ ИТОГ</h2>`;
    if (options.includeWorks) {
      html += `<p>Работы: ${grandTotalWork.toLocaleString('ru-RU')} р.</p>`;
    }
    if (options.includeRoughMaterials) {
      html += `<p>Черновые материалы: ${grandTotalRough.toLocaleString('ru-RU')} р.</p>`;
    }
    if (options.includeFinishMaterials) {
      html += `<p>Чистовые материалы: ${grandTotalFinish.toLocaleString('ru-RU')} р.</p>`;
    }
    html += `<p class="grand-total">Общий итог: ${(grandTotalWork + grandTotalRough + grandTotalFinish).toLocaleString('ru-RU')} р.</p>`;
    html += `</div>`;
  }

  html += `
</body>
</html>`;

  return html;
}

// Экспортируем функцию для использования в routes
export { generatePDFHTML };

// Генерация PDF через Puppeteer
export async function generatePDF(project: Project, options: ExportOptions): Promise<Buffer> {
  const html = generatePDFHTML(project, options);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '10mm',
        right: '8mm',
        bottom: '10mm',
        left: '8mm'
      },
      printBackground: true,
      preferCSSPageSize: false
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

