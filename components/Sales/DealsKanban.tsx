import React, { useState, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import { api } from '../../services/api';
import { Deal, PipelineStage, DealSource, User } from '../../types';
import { DealCard } from './DealCard';
import { DealsFilters } from './DealsFilters';
import { DealForm } from './DealForm';
import { DealModal } from './DealModal';

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-architect-900 dark:text-architect-100">Продажи</h1>
        <div className="flex gap-2">
          {hasPermission('manage_pipeline') && (
            <button className="px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 flex items-center gap-2 text-sm font-medium">
              <Settings className="w-4 h-4" />
              Настройки воронки
            </button>
          )}
          {hasPermission('create_deals') && (
            <button
              onClick={() => {
                setEditingDeal(undefined);
                setShowDealForm(true);
              }}
              className="px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Новая сделка
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
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

      {/* Kanban Board */}
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
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {stages.map((stage) => {
          const stageDeals = getDealsForStage(stage.id);
          const stats = calculateStageStats(stage.id);

          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80 bg-architect-50 dark:bg-architect-900 rounded-lg p-3"
            >
              {/* Stage Header */}
              <div className="mb-3">
                <div
                  className="h-1 rounded mb-2"
                  style={{ backgroundColor: stage.color }}
                />
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-architect-900 dark:text-architect-100">
                    {stage.name}
                  </h3>
                  <span className="text-sm text-architect-500 dark:text-architect-400">
                    {stats.count}
                  </span>
                </div>
                {stats.totalBudget > 0 && (
                  <div className="text-xs text-architect-500 dark:text-architect-400 mt-1">
                    {(stats.totalBudget / 1000).toFixed(0)}K ₽
                  </div>
                )}
              </div>

              {/* Stage Deals */}
              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => handleDealClick(deal)}
                  />
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-center py-8 text-architect-400 dark:text-architect-500 text-sm">
                    Нет сделок
                  </div>
                )}
              </div>

              {/* Move to stage dropdown (simplified - can be enhanced with drag & drop) */}
              {stageDeals.length > 0 && (
                <div className="mt-3 pt-3 border-t border-architect-200 dark:border-architect-700">
                  <select
                    onChange={(e) => {
                      if (e.target.value && e.target.value !== stage.id) {
                        const dealId = e.target.value.split('_')[0];
                        const newStageId = e.target.value.split('_')[1];
                        handleMoveDeal(dealId, newStageId);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-2 py-1 text-xs border rounded dark:bg-architect-800 dark:text-white"
                  >
                    <option value="">Переместить сделку...</option>
                    {stageDeals.map((deal) =>
                      stages
                        .filter(s => s.id !== stage.id)
                        .map((targetStage) => (
                          <option key={`${deal.id}_${targetStage.id}`} value={`${deal.id}_${targetStage.id}`}>
                            {deal.leadName} → {targetStage.name}
                          </option>
                        ))
                    )}
                  </select>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

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
          onClose={() => setSelectedDeal(null)}
          onEdit={(deal) => {
            setEditingDeal(deal);
            setSelectedDeal(null);
            setShowDealForm(true);
          }}
          onUpdate={loadDeals}
          stages={stages}
          users={users}
          sources={sources}
          hasPermission={hasPermission}
        />
      )}
    </div>
  );
};
