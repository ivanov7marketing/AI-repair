import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2, FileText, Link2, Activity, MessageSquare } from 'lucide-react';
import { Deal, PipelineStage, User, DealSource } from '../../types';
import { api } from '../../services/api';
import { TimelineView } from './TimelineView';

interface DealModalProps {
  deal: Deal;
  onClose: () => void;
  onEdit: (deal: Deal) => void;
  onUpdate: () => void;
  stages: PipelineStage[];
  users: User[];
  sources: DealSource[];
  hasPermission: (permission: string) => boolean;
}

export const DealModal: React.FC<DealModalProps> = ({
  deal,
  onClose,
  onEdit,
  onUpdate,
  stages,
  users,
  sources,
  hasPermission,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'files' | 'related' | 'activity'>('info');
  const [deleting, setDeleting] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localDeal, setLocalDeal] = useState<Deal>(deal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalDeal(deal);
  }, [deal]);

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту сделку?')) return;

    try {
      setDeleting(true);
      await api.deleteDeal(deal.id);
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Failed to delete deal:', error);
      alert('Ошибка при удалении сделки');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveStage = async (newStageId: string) => {
    try {
      await api.moveDeal(deal.id, newStageId);
      onUpdate();
    } catch (error) {
      console.error('Failed to move deal:', error);
      alert('Ошибка при перемещении сделки');
    }
  };

  const handleCreateProject = () => {
    sessionStorage.setItem('createProjectFromDeal', deal.id);
    sessionStorage.setItem('projectFromDealData', JSON.stringify({
      name: `Смета для ${deal.leadName}`,
      address: deal.address,
      area: deal.area,
      repairType: deal.repairType,
      budget: deal.budgetTo || deal.budgetFrom,
    }));
    // Will be handled in App.tsx
    onClose();
    window.dispatchEvent(new Event('navigateToProjects'));
  };

  const currentStage = stages.find(s => s.id === localDeal.stageId);

  const handleFieldUpdate = async (field: string, value: any) => {
    // Don't update if value hasn't changed (normalize for comparison)
    const currentValue = localDeal[field as keyof Deal];
    const normalizedCurrent = currentValue === null || currentValue === '' ? null : currentValue;
    const normalizedNew = value === null || value === '' ? null : value;
    
    if (normalizedCurrent === normalizedNew) {
      setEditingField(null);
      return;
    }

    try {
      setSaving(true);
      // Convert empty string to null for database
      const updateValue = value === '' ? null : value;
      await api.updateDeal(localDeal.id, { [field]: updateValue });
      setLocalDeal({ ...localDeal, [field]: updateValue });
      setEditingField(null);
      onUpdate();
    } catch (error) {
      console.error('Failed to update deal:', error);
      alert('Ошибка при обновлении поля');
    } finally {
      setSaving(false);
    }
  };

  const EditableField: React.FC<{
    label: string;
    field: string;
    value: any;
    type?: 'text' | 'number' | 'select' | 'date';
    options?: { value: string; label: string }[];
    render?: (value: any) => string;
  }> = ({ label, field, value, type = 'text', options, render }) => {
    const isEditing = editingField === field;
    const displayValue = render ? render(value) : (value || (value === 0 ? '0' : '...'));
    
    // Get current value for editing
    const getEditValue = () => {
      if (type === 'date' && value) {
        return new Date(value).toISOString().split('T')[0];
      }
      return value?.toString() || '';
    };

    return (
      <div className="flex justify-between items-start">
        <label className="text-xs font-medium text-architect-500 dark:text-architect-400">{label}:</label>
        <div className="text-right flex-1 ml-4">
          {isEditing && hasPermission('edit_deals') ? (
            <div className="flex justify-end">
              {type === 'select' && options ? (
                <select
                  autoFocus
                  value={value || ''}
                  onChange={(e) => handleFieldUpdate(field, e.target.value || null)}
                  onBlur={() => setEditingField(null)}
                  className="text-sm text-right bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100"
                >
                  <option value="">...</option>
                  {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : type === 'number' ? (
                <input
                  autoFocus
                  type="number"
                  defaultValue={value || ''}
                  onBlur={(e) => {
                    const newValue = e.target.value ? parseFloat(e.target.value) : null;
                    handleFieldUpdate(field, newValue);
                    setEditingField(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="text-sm text-right bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100 w-32"
                />
              ) : type === 'date' ? (
                <input
                  autoFocus
                  type="date"
                  defaultValue={getEditValue()}
                  onBlur={(e) => {
                    handleFieldUpdate(field, e.target.value || null);
                    setEditingField(null);
                  }}
                  className="text-sm text-right bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100"
                />
              ) : (
                <input
                  autoFocus
                  type="text"
                  defaultValue={getEditValue()}
                  onBlur={(e) => {
                    handleFieldUpdate(field, e.target.value || null);
                    setEditingField(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="text-sm text-right bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100"
                />
              )}
            </div>
          ) : (
            <div
              onClick={() => hasPermission('edit_deals') && setEditingField(field)}
              className={`text-sm text-architect-900 dark:text-architect-100 cursor-pointer hover:bg-architect-50 dark:hover:bg-architect-700 px-1 py-0.5 rounded text-right ${hasPermission('edit_deals') ? '' : 'cursor-default'}`}
            >
              {displayValue}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg mr-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
              {deal.leadName}
            </h2>
            <span className="text-sm text-architect-500 dark:text-architect-400">#{deal.id.slice(0, 8)}</span>
            <button className="px-2 py-1 text-xs border border-architect-200 dark:border-architect-700 rounded hover:bg-architect-50 dark:hover:bg-architect-700">
              #ТЕГИРОВАТЬ
            </button>
          </div>
          <div className="flex items-center gap-2">
            {currentStage && (
              <div
                className="px-3 py-1.5 rounded text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: currentStage.color }}
              >
                {currentStage.name}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
            {hasPermission('edit_deals') && (
              <button
                onClick={() => onEdit(deal)}
                className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            {hasPermission('delete_deals') && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg text-red-600 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Deal details */}
          <div className="w-[35%] border-r border-architect-200 dark:border-architect-700 overflow-y-auto p-4">
            <div className="space-y-3">
              {/* Block 1: Contact information */}
              <div className="space-y-1.5">
                <EditableField
                  label="Отв-ный"
                  field="responsibleManagerId"
                  value={localDeal.responsibleManagerId || ''}
                  type="select"
                  options={[
                    { value: '', label: 'Не назначен' },
                    ...users.filter(u => u.role === 'manager' || u.role === 'admin').map(u => ({
                      value: u.id,
                      label: u.name || u.email
                    }))
                  ]}
                  render={(v) => localDeal.responsibleManager ? (localDeal.responsibleManager.name || localDeal.responsibleManager.email) : 'Не назначен'}
                />
                <EditableField
                  label="Имя"
                  field="leadName"
                  value={localDeal.leadName}
                  type="text"
                  render={(v) => v || '...'}
                />
                <EditableField
                  label="Телефон"
                  field="phone"
                  value={localDeal.phone}
                  type="text"
                  render={(v) => v || '...'}
                />
                <EditableField
                  label="E-mail"
                  field="email"
                  value={localDeal.email}
                  type="text"
                  render={(v) => v || '...'}
                />
                <EditableField
                  label="Адрес"
                  field="address"
                  value={localDeal.address}
                  type="text"
                  render={(v) => v || '...'}
                />
              </div>

              {/* Block 2: Deal parameters */}
              <div className="space-y-1.5 pt-4 border-t border-architect-200 dark:border-architect-700">
                <EditableField
                  label="Бюджет"
                  field="budgetFrom"
                  value={localDeal.budgetFrom}
                  type="number"
                  render={(v) => {
                    const from = localDeal.budgetFrom;
                    const to = localDeal.budgetTo;
                    if (from && to) return `${(from / 1000).toFixed(0)}K - ${(to / 1000).toFixed(0)}K ₽`;
                    if (from) return `от ${(from / 1000).toFixed(0)}K ₽`;
                    if (to) return `до ${(to / 1000).toFixed(0)}K ₽`;
                    return '0 ₽';
                  }}
                />
                <EditableField
                  label="Площадь"
                  field="area"
                  value={localDeal.area}
                  type="number"
                  render={(v) => v ? `${v}` : '...'}
                />
              <EditableField
                label="Тип ремонта"
                field="repairType"
                value={localDeal.repairType}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="Состояние"
                field="objectCondition"
                value={localDeal.objectCondition}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="Комнаты"
                field="roomsCount"
                value={localDeal.roomsCount}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="Санузел"
                field="bathroomType"
                value={localDeal.bathroomType}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField label="Электрика" field="electricity" value={null} />
              <EditableField label="Сантехника" field="plumbing" value={null} />
              <EditableField label="Доп.работы" field="additionalWorks" value={null} />
              <EditableField label="Подарок" field="gift" value={null} />
              <EditableField
                label="Удобное время"
                field="desiredStartDate"
                value={localDeal.desiredStartDate}
                type="date"
                render={(v) => v ? new Date(v).toLocaleDateString('ru-RU') : '...'}
              />
              <EditableField
                label="День замера"
                field="measurementDate"
                value={localDeal.measurementDate}
                type="date"
                render={(v) => v ? new Date(v).toLocaleDateString('ru-RU') : '...'}
              />
              </div>
            </div>
          </div>

          {/* Right panel - Timeline and comments */}
          <div className="w-[65%] overflow-y-auto p-4">
            <TimelineView dealId={localDeal.id} onUpdate={onUpdate} />
          </div>
        </div>
      </div>
    </div>
  );
};
