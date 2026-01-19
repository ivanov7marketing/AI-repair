import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ArrowLeft, Save, ChevronDown } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { api } from '../../services/api';
import { PipelineStage, DealSource } from '../../types';
import { PipelineStageColumn } from './PipelineStageColumn';
import { DraggableStageColumn } from './DraggableStageColumn';
import { DuplicateControlModal } from './DuplicateControlModal';
import { TriggerSettingsModal } from './TriggerSettingsModal';

interface PipelineSettingsProps {
  onClose: () => void;
  onUpdate: () => void;
  hasPermission?: (permission: string) => boolean;
}

export const PipelineSettings: React.FC<PipelineSettingsProps> = ({ 
  onClose, 
  onUpdate,
  hasPermission = () => true 
}) => {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [sources, setSources] = useState<DealSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelineName, setPipelineName] = useState('Ремонты');
  const [editingPipelineName, setEditingPipelineName] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDuplicateControlModal, setShowDuplicateControlModal] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [selectedStageForTrigger, setSelectedStageForTrigger] = useState<PipelineStage | null>(null);
  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const [showAddStageForm, setShowAddStageForm] = useState(false);
  const [newStage, setNewStage] = useState({
    name: '',
    color: '#3B82F6',
    stageType: 'active' as 'active' | 'won' | 'lost' | 'system',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stagesData, sourcesData] = await Promise.all([
        api.getPipelineStages(),
        api.getDealSources()
      ]);
      setStages(stagesData);
      setSources(sourcesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePipelineName = () => {
    // TODO: Сохранить название воронки в БД (пока храним локально)
    setEditingPipelineName(false);
  };

  const handleSave = async () => {
    // Сохранение всех изменений уже происходит автоматически при редактировании
    // Здесь можно добавить дополнительную логику сохранения если нужно
    setHasUnsavedChanges(false);
    await loadData();
    onUpdate();
    onClose();
  };

  const handleCancel = () => {
    if (hasUnsavedChanges && !confirm('У вас есть несохраненные изменения. Закрыть без сохранения?')) {
      return;
    }
    onClose();
  };

  const handleStageNameChange = async (id: string, name: string) => {
    try {
      await api.updatePipelineStage(id, { name });
      await loadData();
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Failed to update stage name:', error);
      alert('Ошибка при обновлении названия этапа');
    }
  };

  const handleStageColorChange = async (id: string, color: string) => {
    try {
      await api.updatePipelineStage(id, { color });
      await loadData();
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Failed to update stage color:', error);
      alert('Ошибка при обновлении цвета этапа');
    }
  };

  const handleStageDelete = async (id: string) => {
    const stage = stages.find(s => s.id === id);
    if (!stage) return;

    if (stage.isDefault) {
      alert('Нельзя удалить дефолтный этап');
      return;
    }

    if (!confirm(`Удалить этап "${stage.name}"?`)) return;

    try {
      await api.deletePipelineStage(id);
      await loadData();
      setHasUnsavedChanges(true);
    } catch (error: any) {
      alert(error.message || 'Ошибка при удалении этапа');
    }
  };

  const handleAddTrigger = (stage: PipelineStage) => {
    setSelectedStageForTrigger(stage);
    setShowTriggerModal(true);
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
      setShowAddStageForm(false);
      await loadData();
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Failed to create stage:', error);
      alert('Ошибка при создании этапа');
    }
  };

  const handleStageDragStart = (event: any) => {
    const { active } = event;
    const stage = stages.find(s => s.id === active.id);
    setActiveStage(stage || null);
  };

  const handleStageDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStage(null);

    if (!over || active.id === over.id) return;

    const activeIndex = stages.findIndex(s => s.id === active.id);
    const overIndex = stages.findIndex(s => s.id === over.id);

    if (activeIndex === -1 || overIndex === -1) return;

    const newStages = [...stages];
    const [moved] = newStages.splice(activeIndex, 1);
    newStages.splice(overIndex, 0, moved);

    const stageOrders = newStages.map((stage, index) => ({
      id: stage.id,
      orderIndex: index + 1,
    }));

    try {
      await api.reorderPipelineStages(stageOrders);
      await loadData();
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Failed to reorder stages:', error);
      alert('Ошибка при изменении порядка этапов');
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
    <div className="w-full h-full bg-white dark:bg-architect-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700 shrink-0">
        <div className="flex items-center gap-4">
          {/* Название воронки */}
          {editingPipelineName ? (
            <input
              type="text"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              onBlur={handleSavePipelineName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSavePipelineName();
                } else if (e.key === 'Escape') {
                  setEditingPipelineName(false);
                  setPipelineName('Ремонты');
                }
              }}
              autoFocus
              className="text-xl font-semibold px-2 py-1 border border-architect-300 dark:border-architect-600 rounded bg-white dark:bg-architect-700 text-architect-900 dark:text-architect-100 focus:outline-none focus:border-architect-500"
            />
          ) : (
            <div className="flex items-center gap-2">
              <h1 
                onClick={() => hasPermission('MANAGE_PIPELINE') && setEditingPipelineName(true)}
                className={`text-xl font-semibold text-architect-900 dark:text-architect-100 ${hasPermission('MANAGE_PIPELINE') ? 'cursor-pointer hover:text-architect-600 dark:hover:text-architect-300' : ''}`}
              >
                {pipelineName}
              </h1>
              {hasPermission('MANAGE_PIPELINE') && (
                <button
                  onClick={() => setEditingPipelineName(true)}
                  className="text-architect-500 hover:text-architect-700 dark:hover:text-architect-300"
                >
                  <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 flex items-center gap-2 text-architect-700 dark:text-architect-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 flex items-center gap-2 font-medium"
          >
            <Save className="w-4 h-4" />
            Сохранить
          </button>
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r border-architect-200 dark:border-architect-700 overflow-y-auto p-4 space-y-6">
          {/* ИСТОЧНИКИ СДЕЛОК */}
          <div>
            <h2 className="text-sm font-semibold uppercase text-architect-700 dark:text-architect-300 mb-3">
              ИСТОЧНИКИ СДЕЛОК
            </h2>

            {/* Карточки источников */}
            {sources.map((source) => (
              <div key={source.id} className="bg-white dark:bg-architect-900 rounded-lg border border-architect-200 dark:border-architect-700 p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {source.icon && <span>{source.icon}</span>}
                    <h3 className="font-medium text-architect-900 dark:text-architect-100">
                      {source.name}
                    </h3>
                  </div>
                  {hasPermission('MANAGE_PIPELINE') && (
                    <button
                      onClick={async () => {
                        try {
                          await api.updateDealSource(source.id, { isActive: !source.isActive });
                          await loadData();
                          setHasUnsavedChanges(true);
                        } catch (error) {
                          console.error('Failed to toggle source:', error);
                          alert('Ошибка при изменении источника');
                        }
                      }}
                      className={`relative inline-block w-10 h-5 rounded-full transition-colors ${
                        source.isActive ? 'bg-blue-500' : 'bg-architect-300 dark:bg-architect-600'
                      }`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${
                        source.isActive ? 'right-1' : 'left-1'
                      }`}></div>
                    </button>
                  )}
                </div>
                {(source.name === 'Сайт' || 
                  source.name === 'Телеграм' || 
                  source.name === 'Instagram' ||
                  source.name === 'Email') && (
                  <button 
                    onClick={() => {
                      // TODO: Реализовать подключение источника
                      alert(`Подключение ${source.name} будет реализовано позже`);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Подключить
                  </button>
                )}
                {(source.name === 'ВКонтакте' || source.name.toLowerCase().includes('вк')) && (
                  <button 
                    onClick={() => {
                      // TODO: Реализовать подключение источника
                      alert(`Подключение ВКонтакте будет реализовано позже`);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Подключить
                  </button>
                )}
              </div>
            ))}

            {/* Кнопка "+ Добавить" */}
            {hasPermission('MANAGE_PIPELINE') && (
              <button className="w-full px-4 py-2 border border-dashed border-architect-300 dark:border-architect-600 rounded-lg hover:border-architect-400 dark:hover:border-architect-500 flex items-center justify-center gap-2 text-architect-600 dark:text-architect-400 text-sm">
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            )}
          </div>

          {/* Контроль дублей */}
          <div>
            <div className="bg-white dark:bg-architect-900 rounded-lg border border-architect-200 dark:border-architect-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-architect-900 dark:text-architect-100">
                  Контроль дублей
                </h3>
                {hasPermission('MANAGE_PIPELINE') && (
                  <button className="relative inline-block w-10 h-5 bg-architect-300 dark:bg-architect-600 rounded-full">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </button>
                )}
              </div>
              <p className="text-xs text-architect-600 dark:text-architect-400 mb-2">
                Установите параметры проверки входящей заявки на дубль
              </p>
              <button
                onClick={() => setShowDuplicateControlModal(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Настроить правила
              </button>
            </div>
          </div>
        </div>

        {/* Right Content - Kanban Board */}
        <div className="flex-1 overflow-y-auto p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleStageDragStart}
            onDragEnd={handleStageDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              <SortableContext items={stages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                {stages.map((stage) => (
                  <DraggableStageColumn
                    key={stage.id}
                    stage={stage}
                    onNameChange={handleStageNameChange}
                    onColorChange={handleStageColorChange}
                    onDelete={handleStageDelete}
                    onAddTrigger={handleAddTrigger}
                    hasPermission={hasPermission}
                  />
                ))}
              </SortableContext>

              {/* Add Stage Button */}
              {hasPermission('MANAGE_PIPELINE') && (
                <div className="flex-shrink-0 w-80">
                  {showAddStageForm ? (
                    <div className="bg-white dark:bg-architect-900 rounded-lg border border-architect-200 dark:border-architect-700 p-4">
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Название этапа"
                          value={newStage.name}
                          onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newStage.color}
                            onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
                            className="w-10 h-8 border border-architect-200 dark:border-architect-700 rounded cursor-pointer"
                          />
                          <select
                            value={newStage.stageType}
                            onChange={(e) => setNewStage({ ...newStage, stageType: e.target.value as any })}
                            className="flex-1 px-2 py-1.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded text-sm"
                          >
                            <option value="active">Активный</option>
                            <option value="won">Выигранный</option>
                            <option value="lost">Проигранный</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddStage}
                            className="flex-1 px-3 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded text-sm hover:bg-architect-800 dark:hover:bg-architect-100"
                          >
                            Добавить
                          </button>
                          <button
                            onClick={() => {
                              setShowAddStageForm(false);
                              setNewStage({ name: '', color: '#3B82F6', stageType: 'active' });
                            }}
                            className="px-3 py-2 border border-architect-200 dark:border-architect-700 rounded text-sm hover:bg-architect-50 dark:hover:bg-architect-700"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddStageForm(true)}
                      className="w-full h-32 border-2 border-dashed border-architect-300 dark:border-architect-600 rounded-lg hover:border-architect-400 dark:hover:border-architect-500 flex items-center justify-center gap-2 text-architect-600 dark:text-architect-400"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Добавить этап</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <DragOverlay>
              {activeStage ? (
                <div className="opacity-50 rotate-3 w-80">
                  <PipelineStageColumn
                    stage={activeStage}
                    isDragging={true}
                    onNameChange={() => {}}
                    onColorChange={() => {}}
                    onDelete={() => {}}
                    onAddTrigger={() => {}}
                    hasPermission={hasPermission}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Modals */}
      <DuplicateControlModal
        isOpen={showDuplicateControlModal}
        onClose={() => setShowDuplicateControlModal(false)}
        onSave={() => {
          // TODO: Сохранение настроек контроля дублей
        }}
      />

      <TriggerSettingsModal
        isOpen={showTriggerModal}
        stage={selectedStageForTrigger}
        onClose={() => {
          setShowTriggerModal(false);
          setSelectedStageForTrigger(null);
        }}
        onSave={() => {
          // TODO: Сохранение триггера
        }}
      />
    </div>
  );
};
