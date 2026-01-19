import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Deal, PipelineStage, DealTask } from '../../types';

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  stages?: PipelineStage[];
  onMoveStage?: (dealId: string, newStageId: string) => void;
  tasks?: DealTask[];
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onClick, stages, onMoveStage, tasks = [] }) => {
  const [showStageMenu, setShowStageMenu] = useState(false);
  const getTemperatureColor = () => {
    switch (deal.leadTemperature) {
      case 'hot':
        return 'border-l-4 border-red-500';
      case 'warm':
        return 'border-l-4 border-yellow-500';
      case 'cold':
        return 'border-l-4 border-blue-500';
      default:
        return 'border-l-4 border-gray-300';
    }
  };

  const formatBudget = () => {
    if (deal.budgetFrom && deal.budgetTo) {
      return `${(deal.budgetFrom / 1000).toFixed(0)}K - ${(deal.budgetTo / 1000).toFixed(0)}K ₽`;
    }
    if (deal.budgetFrom) {
      return `от ${(deal.budgetFrom / 1000).toFixed(0)}K ₽`;
    }
    if (deal.budgetTo) {
      return `до ${(deal.budgetTo / 1000).toFixed(0)}K ₽`;
    }
    return 'Не указан';
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const getDealName = () => {
    // Use dealName if available, otherwise fallback to leadName or generate
    if (deal.dealName) {
      return deal.dealName;
    }
    if (deal.leadName) {
      return deal.leadName;
    }
    // Fallback: generate from id
    const digits = deal.id.replace(/[^0-9]/g, '');
    let dealNum = '001';
    if (digits.length >= 3) {
      dealNum = digits.slice(-3);
    } else if (digits.length > 0) {
      dealNum = digits.padStart(3, '0');
    } else {
      let hash = 0;
      for (let i = 0; i < deal.id.length; i++) {
        hash = ((hash << 5) - hash) + deal.id.charCodeAt(i);
        hash = hash & hash;
      }
      dealNum = String(Math.abs(hash) % 1000).padStart(3, '0');
    }
    return `Сделка ${dealNum}`;
  };

  const getTaskIndicator = () => {
    // Красный кружок - если есть просроченные задачи
    const hasOverdue = tasks.some(task => 
      task.dueDate && 
      !task.completed && 
      new Date(task.dueDate) < new Date()
    );
    if (hasOverdue) {
      return 'bg-red-500';
    }

    // Зеленый кружок - если есть задачи
    if (tasks.length > 0) {
      return 'bg-green-500';
    }

    // Оранжевый кружок - если задач нет
    return 'bg-orange-500';
  };

  const handleStageSelect = (e: React.MouseEvent, newStageId: string) => {
    e.stopPropagation();
    if (onMoveStage && newStageId !== deal.stageId) {
      onMoveStage(deal.id, newStageId);
    }
    setShowStageMenu(false);
  };

  return (
    <div
      data-deal-card
      className={`bg-white dark:bg-architect-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-3 ${getTemperatureColor()} relative`}
      onClick={onClick}
    >
      {/* Первая строка: Имя (слева) + Дата (справа) */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-normal text-architect-900 dark:text-architect-100 truncate">
          {deal.leadName}
        </span>
        <span className="text-[12px] font-normal text-architect-600 dark:text-architect-400 shrink-0 ml-2">
          {formatDate(deal.createdAt)}
        </span>
      </div>

      {/* Вторая строка: Название сделки (слева) */}
      <div className="mb-1">
        <span className="text-[14px] font-semibold text-architect-600 dark:text-architect-400 truncate block">
          {getDealName()}
        </span>
      </div>

      {/* Третья строка: Бюджет (слева) + Индикатор задач (справа) */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-normal text-architect-600 dark:text-architect-400 truncate">
          {formatBudget()}
        </span>
        <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${getTaskIndicator()}`} />
      </div>

      {/* Stage selector */}
      {stages && onMoveStage && stages.length > 0 && (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStageMenu(!showStageMenu);
            }}
            className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded"
          >
            <ChevronDown className="w-3 h-3 text-architect-500" />
          </button>
          {showStageMenu && (
            <div
              className="absolute right-0 top-6 z-50 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 text-xs font-medium text-architect-500 dark:text-architect-400 border-b border-architect-200 dark:border-architect-700">
                Переместить на этап:
              </div>
              {stages
                .filter(s => s.id !== deal.stageId)
                .map((stage) => (
                  <button
                    key={stage.id}
                    onClick={(e) => handleStageSelect(e, stage.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-architect-50 dark:hover:bg-architect-700 flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span>{stage.name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
