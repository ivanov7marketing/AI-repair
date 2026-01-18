import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Deal, User, DealSource } from '../../types';
import { api } from '../../services/api';

interface DealFormProps {
  deal?: Deal;
  onClose: () => void;
  onSave: (deal: Deal) => void;
  users: User[];
  sources: DealSource[];
}

export const DealForm: React.FC<DealFormProps> = ({ deal, onClose, onSave, users, sources }) => {
  const [formData, setFormData] = useState({
    leadName: deal?.leadName || '',
    phone: deal?.phone || '',
    email: deal?.email || '',
    telegram: deal?.telegram || '',
    whatsapp: deal?.whatsapp || '',
    sourceId: deal?.sourceId || '',
    responsibleManagerId: deal?.responsibleManagerId || '',
    leadTemperature: deal?.leadTemperature || 'warm',
    address: deal?.address || '',
    buildingType: deal?.buildingType || '',
    area: deal?.area?.toString() || '',
    roomsCount: deal?.roomsCount || '',
    repairType: deal?.repairType || '',
    budgetFrom: deal?.budgetFrom?.toString() || '',
    budgetTo: deal?.budgetTo?.toString() || '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        ...formData,
        area: formData.area ? parseFloat(formData.area) : null,
        budgetFrom: formData.budgetFrom ? parseFloat(formData.budgetFrom) : null,
        budgetTo: formData.budgetTo ? parseFloat(formData.budgetTo) : null,
        sourceId: formData.sourceId || null,
        responsibleManagerId: formData.responsibleManagerId || null,
        email: formData.email || null,
        telegram: formData.telegram || null,
        whatsapp: formData.whatsapp || null,
      };

      let savedDeal;
      if (deal) {
        savedDeal = await api.updateDeal(deal.id, data);
      } else {
        savedDeal = await api.createDeal(data);
      }

      onSave(savedDeal);
      onClose();
    } catch (error: any) {
      alert(error.message || 'Ошибка при сохранении сделки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
            {deal ? 'Редактировать сделку' : 'Новая сделка'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ФИО клиента *</label>
              <input
                type="text"
                required
                value={formData.leadName}
                onChange={(e) => setFormData({ ...formData, leadName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Телефон *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Источник</label>
              <select
                value={formData.sourceId}
                onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              >
                <option value="">Выберите источник</option>
                {sources.filter(s => s.isActive).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.icon} {source.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ответственный менеджер</label>
              <select
                value={formData.responsibleManagerId}
                onChange={(e) => setFormData({ ...formData, responsibleManagerId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              >
                <option value="">Выберите менеджера</option>
                {users.filter(u => u.role === 'manager' || u.role === 'admin').map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Температура лида</label>
              <select
                value={formData.leadTemperature}
                onChange={(e) => setFormData({ ...formData, leadTemperature: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              >
                <option value="hot">🔥 Горячий</option>
                <option value="warm">🌡️ Теплый</option>
                <option value="cold">❄️ Холодный</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Адрес</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Тип ремонта</label>
              <input
                type="text"
                value={formData.repairType}
                onChange={(e) => setFormData({ ...formData, repairType: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Площадь (м²)</label>
              <input
                type="number"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Бюджет от (₽)</label>
              <input
                type="number"
                value={formData.budgetFrom}
                onChange={(e) => setFormData({ ...formData, budgetFrom: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Бюджет до (₽)</label>
              <input
                type="number"
                value={formData.budgetTo}
                onChange={(e) => setFormData({ ...formData, budgetTo: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
