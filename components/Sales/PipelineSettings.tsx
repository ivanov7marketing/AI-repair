import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';
import { PipelineStage } from '../../types';

interface PipelineSettingsProps {
  onClose: () => void;
  onUpdate: () => void;
}

export const PipelineSettings: React.FC<PipelineSettingsProps> = ({ onClose, onUpdate }) => {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStage, setNewStage] = useState({
    name: '',
    color: '#3B82F6',
    stageType: 'active' as 'active' | 'won' | 'lost' | 'system',
  });

  useEffect(() => {
    loadStages();
  }, []);

  const loadStages = async () => {
    try {
      setLoading(true);
      const data = await api.getPipelineStages();
      setStages(data);
    } catch (error) {
      console.error('Failed to load stages:', error);
      alert('Ошибка при загрузке этапов');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStage = async () => {
    if (!newStage.name.trim()) {
      alert('Введите название этапа');
      return;
    }

    try {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.orderIndex)) : 0;
      await api.createPipelineStage({
        name: newStage.name,
        orderIndex: maxOrder + 1,
        color: newStage.color,
        stageType: newStage.stageType,
      });
      setNewStage({ name: '', color: '#3B82F6', stageType: 'active' });
      setShowAddForm(false);
      await loadStages();
      onUpdate();
    } catch (error) {
      console.error('Failed to create stage:', error);
      alert('Ошибка при создании этапа');
    }
  };

  const handleUpdateStage = async (stage: PipelineStage, updates: Partial<PipelineStage>) => {
    try {
      await api.updatePipelineStage(stage.id, updates);
      await loadStages();
      onUpdate();
    } catch (error) {
      console.error('Failed to update stage:', error);
      alert('Ошибка при обновлении этапа');
    }
  };

  const handleDeleteStage = async (stage: PipelineStage) => {
    if (stage.isDefault) {
      alert('Нельзя удалить дефолтный этап');
      return;
    }

    if (!confirm(`Удалить этап "${stage.name}"?`)) return;

    try {
      await api.deletePipelineStage(stage.id);
      await loadStages();
      onUpdate();
    } catch (error: any) {
      alert(error.message || 'Ошибка при удалении этапа');
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Сбросить воронку до дефолтных этапов? Это удалит все пользовательские этапы.')) return;

    try {
      await api.resetPipelineStages();
      await loadStages();
      onUpdate();
    } catch (error) {
      console.error('Failed to reset stages:', error);
      alert('Ошибка при сбросе этапов');
    }
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    const newStages = [...stages];
    const [moved] = newStages.splice(fromIndex, 1);
    newStages.splice(toIndex, 0, moved);

    const stageOrders = newStages.map((stage, index) => ({
      id: stage.id,
      orderIndex: index + 1,
    }));

    try {
      await api.reorderPipelineStages(stageOrders);
      await loadStages();
      onUpdate();
    } catch (error) {
      console.error('Failed to reorder stages:', error);
      alert('Ошибка при изменении порядка');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-architect-800 rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-architect-900 dark:border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
            Настройки воронки продаж
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="px-3 py-1.5 text-sm border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Сбросить до дефолта
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Existing stages */}
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center gap-3 p-3 bg-architect-50 dark:bg-architect-900 rounded-lg border border-architect-200 dark:border-architect-700"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: stage.color }}
                  />
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => handleUpdateStage(stage, { name: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm"
                  />
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => handleUpdateStage(stage, { color: e.target.value })}
                    className="w-10 h-8 border border-architect-200 dark:border-architect-700 rounded cursor-pointer"
                  />
                  <select
                    value={stage.stageType}
                    onChange={(e) => handleUpdateStage(stage, { stageType: e.target.value as any })}
                    className="px-2 py-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm"
                  >
                    <option value="active">Активный</option>
                    <option value="won">Выигранный</option>
                    <option value="lost">Проигранный</option>
                    <option value="system">Системный</option>
                  </select>
                </div>
                {stage.isDefault && (
                  <span className="text-xs text-architect-500">🔒 Дефолтный</span>
                )}
                {!stage.isDefault && (
                  <button
                    onClick={() => handleDeleteStage(stage)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new stage form */}
          {showAddForm ? (
            <div className="p-3 bg-architect-50 dark:bg-architect-900 rounded-lg border border-architect-200 dark:border-architect-700">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Название этапа"
                  value={newStage.name}
                  onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                  className="flex-1 px-2 py-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm"
                />
                <input
                  type="color"
                  value={newStage.color}
                  onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
                  className="w-10 h-8 border border-architect-200 dark:border-architect-700 rounded cursor-pointer"
                />
                <select
                  value={newStage.stageType}
                  onChange={(e) => setNewStage({ ...newStage, stageType: e.target.value as any })}
                  className="px-2 py-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm"
                >
                  <option value="active">Активный</option>
                  <option value="won">Выигранный</option>
                  <option value="lost">Проигранный</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddStage}
                  className="px-3 py-1.5 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded text-sm hover:bg-architect-800 dark:hover:bg-architect-100"
                >
                  Добавить
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewStage({ name: '', color: '#3B82F6', stageType: 'active' });
                  }}
                  className="px-3 py-1.5 border border-architect-200 dark:border-architect-700 rounded text-sm hover:bg-architect-50 dark:hover:bg-architect-700"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-4 py-2 border-2 border-dashed border-architect-300 dark:border-architect-600 rounded-lg hover:border-architect-400 dark:hover:border-architect-500 flex items-center justify-center gap-2 text-architect-600 dark:text-architect-400"
            >
              <Plus className="w-4 h-4" />
              Добавить этап
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
