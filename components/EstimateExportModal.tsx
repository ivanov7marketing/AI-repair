import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { ExportOptions } from '../types';

interface EstimateExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

export const EstimateExportModal: React.FC<EstimateExportModalProps> = ({
  isOpen,
  onClose,
  onExport
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    includeWorks: true,
    includeRoughMaterials: false,
    includeFinishMaterials: false,
    groupByRooms: false,
    format: 'xlsx'
  });

  if (!isOpen) return null;

  const handleCheckboxChange = (field: keyof ExportOptions) => {
    setOptions(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleFormatChange = (format: 'xlsx' | 'pdf') => {
    setOptions(prev => ({ ...prev, format }));
  };

  const handleExport = () => {
    // Валидация: минимум один чекбокс должен быть отмечен
    if (!options.includeWorks && !options.includeRoughMaterials && !options.includeFinishMaterials) {
      alert('Выберите хотя бы один пункт для экспорта');
      return;
    }
    onExport(options);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-architect-100 dark:border-architect-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
              <Download className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-bold dark:text-white">Экспорт сметы</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-architect-500" />
          </button>
        </div>

        {/* Содержимое */}
        <div className="p-6 space-y-6">
          {/* Чекбоксы содержания */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-architect-700 dark:text-architect-300 mb-2 block">
              Содержание сметы:
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-900/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={options.includeWorks}
                onChange={() => handleCheckboxChange('includeWorks')}
                className="w-5 h-5 text-purple-600 border-architect-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <span className="text-sm text-architect-800 dark:text-architect-200">Работы</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-900/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={options.includeRoughMaterials}
                onChange={() => handleCheckboxChange('includeRoughMaterials')}
                className="w-5 h-5 text-purple-600 border-architect-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <span className="text-sm text-architect-800 dark:text-architect-200">Черновые материалы</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-900/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={options.includeFinishMaterials}
                onChange={() => handleCheckboxChange('includeFinishMaterials')}
                className="w-5 h-5 text-purple-600 border-architect-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <span className="text-sm text-architect-800 dark:text-architect-200">Чистовые материалы</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-900/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={options.groupByRooms}
                onChange={() => handleCheckboxChange('groupByRooms')}
                className="w-5 h-5 text-purple-600 border-architect-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <span className="text-sm text-architect-800 dark:text-architect-200">Разбить по комнатам</span>
            </label>
          </div>

          {/* Радиокнопки формата */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-architect-700 dark:text-architect-300 mb-2 block">
              Формат файла:
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-900/50 cursor-pointer transition-colors border-2 border-transparent has-[:checked]:border-purple-500 dark:has-[:checked]:border-purple-400">
              <input
                type="radio"
                name="format"
                value="xlsx"
                checked={options.format === 'xlsx'}
                onChange={() => handleFormatChange('xlsx')}
                className="w-5 h-5 text-purple-600 border-architect-300 focus:ring-purple-500 focus:ring-2"
              />
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <span className="text-sm text-architect-800 dark:text-architect-200">Excel (XLSX)</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-900/50 cursor-pointer transition-colors border-2 border-transparent has-[:checked]:border-purple-500 dark:has-[:checked]:border-purple-400">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={options.format === 'pdf'}
                onChange={() => handleFormatChange('pdf')}
                className="w-5 h-5 text-purple-600 border-architect-300 focus:ring-purple-500 focus:ring-2"
              />
              <FileText className="w-5 h-5 text-red-600" />
              <span className="text-sm text-architect-800 dark:text-architect-200">PDF</span>
            </label>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-architect-100 dark:border-architect-700 bg-architect-50 dark:bg-architect-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-architect-700 dark:text-architect-300 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleExport}
            className="px-6 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Экспортировать
          </button>
        </div>
      </div>
    </div>
  );
};

