import React from 'react';
import { X } from 'lucide-react';

interface DuplicateControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export const DuplicateControlModal: React.FC<DuplicateControlModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
            Настройка контроля дублей
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center text-architect-600 dark:text-architect-400 py-8">
            Тут можно будет настроить правила проверки входящей заявки на дубль
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-architect-200 dark:border-architect-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 text-architect-700 dark:text-architect-300"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              if (onSave) onSave();
              onClose();
            }}
            className="px-4 py-2 text-sm bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 font-medium"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
