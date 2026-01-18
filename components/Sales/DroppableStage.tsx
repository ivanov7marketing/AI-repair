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

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-architect-50 dark:bg-architect-900 rounded-lg p-3 ${isOver ? 'ring-2 ring-architect-500' : ''}`}
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
      <SortableContext
        items={deals.map(d => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto min-h-[100px]">
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
