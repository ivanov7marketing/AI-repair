import React, { useState, useEffect } from 'react';
import { X, User, MapPin, Package, Calendar, Wrench, ArrowRight, ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { Tool, ToolMovement } from '../../types';
import { ToolForm } from './ToolForm';

interface ToolDetailsProps {
  tool: Tool;
  onClose: () => void;
  onUpdate: () => void;
  hasPermission: (permission: string) => boolean;
  onEdit?: () => void;
}

export const ToolDetails: React.FC<ToolDetailsProps> = ({
  tool: initialTool,
  onClose,
  onUpdate,
  hasPermission,
}) => {
  const [tool, setTool] = useState<Tool>(initialTool);
  const [movements, setMovements] = useState<ToolMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadToolDetails();
    loadMovements();
  }, [initialTool.id]);

  const loadToolDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getTool(initialTool.id);
      setTool(data);
    } catch (error) {
      console.error('Failed to load tool details:', error);
      alert('Ошибка при загрузке деталей инструмента');
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      const data = await api.getToolMovements(initialTool.id);
      setMovements(data);
    } catch (error) {
      console.error('Failed to load movements:', error);
    }
  };

  const getConditionText = (condition: string) => {
    const conditionMap: Record<string, string> = {
      working: 'Исправен',
      repair: 'В ремонте',
      disposed: 'Утилизирован',
    };
    return conditionMap[condition] || condition;
  };

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить этот инструмент?')) {
      return;
    }

    try {
      setDeleting(true);
      await api.deleteTool(tool.id);
      onUpdate();
      onClose();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось удалить инструмент'));
    } finally {
      setDeleting(false);
    }
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
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-architect-800 border-b border-architect-200 dark:border-architect-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-architect-900 dark:text-white">{tool.name}</h2>
            <p className="text-sm text-architect-500 dark:text-architect-400 mt-1">
              Инвентарный № {tool.inventoryNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-architect-600 dark:text-architect-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* General info */}
          <div className="grid grid-cols-2 gap-4">
            {tool.photo && (
              <div className="col-span-2">
                <img src={tool.photo} alt={tool.name} className="w-full max-w-md h-64 object-cover rounded-lg" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Бренд</label>
              <p className="mt-1 text-sm text-architect-900 dark:text-white">{tool.brand || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Модель</label>
              <p className="mt-1 text-sm text-architect-900 dark:text-white">{tool.model || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Категория</label>
              <p className="mt-1 text-sm text-architect-900 dark:text-white">{tool.category || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Состояние</label>
              <p className="mt-1 text-sm text-architect-900 dark:text-white">
                {getConditionText(tool.condition)}
              </p>
            </div>
            {tool.purchaseDate && (
              <div>
                <label className="text-sm font-medium text-architect-500 dark:text-architect-400">
                  Дата покупки
                </label>
                <p className="mt-1 text-sm text-architect-900 dark:text-white">
                  {new Date(tool.purchaseDate).toLocaleDateString('ru-RU')}
                </p>
              </div>
            )}
            {tool.purchasePrice && (
              <div>
                <label className="text-sm font-medium text-architect-500 dark:text-architect-400">
                  Стоимость покупки
                </label>
                <p className="mt-1 text-sm text-architect-900 dark:text-white">
                  {tool.purchasePrice.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            )}
          </div>

          {/* Current location */}
          <div className="border-t border-architect-200 dark:border-architect-700 pt-4">
            <h3 className="text-lg font-semibold text-architect-900 dark:text-white mb-4">
              Текущее местоположение
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Где находится</label>
                <p className="mt-1 text-sm text-architect-900 dark:text-white">
                  {tool.currentLocation === 'base'
                    ? 'На базе'
                    : tool.currentLocation === 'project'
                    ? 'На объекте'
                    : 'У сотрудника'}
                </p>
              </div>
              {tool.currentProjectName && (
                <div>
                  <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Объект</label>
                  <p className="mt-1 text-sm text-architect-900 dark:text-white">{tool.currentProjectName}</p>
                </div>
              )}
              {tool.currentEmployeeName && (
                <div>
                  <label className="text-sm font-medium text-architect-500 dark:text-architect-400">У сотрудника</label>
                  <p className="mt-1 text-sm text-architect-900 dark:text-white">
                    {tool.currentEmployeeName || tool.currentEmployeeEmail || '—'}
                  </p>
                </div>
              )}
              {tool.assignedSince && (
                <div>
                  <label className="text-sm font-medium text-architect-500 dark:text-architect-400">С даты</label>
                  <p className="mt-1 text-sm text-architect-900 dark:text-white">
                    {new Date(tool.assignedSince).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="border-t border-architect-200 dark:border-architect-700 pt-4">
            <h3 className="text-lg font-semibold text-architect-900 dark:text-white mb-4">
              История перемещений
            </h3>
            <div className="space-y-3">
              {movements.length === 0 ? (
                <p className="text-sm text-architect-500 dark:text-architect-400">История пуста</p>
              ) : (
                movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="p-3 bg-architect-50 dark:bg-architect-900 rounded-lg text-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-architect-900 dark:text-white">
                        {movement.movementType === 'issue' ? 'Выдача' : 'Возврат'}
                      </span>
                      <span className="text-architect-500 dark:text-architect-400">
                        {new Date(movement.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    {movement.employeeName && (
                      <p className="text-architect-600 dark:text-architect-300">
                        Сотрудник: {movement.employeeName}
                      </p>
                    )}
                    {movement.projectName && (
                      <p className="text-architect-600 dark:text-architect-300">
                        Объект: {movement.projectName}
                      </p>
                    )}
                    {movement.issuedAt && (
                      <p className="text-architect-600 dark:text-architect-300">
                        Выдано: {new Date(movement.issuedAt).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                    {movement.returnedAt && (
                      <p className="text-architect-600 dark:text-architect-300">
                        Возвращено: {new Date(movement.returnedAt).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                    {movement.conditionOnReturn && (
                      <p className="text-architect-600 dark:text-architect-300">
                        Состояние при возврате: {getConditionText(movement.conditionOnReturn)}
                      </p>
                    )}
                    {movement.comment && (
                      <p className="text-architect-500 dark:text-architect-400 mt-1">{movement.comment}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          {hasPermission('manage_tools') && (
            <div className="flex gap-2 pt-4 border-t border-architect-200 dark:border-architect-700">
              <button
                onClick={() => setShowEditForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Редактировать
              </button>
              {tool.currentLocation === 'base' ? (
                <>
                  <button
                    onClick={() => setShowIssueForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Выдать инструмент
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? 'Удаление...' : 'Удалить'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowReturnForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Принять возврат
                </button>
              )}
            </div>
          )}

          {/* Issue form */}
          {showIssueForm && (
            <ToolIssueForm
              toolId={tool.id}
              onClose={() => {
                setShowIssueForm(false);
                loadToolDetails();
                onUpdate();
              }}
            />
          )}

          {/* Return form */}
          {showReturnForm && (
            <ToolReturnForm
              toolId={tool.id}
              onClose={() => {
                setShowReturnForm(false);
                loadToolDetails();
                onUpdate();
              }}
            />
          )}

          {/* Edit form */}
          {showEditForm && (
            <ToolForm
              initialData={tool}
              onClose={() => {
                setShowEditForm(false);
                loadToolDetails();
                onUpdate();
              }}
              onSuccess={() => {
                setShowEditForm(false);
                loadToolDetails();
                onUpdate();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Tool Issue Form
interface ToolIssueFormProps {
  toolId: string;
  onClose: () => void;
}

const ToolIssueForm: React.FC<ToolIssueFormProps> = ({ toolId, onClose }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    projectId: '',
    plannedReturnDate: '',
    comment: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      alert('Выберите сотрудника');
      return;
    }

    try {
      setLoading(true);
      await api.issueTool(toolId, {
        employeeId: formData.employeeId,
        projectId: formData.projectId || undefined,
        plannedReturnDate: formData.plannedReturnDate || undefined,
        comment: formData.comment || undefined,
      });
      onClose();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось выдать инструмент'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-architect-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-architect-200 dark:border-architect-700">
          <h3 className="text-lg font-semibold text-architect-900 dark:text-white">Выдача инструмента</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Сотрудник *
            </label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              required
            >
              <option value="">Выберите сотрудника</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Объект (опционально)
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            >
              <option value="">Не привязывать к объекту</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Планируемая дата возврата
            </label>
            <input
              type="date"
              value={formData.plannedReturnDate}
              onChange={(e) => setFormData({ ...formData, plannedReturnDate: e.target.value })}
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Выдача...' : 'Выдать'}
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

// Tool Return Form
interface ToolReturnFormProps {
  toolId: string;
  onClose: () => void;
}

const ToolReturnForm: React.FC<ToolReturnFormProps> = ({ toolId, onClose }) => {
  const [formData, setFormData] = useState({
    conditionOnReturn: 'working' as 'working' | 'repair' | 'disposed',
    comment: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.returnTool(toolId, {
        conditionOnReturn: formData.conditionOnReturn,
        comment: formData.comment || undefined,
      });
      onClose();
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось принять возврат'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-architect-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-architect-200 dark:border-architect-700">
          <h3 className="text-lg font-semibold text-architect-900 dark:text-white">Возврат инструмента</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Состояние при возврате
            </label>
            <select
              value={formData.conditionOnReturn}
              onChange={(e) =>
                setFormData({ ...formData, conditionOnReturn: e.target.value as 'working' | 'repair' | 'disposed' })
              }
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            >
              <option value="working">Исправен</option>
              <option value="repair">Требует ремонта</option>
              <option value="disposed">Утилизирован</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
              Комментарий
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              placeholder="Опишите состояние инструмента, повреждения..."
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Прием...' : 'Принять возврат'}
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
