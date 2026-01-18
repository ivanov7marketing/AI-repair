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

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger onClick if we didn't drag
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      onMouseDown={(e) => {
        // Allow clicks to work normally unless we're actually dragging
        const handleMouseUp = () => {
          document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mouseup', handleMouseUp);
      }}
    >
      <div {...listeners} style={{ touchAction: 'none' }}>
        <DealCard
          deal={deal}
          onClick={handleClick}
          stages={stages}
          onMoveStage={onMoveStage}
        />
      </div>
    </div>
  );
};
