import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PipelineStage } from '../../types';
import { PipelineStageColumn } from './PipelineStageColumn';

interface DraggableStageColumnProps {
  stage: PipelineStage;
  onNameChange: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onAddTrigger: (stage: PipelineStage) => void;
  hasPermission: (permission: string) => boolean;
}

export const DraggableStageColumn: React.FC<DraggableStageColumnProps> = ({
  stage,
  onNameChange,
  onColorChange,
  onDelete,
  onAddTrigger,
  hasPermission,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PipelineStageColumn
        stage={stage}
        isDragging={isDragging}
        onNameChange={onNameChange}
        onColorChange={onColorChange}
        onDelete={onDelete}
        onAddTrigger={onAddTrigger}
        hasPermission={hasPermission}
      />
    </div>
  );
};
