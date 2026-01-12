import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';

interface ToolFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export const ToolForm: React.FC<ToolFormProps> = ({ onClose, onSuccess, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    inventoryNumber: initialData?.inventoryNumber || '',
    name: initialData?.name || '',
    brand: initialData?.brand || '',
    model: initialData?.model || '',
    category: initialData?.category || '',
    photo: initialData?.photo || '',
    purchaseDate: initialData?.purchaseDate || '',
    purchasePrice: initialData?.purchasePrice || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.inventoryNumber || !formData.name) {
      alert('Заполните обязательные поля');
      return;
    }

    try {
      setLoading(true);
      // Prepare data: convert empty strings to null for optional fields
      const dataToSend = {
        inventoryNumber: formData.inventoryNumber,
        name: formData.name,
        brand: formData.brand?.trim() || null,
        model: formData.model?.trim() || null,
        category: formData.category || null,
        photo: formData.photo?.trim() || null,
        purchaseDate: formData.purchaseDate || null,
        purchasePrice: formData.purchasePrice > 0 ? formData.purchasePrice : null,
      };

      if (initialData) {
        await api.updateTool(initialData.id, dataToSend);
      } else {
        await api.createTool(dataToSend);
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Tool save error:', error);
      const errorMessage = error.details 
        ? `Ошибка валидации: ${JSON.stringify(error.details)}`
        : (error.message || 'Не удалось сохранить инструмент');
      alert('Ошибка: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-architect-800 border-b border-architect-200 dark:border-architect-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-architect-900 dark:text-white">
            {initialData ? 'Редактировать инструмент' : 'Новый инструмент'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-architect-600 dark:text-architect-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Инвентарный номер *
              </label>
              <input
                type="text"
                value={formData.inventoryNumber}
                onChange={(e) => setFormData({ ...formData, inventoryNumber: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Название *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Бренд
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Модель
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Категория
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              >
                <option value="">Выберите категорию</option>
                <option value="электроинструмент">Электроинструмент</option>
                <option value="ручной">Ручной</option>
                <option value="измерительный">Измерительный</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Дата покупки
              </label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Стоимость покупки
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Фото (URL)
              </label>
              <input
                type="url"
                value={formData.photo}
                onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-architect-200 dark:border-architect-700">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-architect-200 dark:bg-architect-700 text-architect-900 dark:text-white rounded-lg hover:bg-architect-300 dark:hover:bg-architect-600 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
