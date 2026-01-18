import React, { useState, useEffect, useRef } from 'react';
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
    // List of fields that backend supports for updates
    const supportedFields = [
      'leadName', 'phone', 'email', 'telegram', 'whatsapp',
      'sourceId', 'responsibleManagerId', 'leadTemperature',
      'address', 'buildingType', 'area', 'roomsCount', 'bathroomType',
      'ceilingHeight', 'hasElevator', 'repairType', 'objectCondition',
      'budgetFrom', 'budgetTo', 'needsDesign', 'needsDemolition',
      'materialPurchaseType', 'desiredStartDate', 'urgency', 'measurementNotes',
      'measurementDate', 'measurementTime'
    ];
    
    // Skip if field is not supported by backend
    if (!supportedFields.includes(field)) {
      setEditingField(null);
      return;
    }

    const currentValue = localDeal[field as keyof Deal] ?? null;
    
    // Normalize and compare values
    const normalizeValue = (val: any): any => {
      if (val === null || val === undefined || val === '') return null;
      // For date fields (only contractSignedDate and prepaymentDate are actual dates)
      const dateFields = ['contractSignedDate', 'prepaymentDate'];
      if (dateFields.includes(field)) {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '' || trimmed === '...') return null;
          // If it's a date string (YYYY-MM-DD), keep it
          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
          }
          // If it's an ISO date string, extract date part
          if (trimmed.includes('T')) {
            return trimmed.split('T')[0];
          }
          // If it's a valid Date string, try to parse
          const date = new Date(trimmed);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          // Invalid date string - return null to prevent error
          return null;
        }
        if (val instanceof Date) {
          return val.toISOString().split('T')[0];
        }
        return null;
      }
      // For numbers, convert to number type
      const numericFields = ['area', 'budgetFrom', 'budgetTo', 'ceilingHeight', 'prepaymentAmount'];
      if (numericFields.includes(field)) {
        const numVal = typeof val === 'number' ? val : Number(val);
        return isNaN(numVal) ? null : numVal;
      }
      // For strings (including desiredStartDate and measurementDate which are now text), trim and convert empty to null
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
      }
      return val;
    };
    
    const normalizedCurrent = normalizeValue(currentValue);
    const normalizedNew = normalizeValue(value);
    
    // Simple comparison - if values are the same, don't update
    if (normalizedCurrent === normalizedNew || 
        (normalizedCurrent === null && normalizedNew === null) ||
        (normalizedCurrent === '' && normalizedNew === null) ||
        (normalizedCurrent === null && normalizedNew === '')) {
      setEditingField(null);
      return;
    }

    try {
      setSaving(true);
      // Prepare value for backend - normalize empty strings to null
      const updateValue = normalizedNew;
      
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
    users?: User[];
  }> = ({ label, field, value, type = 'text', options, render, users }) => {
    const isEditing = editingField === field;
    const displayValue = render ? render(value) : (value || (value === 0 ? '0' : '...'));
    const selectRef = useRef<HTMLSelectElement>(null);
    
    // Open select dropdown when editing is activated for select fields
    useEffect(() => {
      if (isEditing && type === 'select') {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (selectRef.current) {
              const select = selectRef.current;
              select.focus();
              // Try to open dropdown using multiple approaches
              // Method 1: Create and dispatch mousedown event
              const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              select.dispatchEvent(mouseDownEvent);
              
              // Method 2: Direct click after small delay
              setTimeout(() => {
                if (selectRef.current) {
                  selectRef.current.click();
                }
              }, 50);
            }
          });
        });
      }
    }, [isEditing, type]);
    
    // Get current value for editing
    const getEditValue = () => {
      if (type === 'date' && value) {
        try {
          // If it's already a valid date string (YYYY-MM-DD), return it
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
          }
          // If it's a Date object, convert to YYYY-MM-DD
          if (value instanceof Date) {
            if (!isNaN(value.getTime())) {
              return value.toISOString().split('T')[0];
            }
            return '';
          }
          // Try to parse as date
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          // Invalid date - return empty string
          return '';
        } catch (e) {
          // Invalid date value - return empty string
          return '';
        }
      }
      // For text fields, just return the string value
      return value?.toString() || '';
    };

    return (
      <div className="flex items-center">
        <label className="text-xs font-normal text-architect-500 dark:text-architect-400 w-28 shrink-0">{label}:</label>
        <div className="text-left w-48">
          {isEditing && hasPermission('edit_deals') ? (
            <div className="flex justify-start">
              {type === 'select' && options ? (
                <select
                  ref={selectRef}
                  autoFocus
                  value={value || ''}
                  onChange={async (e) => {
                    const newValue = e.target.value || null;
                    // Update local state immediately for visual feedback
                    const updatedDeal: any = { ...localDeal, [field]: newValue };
                    
                    // If updating responsibleManagerId, also update responsibleManager object
                    if (field === 'responsibleManagerId' && users) {
                      if (newValue) {
                        const user = users.find(u => u.id === newValue);
                        if (user) {
                          updatedDeal.responsibleManager = {
                            id: user.id,
                            name: user.name || '',
                            email: user.email
                          };
                        } else {
                          updatedDeal.responsibleManager = undefined;
                        }
                      } else {
                        updatedDeal.responsibleManager = undefined;
                      }
                    }
                    
                    setLocalDeal(updatedDeal);
                    // Save to backend without closing the field (will close on blur)
                    try {
                      const normalizedNew = newValue === '' ? null : newValue;
                      await api.updateDeal(localDeal.id, { [field]: normalizedNew });
                      onUpdate();
                    } catch (error) {
                      console.error('Failed to update deal:', error);
                      alert('Ошибка при обновлении поля');
                      // Revert local state on error
                      setLocalDeal({ ...localDeal, [field]: value });
                    }
                  }}
                  onBlur={() => setEditingField(null)}
                  className="text-xs text-left bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100 w-full"
                >
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
                  className="text-xs text-left bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100 w-full"
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
                  className="text-xs text-left bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100 w-full"
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
                  className="text-xs text-left bg-transparent border-0 border-b border-architect-400 dark:border-architect-500 rounded-none px-0 py-0.5 focus:outline-none focus:border-architect-600 dark:focus:border-architect-400 dark:text-architect-100 w-full"
                />
              )}
            </div>
          ) : (
            <div
              onMouseDown={(e) => {
                if (hasPermission('edit_deals') && type === 'select') {
                  // For select fields, prevent default to avoid losing focus
                  e.preventDefault();
                  setEditingField(field);
                }
              }}
              onClick={() => {
                if (hasPermission('edit_deals') && type !== 'select') {
                  setEditingField(field);
                }
              }}
              className={`text-xs text-architect-900 dark:text-architect-100 cursor-pointer hover:bg-architect-50 dark:hover:bg-architect-700 px-1 py-0.5 rounded text-left ${hasPermission('edit_deals') ? '' : 'cursor-default'}`}
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
                  users={users}
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
                    if (v) return `${v} ₽`;
                    return '...';
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
              <EditableField
                label="Электрика"
                field="telegram"
                value={localDeal.telegram}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="Сантехника"
                field="whatsapp"
                value={localDeal.whatsapp}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="Доп.работы"
                field="measurementNotes"
                value={localDeal.measurementNotes}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="Подарок"
                field="materialPurchaseType"
                value={localDeal.materialPurchaseType}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="Удобное время"
                field="desiredStartDate"
                value={localDeal.desiredStartDate}
                type="text"
                render={(v) => v || '...'}
              />
              <EditableField
                label="День замера"
                field="measurementDate"
                value={localDeal.measurementDate}
                type="text"
                render={(v) => v || '...'}
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
