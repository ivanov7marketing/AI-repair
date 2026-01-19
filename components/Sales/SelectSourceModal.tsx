import React from 'react';
import { X } from 'lucide-react';

interface SelectSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (sourceName: string) => void;
}

const AVAILABLE_SOURCES = [
  { name: 'Сайт', icon: '🌐' },
  { name: 'Авито', icon: '🏠' },
  { name: 'ВКонтакте', icon: '🔵' },
  { name: 'Телеграм', icon: '✈️' },
  { name: 'Телефония', icon: '☎️' },
  { name: 'Email', icon: '📧' },
];

export const SelectSourceModal: React.FC<SelectSourceModalProps> = ({ 
  isOpen, 
  onClose,
  onSelectSource 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
            Источники сделок
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-4">
            {AVAILABLE_SOURCES.map((source) => (
              <button
                key={source.name}
                onClick={() => {
                  onSelectSource(source.name);
                  onClose();
                }}
                className="flex flex-col items-center justify-center p-6 bg-white dark:bg-architect-900 border border-architect-200 dark:border-architect-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="text-4xl mb-3">{source.icon}</div>
                <div className="text-sm font-medium text-architect-900 dark:text-architect-100 mb-2">
                  {source.name}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  + Добавить
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
