import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';

interface ReturnFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialProjectId?: string;
}

export const ReturnForm: React.FC<ReturnFormProps> = ({ onClose, onSuccess, initialProjectId }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectId: initialProjectId || '',
    materialId: '',
    quantity: 0,
    returnAmount: 0,
    supplierId: '',
    reason: '',
    plannedDate: '',
    responsiblePerson: '',
  });

  useEffect(() => {
    loadProjects();
    loadSuppliers();
    loadUsers();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      loadProjectMaterials();
    } else {
      setProjectMaterials([]);
    }
  }, [formData.projectId]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadProjectMaterials = async () => {
    try {
      const data = await api.getProjectMaterials(formData.projectId);
      setProjectMaterials(data.filter((m: any) => m.quantityOnSite > 0));
    } catch (error) {
      console.error('Failed to load project materials:', error);
      setProjectMaterials([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectId || !formData.materialId || formData.quantity <= 0) {
      alert('Заполните все обязательные поля');
      return;
    }

    const selectedMaterial = projectMaterials.find((m: any) => m.materialId === formData.materialId);
    if (selectedMaterial && formData.quantity > selectedMaterial.quantityOnSite) {
      alert('Недостаточно материала на объекте');
      return;
    }

    try {
      setLoading(true);
      await api.createReturn({
        projectId: formData.projectId,
        materialId: formData.materialId,
        quantity: formData.quantity,
        returnAmount: formData.returnAmount || undefined,
        supplierId: formData.supplierId || undefined,
        reason: formData.reason || undefined,
        plannedDate: formData.plannedDate || undefined,
        responsiblePerson: formData.responsiblePerson || undefined,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось создать возврат'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-architect-800 border-b border-architect-200 dark:border-architect-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-architect-900 dark:text-white">Новый возврат</h2>
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
                Объект *
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value, materialId: '' })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
                required
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
                Материал *
              </label>
              <select
                value={formData.materialId}
                onChange={(e) => {
                  const material = projectMaterials.find((m: any) => m.materialId === e.target.value);
                  setFormData({
                    ...formData,
                    materialId: e.target.value,
                    quantity: material?.quantityOnSite || 0,
                  });
                }}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
                required
                disabled={!formData.projectId}
              >
                <option value="">Выберите материал</option>
                {projectMaterials.map((material: any) => (
                  <option key={material.id} value={material.materialId}>
                    {material.material?.name} (остаток: {material.quantityOnSite} {material.material?.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Количество *
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
                Сумма возврата
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.returnAmount}
                onChange={(e) => setFormData({ ...formData, returnAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Магазин/Поставщик
              </label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              >
                <option value="">Выберите поставщика</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Планируемая дата
              </label>
              <input
                type="date"
                value={formData.plannedDate}
                onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Причина возврата
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              >
                <option value="">Выберите причину</option>
                <option value="излишек">Излишек</option>
                <option value="брак">Брак</option>
                <option value="не подошел">Не подошел</option>
                <option value="другое">Другое</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Ответственный за возврат
              </label>
              <select
                value={formData.responsiblePerson}
                onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              >
                <option value="">Выберите ответственного</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-architect-200 dark:border-architect-700">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать возврат'}
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
