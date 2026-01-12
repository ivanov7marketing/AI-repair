import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, AlertCircle, Package } from 'lucide-react';
import { api } from '../../services/api';
import { Material, Project, PurchaseRequestItem } from '../../types';

interface PurchaseRequestFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    projectId?: string;
    estimateProjectId?: string;
  };
}

export const PurchaseRequestForm: React.FC<PurchaseRequestFormProps> = ({
  onClose,
  onSuccess,
  initialData,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectId: initialData?.projectId || '',
    urgency: 'normal' as 'normal' | 'urgent',
    estimateProjectId: initialData?.estimateProjectId || '',
  });
  const [items, setItems] = useState<Array<Partial<PurchaseRequestItem> & { tempId: string; customMaterialName?: string }>>([]);
  const [showMaterialSelect, setShowMaterialSelect] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const materialInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
    loadMaterials();
    if (initialData?.estimateProjectId) {
      loadEstimateMaterials(initialData.estimateProjectId);
    }
  }, []);

  // Close material dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (materialInputRef.current && !materialInputRef.current.contains(event.target as Node)) {
        setShowMaterialSelect(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadMaterials = async () => {
    try {
      const data = await api.getMaterials();
      setMaterials(data);
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  const loadEstimateMaterials = async (projectId: string) => {
    try {
      const project = await api.getProject(projectId);
      if (project.analysis?.rooms) {
        const estimateItems: Array<Partial<PurchaseRequestItem> & { tempId: string }> = [];
        
        project.analysis.rooms.forEach((room) => {
          // Rough materials
          room.estimation?.roughMaterials?.items?.forEach((item) => {
            if (item.quantity > 0) {
              estimateItems.push({
                tempId: `est-${room.id}-rough-${item.id}`,
                materialId: undefined,
                quantityRequested: item.quantity,
                unitPrice: item.price,
                note: `Из сметы: ${room.name}`,
                fromEstimate: true,
                estimateItemId: item.id,
                estimateRoomId: room.id,
                estimateItemPath: `rooms.${room.id}.estimation.roughMaterials.items.${item.id}`,
              });
            }
          });
          
          // Finish materials
          room.estimation?.finishMaterials?.items?.forEach((item) => {
            if (item.quantity > 0) {
              estimateItems.push({
                tempId: `est-${room.id}-finish-${item.id}`,
                materialId: undefined,
                quantityRequested: item.quantity,
                unitPrice: item.price,
                note: `Из сметы: ${room.name}`,
                fromEstimate: true,
                estimateItemId: item.id,
                estimateRoomId: room.id,
                estimateItemPath: `rooms.${room.id}.estimation.finishMaterials.items.${item.id}`,
              });
            }
          });
        });
        
        setItems(estimateItems);
      }
    } catch (error) {
      console.error('Failed to load estimate materials:', error);
    }
  };

  const handleAddItem = (material?: Material, customName?: string) => {
    const newItem: Partial<PurchaseRequestItem> & { tempId: string; customMaterialName?: string } = {
      tempId: `temp-${Date.now()}`,
      materialId: material?.id,
      customMaterialName: customName,
      quantityRequested: 1,
      unitPrice: material?.averagePrice || 0,
      note: '',
      fromEstimate: false,
    };
    setItems([...items, newItem]);
    setShowMaterialSelect(false);
    setMaterialSearch('');
  };

  const handleRemoveItem = (tempId: string) => {
    setItems(items.filter((item) => item.tempId !== tempId));
  };

  const handleItemChange = (tempId: string, field: string, value: any) => {
    setItems(
      items.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      alert('Добавьте хотя бы один материал');
      return;
    }

    if (items.some((item) => !item.quantityRequested || item.quantityRequested <= 0)) {
      alert('Укажите количество для всех материалов');
      return;
    }

    try {
      setLoading(true);
      await api.createPurchaseRequest({
        projectId: formData.projectId || undefined,
        urgency: formData.urgency,
        estimateProjectId: formData.estimateProjectId || undefined,
        items: items.map((item) => ({
          materialId: item.materialId || undefined,
          materialName: item.customMaterialName || undefined, // For custom materials
          quantityRequested: item.quantityRequested!,
          unitPrice: item.unitPrice || undefined,
          note: item.note || undefined,
          fromEstimate: item.fromEstimate || false,
          estimateItemId: item.estimateItemId || undefined,
          estimateRoomId: item.estimateRoomId || undefined,
          estimateItemPath: item.estimateItemPath || undefined,
        })),
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось создать заявку'));
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter((m) =>
    m.name.toLowerCase().includes(materialSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-architect-800 border-b border-architect-200 dark:border-architect-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-architect-900 dark:text-white">Новая заявка на закупку</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-architect-600 dark:text-architect-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Объект
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              >
                <option value="">Выберите объект</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Срочность
              </label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value as 'normal' | 'urgent' })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              >
                <option value="normal">Обычная</option>
                <option value="urgent">Срочная</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Привязать к смете (опционально)
              </label>
              <select
                value={formData.estimateProjectId}
                onChange={(e) => {
                  const newEstimateId = e.target.value;
                  setFormData({ ...formData, estimateProjectId: newEstimateId });
                  if (newEstimateId) {
                    loadEstimateMaterials(newEstimateId);
                  } else {
                    setItems([]);
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              >
                <option value="">Не привязывать</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-architect-900 dark:text-white">Материалы</h3>
              <button
                type="button"
                onClick={() => setShowMaterialSelect(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg text-sm hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Добавить материал
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-architect-500 dark:text-architect-400">
                Добавьте материалы в заявку
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const material = materials.find((m) => m.id === item.materialId);
                  const itemName = item.customMaterialName || material?.name || 'Материал не выбран';
                  return (
                    <div
                      key={item.tempId}
                      className="p-4 border border-architect-200 dark:border-architect-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {item.fromEstimate && (
                              <span className="text-xs text-blue-600 dark:text-blue-400">Из сметы</span>
                            )}
                            {item.customMaterialName && (
                              <span className="text-xs text-green-600 dark:text-green-400">Новый материал</span>
                            )}
                            <span className="font-medium text-architect-900 dark:text-white">
                              {itemName}
                            </span>
                          </div>
                          {material && (
                            <span className="text-sm text-architect-500 dark:text-architect-400">
                              {material.unit}
                            </span>
                          )}
                          {item.customMaterialName && !material && (
                            <span className="text-sm text-architect-500 dark:text-architect-400">
                              Единица измерения не указана
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.tempId!)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-architect-500 dark:text-architect-400 mb-1">
                            Количество
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.quantityRequested || ''}
                            onChange={(e) =>
                              handleItemChange(item.tempId!, 'quantityRequested', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-architect-500 dark:text-architect-400 mb-1">
                            Цена за ед.
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice || ''}
                            onChange={(e) =>
                              handleItemChange(item.tempId!, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-architect-500 dark:text-architect-400 mb-1">
                            Сумма
                          </label>
                          <div className="px-2 py-1.5 bg-architect-50 dark:bg-architect-900 rounded text-sm font-medium text-architect-900 dark:text-white">
                            {((item.quantityRequested || 0) * (item.unitPrice || 0)).toLocaleString('ru-RU')} ₽
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-architect-500 dark:text-architect-400 mb-1">
                          Примечание
                        </label>
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => handleItemChange(item.tempId!, 'note', e.target.value)}
                          placeholder="Для какого этапа работ, почему нужен..."
                          className="w-full px-2 py-1.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm dark:text-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 p-3 bg-architect-50 dark:bg-architect-900 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-architect-900 dark:text-white">Общая сумма:</span>
                <span className="text-lg font-bold text-architect-900 dark:text-white">
                  {items
                    .reduce((sum, item) => sum + (item.quantityRequested || 0) * (item.unitPrice || 0), 0)
                    .toLocaleString('ru-RU')}{' '}
                  ₽
                </span>
              </div>
            </div>
          </div>

          {/* Material select modal */}
          {showMaterialSelect && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
              <div className="bg-white dark:bg-architect-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-4 border-b border-architect-200 dark:border-architect-700 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-architect-900 dark:text-white">
                    Выберите материал
                  </h3>
                  <button
                    onClick={() => {
                      setShowMaterialSelect(false);
                      setMaterialSearch('');
                    }}
                    className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4">
                  <input
                    type="text"
                    placeholder="Поиск материала..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="w-full px-3 py-2 mb-4 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
                    autoFocus
                  />
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredMaterials.map((material) => (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() => handleAddItem(material)}
                        className="w-full p-3 text-left border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 transition-colors"
                      >
                        <div className="font-medium text-architect-900 dark:text-white">{material.name}</div>
                        <div className="text-sm text-architect-500 dark:text-architect-400">
                          {material.unit} • {material.averagePrice ? `${material.averagePrice.toLocaleString('ru-RU')} ₽` : 'Цена не указана'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-architect-200 dark:border-architect-700">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать заявку'}
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
