import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Deal, PipelineStage } from '../../types';
import { DealCard } from './DealCard';

interface DraggableDealCardProps {
  deal: Deal;
  onClick: () => void;
  stages?: PipelineStage[];
  onMoveStage?: (dealId: string, newStageId: string) => void;
}

export const DraggableDealCard: React.FC<DraggableDealCardProps> = ({
  deal,
  onClick,
  stages,
  onMoveStage,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard
        deal={deal}
        onClick={onClick}
        stages={stages}
        onMoveStage={onMoveStage}
      />
    </div>
  );
};
