import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ArrowLeft, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Project, ProjectMaterial } from '../../types';

interface ProjectMaterialsCardProps {
  project: Project;
  onClose: () => void;
  onRefresh: () => void;
  hasPermission: (permission: string) => boolean;
}

export const ProjectMaterialsCard: React.FC<ProjectMaterialsCardProps> = ({
  project,
  onClose,
  onRefresh,
  hasPermission,
}) => {
  const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArrivalForm, setShowArrivalForm] = useState(false);
  const [showWriteoffForm, setShowWriteoffForm] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<ProjectMaterial | null>(null);

  useEffect(() => {
    loadMaterials();
  }, [project.id]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const data = await api.getProjectMaterials(project.id);
      setMaterials(data);
    } catch (error) {
      console.error('Failed to load materials:', error);
      alert('Ошибка при загрузке материалов');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excess':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'low':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      excess: 'Избыток',
      normal: 'Норма',
      low: 'Нехватка',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-architect-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-architect-900 dark:border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-architect-800 border-b border-architect-200 dark:border-architect-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-architect-900 dark:text-white">{project.name}</h2>
            <p className="text-sm text-architect-500 dark:text-architect-400 mt-1">Материалы на объекте</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-architect-600 dark:text-architect-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Actions */}
          {hasPermission('manage_warehouse') && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowArrivalForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Приход материала
              </button>
              <button
                onClick={() => setShowWriteoffForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Minus className="w-4 h-4" />
                Списать материал
              </button>
            </div>
          )}

          {/* Materials table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-architect-50 dark:bg-architect-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                    Материал
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                    По смете
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                    Закуплено
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                    На объекте
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                    Израсходовано
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                    Последнее движение
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-architect-200 dark:divide-architect-700">
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-architect-500 dark:text-architect-400">
                      Материалы не найдены
                    </td>
                  </tr>
                ) : (
                  materials.map((material) => (
                    <tr key={material.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-architect-900 dark:text-white">
                          {material.material?.name || '—'}
                        </div>
                        <div className="text-xs text-architect-500 dark:text-architect-400">
                          {material.material?.unit || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                        {material.quantityPlanned.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                        {material.quantityPurchased.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-architect-900 dark:text-white">
                        {material.quantityOnSite.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                        {material.quantityUsed.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            material.status
                          )}`}
                        >
                          {material.status === 'low' ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          {getStatusText(material.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-architect-500 dark:text-architect-400">
                        {material.lastMovementDate
                          ? new Date(material.lastMovementDate).toLocaleDateString('ru-RU')
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Arrival form */}
        {showArrivalForm && (
          <MaterialArrivalForm
            projectId={project.id}
            materials={materials}
            onClose={() => {
              setShowArrivalForm(false);
              loadMaterials();
              onRefresh();
            }}
          />
        )}

        {/* Writeoff form */}
        {showWriteoffForm && (
          <MaterialWriteoffForm
            projectId={project.id}
            materials={materials.filter((m) => m.quantityOnSite > 0)}
            onClose={() => {
              setShowWriteoffForm(false);
              loadMaterials();
              onRefresh();
            }}
          />
        )}
      </div>
    </div>
  );
};

// Material Arrival Form
interface MaterialArrivalFormProps {
  projectId: string;
  materials: ProjectMaterial[];
  onClose: () => void;
}

const MaterialArrivalForm: React.FC<MaterialArrivalFormProps> = ({ projectId, materials, onClose }) => {
  const [allMaterials, setAllMaterials] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    materialId: '',
    quantity: 0,
    documentUrl: '',
    comment: '',
    fromLocation: 'warehouse',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const data = await api.getMaterials();
      setAllMaterials(data);
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.materialId || formData.quantity <= 0) {
      alert('Заполните все поля');
      return;
    }

    try {
      setLoading(true);
      await api.recordMaterialArrival(projectId, {
        materialId: formData.materialId,
        quantity: formData.quantity,
        documentUrl: formData.documentUrl || undefined,
        comment: formData.comment || undefined,
        fromLocation: formData.fromLocation || undefined,
      });
      onClose();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось зафиксировать приход'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-architect-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-architect-200 dark:border-architect-700">
          <h3 className="text-lg font-semibold text-architect-900 dark:text-white">Приход материала</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Материал
            </label>
            <select
              value={formData.materialId}
              onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              required
            >
              <option value="">Выберите материал</option>
              {allMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Количество
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Откуда
            </label>
            <select
              value={formData.fromLocation}
              onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            >
              <option value="warehouse">Склад</option>
              <option value="supplier">Поставщик</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Комментарий
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
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

// Material Writeoff Form
interface MaterialWriteoffFormProps {
  projectId: string;
  materials: ProjectMaterial[];
  onClose: () => void;
}

const MaterialWriteoffForm: React.FC<MaterialWriteoffFormProps> = ({ projectId, materials, onClose }) => {
  const [formData, setFormData] = useState({
    materialId: '',
    quantity: 0,
    workStage: '',
    comment: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.materialId || formData.quantity <= 0) {
      alert('Заполните все поля');
      return;
    }

    const selectedMaterial = materials.find((m) => m.materialId === formData.materialId);
    if (selectedMaterial && formData.quantity > selectedMaterial.quantityOnSite) {
      alert('Недостаточно материала на объекте');
      return;
    }

    try {
      setLoading(true);
      await api.writeoffMaterial(projectId, {
        materialId: formData.materialId,
        quantity: formData.quantity,
        workStage: formData.workStage || undefined,
        comment: formData.comment || undefined,
      });
      onClose();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось списать материал'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-architect-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-architect-200 dark:border-architect-700">
          <h3 className="text-lg font-semibold text-architect-900 dark:text-white">Списание материала</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Материал
            </label>
            <select
              value={formData.materialId}
              onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              required
            >
              <option value="">Выберите материал</option>
              {materials.map((material) => (
                <option key={material.id} value={material.materialId}>
                  {material.material?.name} (остаток: {material.quantityOnSite} {material.material?.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Количество
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Этап работ
            </label>
            <input
              type="text"
              value={formData.workStage}
              onChange={(e) => setFormData({ ...formData, workStage: e.target.value })}
              placeholder="Например: штукатурка, электрика, покраска..."
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Комментарий
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Списать'}
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
