import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PipelineStage, Deal } from '../../types';
import { DraggableDealCard } from './DraggableDealCard';

interface DroppableStageProps {
  stage: PipelineStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onMoveStage: (dealId: string, newStageId: string) => void;
  onCreateDeal: () => void;
  stages: PipelineStage[];
  isFirstStage?: boolean;
}

export const DroppableStage: React.FC<DroppableStageProps> = ({
  stage,
  deals,
  onDealClick,
  onMoveStage,
  onCreateDeal,
  stages,
  isFirstStage = false,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
  });

  const stats = {
    count: deals.length,
    totalBudget: deals.reduce((sum, deal) => sum + (deal.budgetTo || deal.budgetFrom || 0), 0),
  };

  // Форматируем бюджет с пробелами: "1 655 333 ₽"
  const formatBudget = (amount: number) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  };

  // Определяем правильное склонение слова "сделка"
  const getDealWord = (count: number) => {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return 'сделок';
    }
    if (lastDigit === 1) {
      return 'сделка';
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'сделки';
    }
    return 'сделок';
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-architect-50 dark:bg-architect-900 rounded-lg p-3 ${isOver ? 'ring-2 ring-architect-500' : ''}`}
    >
      {/* Stage Header */}
      <div className="mb-3">
        {/* Первая строка: Название этапа */}
        <h3 className="text-[16px] font-semibold uppercase text-architect-900 dark:text-architect-100 mb-1">
          {stage.name}
        </h3>
        
        {/* Вторая строка: Количество сделок слева, бюджет справа */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[14px] font-normal text-architect-500 dark:text-architect-400">
            {stats.count} {getDealWord(stats.count)}
          </span>
          {stats.totalBudget > 0 && (
            <span className="text-[14px] font-normal text-architect-500 dark:text-architect-400">
              {formatBudget(stats.totalBudget)}
            </span>
          )}
        </div>
        
        {/* Цветная линия под заголовком */}
        <div
          className="h-1 rounded"
          style={{ backgroundColor: stage.color }}
        />
      </div>

      {/* Stage Deals */}
      <SortableContext
        items={deals.map(d => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick(deal)}
              stages={stages}
              onMoveStage={onMoveStage}
            />
          ))}
          {deals.length === 0 && (
            <div className="text-center py-8 text-architect-400 dark:text-architect-500 text-sm">
              Нет сделок
            </div>
          )}
          {/* Add deal button at the bottom of first stage */}
          {isFirstStage && (
            <div className="mt-3 pt-3 border-t border-architect-200 dark:border-architect-700">
              <button
                onClick={onCreateDeal}
                className="w-full px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 flex items-center justify-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Новая сделка
              </button>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};
