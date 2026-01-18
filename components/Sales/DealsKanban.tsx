import React, { useState, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { api } from '../../services/api';
import { Deal, PipelineStage, DealSource, User } from '../../types';
import { DroppableStage } from './DroppableStage';
import { DealsFilters } from './DealsFilters';
import { DealForm } from './DealForm';
import { DealModal } from './DealModal';
import { PipelineSettings } from './PipelineSettings';
import { DealCard } from './DealCard';

interface DealsKanbanProps {
  hasPermission: (permission: string) => boolean;
}

export const DealsKanban: React.FC<DealsKanbanProps> = ({ hasPermission }) => {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [sources, setSources] = useState<DealSource[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [leadTemperature, setLeadTemperature] = useState<string | null>(null);
  const [budgetFrom, setBudgetFrom] = useState<number | null>(null);
  const [budgetTo, setBudgetTo] = useState<number | null>(null);

  // Modals
  const [showDealForm, setShowDealForm] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | undefined>();
  const [showPipelineSettings, setShowPipelineSettings] = useState(false);
  const [newDealIds, setNewDealIds] = useState<Set<string>>(new Set());
  
  // Drag & Drop
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag starts only after moving 8px
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDeals();
  }, [selectedManagers, selectedSources, leadTemperature, budgetFrom, budgetTo, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stagesData, sourcesData, usersData] = await Promise.all([
        api.getPipelineStages(),
        api.getDealSources(),
        api.getUsers(),
      ]);
      setStages(stagesData);
      setSources(sourcesData);
      setUsers(usersData);
      await loadDeals();
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const loadDeals = async () => {
    try {
      const params: any = {};
      if (selectedManagers.length > 0) {
        params.manager_id = selectedManagers[0]; // API supports single manager for now
      }
      if (selectedSources.length > 0) {
        params.source_id = selectedSources[0];
      }
      if (leadTemperature) {
        params.lead_temperature = leadTemperature;
      }
      if (budgetFrom) {
        params.budget_from = budgetFrom;
      }
      if (budgetTo) {
        params.budget_to = budgetTo;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const data = await api.getDeals(params);
      setDeals(data);
    } catch (error) {
      console.error('Failed to load deals:', error);
    }
  };

  const handleDealClick = async (deal: Deal) => {
    try {
      const fullDeal = await api.getDeal(deal.id);
      setSelectedDeal(fullDeal);
    } catch (error) {
      console.error('Failed to load deal:', error);
      setSelectedDeal(deal);
    }
  };

  const handleDealSave = () => {
    loadDeals();
    setShowDealForm(false);
    setEditingDeal(undefined);
  };

  const handleMoveDeal = async (dealId: string, newStageId: string) => {
    try {
      await api.moveDeal(dealId, newStageId);
      await loadDeals();
    } catch (error) {
      console.error('Failed to move deal:', error);
      alert('Ошибка при перемещении сделки');
    }
  };

  const handleDragStart = (event: any) => {
    const { active } = event;
    const deal = deals.find(d => d.id === active.id);
    setActiveDeal(deal || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = active.id as string;
    const overId = over.id as string;

    // If dropped on same position, do nothing
    const currentDeal = deals.find(d => d.id === dealId);
    if (!currentDeal) return;

    // Check if dragging to a stage (droppable zone)
    if (overId.startsWith('stage-')) {
      const targetStageId = overId.replace('stage-', '');
      if (targetStageId !== currentDeal.stageId) {
        await handleMoveDeal(dealId, targetStageId);
      }
      return;
    }

    // Check if dragging over another deal (move to same stage as that deal)
    const targetDeal = deals.find(d => d.id === overId);
    if (targetDeal && targetDeal.stageId !== currentDeal.stageId) {
      await handleMoveDeal(dealId, targetDeal.stageId);
      return;
    }
  };

  const handleDragCancel = () => {
    setActiveDeal(null);
  };

  const getDealsForStage = (stageId: string) => {
    return deals.filter(deal => deal.stageId === stageId);
  };

  const calculateStageStats = (stageId: string) => {
    const stageDeals = getDealsForStage(stageId);
    const count = stageDeals.length;
    const totalBudget = stageDeals.reduce((sum, deal) => {
      return sum + (deal.budgetTo || deal.budgetFrom || 0);
    }, 0);
    return { count, totalBudget };
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedManagers([]);
    setSelectedSources([]);
    setLeadTemperature(null);
    setBudgetFrom(null);
    setBudgetTo(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-architect-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 flex flex-col h-full overflow-hidden p-4 md:p-8">
      {/* Header with funnel name, search and settings button */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <span className="text-lg font-semibold text-architect-900 dark:text-architect-100 whitespace-nowrap shrink-0">
          Ремонты
        </span>
        <div className="flex-1 min-w-0">
          <DealsFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedManagers={selectedManagers}
            onManagersChange={setSelectedManagers}
            selectedSources={selectedSources}
            onSourcesChange={setSelectedSources}
            leadTemperature={leadTemperature}
            onTemperatureChange={setLeadTemperature}
            budgetFrom={budgetFrom}
            budgetTo={budgetTo}
            onBudgetChange={(from, to) => {
              setBudgetFrom(from);
              setBudgetTo(to);
            }}
            managers={users.filter(u => u.role === 'manager' || u.role === 'admin')}
            sources={sources}
            onReset={resetFilters}
          />
        </div>
        <button
          onClick={() => setShowPipelineSettings(true)}
          className="px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 flex items-center gap-2 text-sm font-medium shrink-0"
        >
          <Settings className="w-4 h-4" />
          Настройки воронки
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 mb-[10px]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {stages.length === 0 ? (
          <div className="bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 p-8 text-center">
            <p className="text-architect-600 dark:text-architect-400 mb-4">
              Воронка продаж не настроена. Нужно создать этапы воронки.
            </p>
            <p className="text-sm text-architect-500 dark:text-architect-500">
              Этапы воронки должны быть созданы автоматически при настройке организации.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto overflow-y-auto h-full">
          {stages.map((stage, index) => {
            const stageDeals = getDealsForStage(stage.id);
            const isFirstStage = stage.orderIndex === 1 || index === 0;
            return (
              <DroppableStage
                key={stage.id}
                stage={stage}
                deals={stageDeals}
                onDealClick={handleDealClick}
                onMoveStage={handleMoveDeal}
                onCreateDeal={async () => {
                  // Создаем сделку с временными значениями (обязательные поля не могут быть пустыми)
                  try {
                    const firstStage = stages.find(s => s.orderIndex === 1) || stages[0];
                    if (!firstStage) {
                      alert('Нет доступных этапов для создания сделки');
                      return;
                    }
                    
                    const newDeal = await api.createDeal({
                      leadName: 'Новая сделка',
                      phone: '+7',
                      stageId: firstStage.id,
                      leadTemperature: 'warm',
                    });
                    
                    // Помечаем как новую сделку (с временными значениями)
                    setNewDealIds(prev => new Set(prev).add(newDeal.id));
                    
                    // Открываем карточку сделки
                    setSelectedDeal(newDeal);
                  } catch (error: any) {
                    console.error('Failed to create deal:', error);
                    alert(error.message || 'Ошибка при создании сделки');
                  }
                }}
                stages={stages}
                isFirstStage={isFirstStage}
              />
            );
          })}
        </div>
        )}

          <DragOverlay>
          {activeDeal ? (
            <div className="opacity-50 rotate-3 w-80">
              <div className="bg-white dark:bg-architect-800 rounded-lg shadow-lg p-3 border-l-4 border-architect-500">
                <div className="font-semibold text-sm text-architect-900 dark:text-architect-100 mb-2">
                  {activeDeal.leadName}
                </div>
                <div className="text-xs text-architect-600 dark:text-architect-400">
                  {activeDeal.phone}
                </div>
              </div>
            </div>
          ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {showDealForm && (
        <DealForm
          deal={editingDeal}
          onClose={() => {
            setShowDealForm(false);
            setEditingDeal(undefined);
          }}
          onSave={handleDealSave}
          users={users}
          sources={sources}
        />
      )}

      {selectedDeal && (
        <DealModal
          deal={selectedDeal}
          onClose={async () => {
            // Если это новая сделка и она не была заполнена (остались временные значения), удаляем её
            if (newDealIds.has(selectedDeal.id)) {
              const hasDefaultValues = selectedDeal.leadName === 'Новая сделка' && selectedDeal.phone === '+7';
              if (hasDefaultValues) {
                try {
                  await api.deleteDeal(selectedDeal.id);
                  await loadDeals();
                } catch (error) {
                  console.error('Failed to delete empty deal:', error);
                }
              }
              setNewDealIds(prev => {
                const next = new Set(prev);
                next.delete(selectedDeal.id);
                return next;
              });
            }
            setSelectedDeal(null);
          }}
          onEdit={(deal) => {
            setEditingDeal(deal);
            setSelectedDeal(null);
            setShowDealForm(true);
          }}
          onUpdate={async () => {
            // При обновлении убираем из списка новых сделок
            if (newDealIds.has(selectedDeal.id)) {
              setNewDealIds(prev => {
                const next = new Set(prev);
                next.delete(selectedDeal.id);
                return next;
              });
            }
            await loadDeals();
            // Обновляем выбранную сделку, чтобы получить актуальные данные
            try {
              const updatedDeal = await api.getDeal(selectedDeal.id);
              setSelectedDeal(updatedDeal);
            } catch (error) {
              console.error('Failed to reload deal:', error);
            }
          }}
          stages={stages}
          users={users}
          sources={sources}
          hasPermission={hasPermission}
        />
      )}

      {showPipelineSettings && (
        <PipelineSettings
          onClose={() => setShowPipelineSettings(false)}
          onUpdate={() => {
            loadData();
            setShowPipelineSettings(false);
          }}
        />
      )}
    </div>
  );
};
