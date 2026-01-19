import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { PipelineStage } from '../../types';

interface PipelineStageColumnProps {
  stage: PipelineStage;
  isDragging: boolean;
  onNameChange: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onAddTrigger: (stage: PipelineStage) => void;
  hasPermission: (permission: string) => boolean;
}

export const PipelineStageColumn: React.FC<PipelineStageColumnProps> = ({
  stage,
  isDragging,
  onNameChange,
  onColorChange,
  onDelete,
  onAddTrigger,
  hasPermission,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(stage.name);

  const handleNameBlur = () => {
    if (tempName.trim() && tempName !== stage.name) {
      onNameChange(stage.id, tempName.trim());
    } else {
      setTempName(stage.name);
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setTempName(stage.name);
      setEditingName(false);
    }
  };

  return (
    <div
      className={`flex-shrink-0 w-80 bg-architect-50 dark:bg-architect-900 rounded-lg p-3 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Stage Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          {editingName && hasPermission('MANAGE_PIPELINE') ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              autoFocus
              className="flex-1 px-2 py-1 text-base font-semibold uppercase bg-white dark:bg-architect-800 border border-architect-300 dark:border-architect-600 rounded text-architect-900 dark:text-architect-100 focus:outline-none focus:border-architect-500"
            />
          ) : (
            <h3
              onClick={() => hasPermission('MANAGE_PIPELINE') && setEditingName(true)}
              className={`flex-1 text-base font-semibold uppercase text-architect-900 dark:text-architect-100 ${
                hasPermission('MANAGE_PIPELINE') ? 'cursor-pointer hover:text-architect-600 dark:hover:text-architect-300' : ''
              }`}
            >
              {stage.name}
            </h3>
          )}
          <div className="flex items-center gap-1">
            {hasPermission('MANAGE_PIPELINE') && (
              <>
                <input
                  type="color"
                  value={stage.color}
                  onChange={(e) => onColorChange(stage.id, e.target.value)}
                  className="w-6 h-6 border border-architect-200 dark:border-architect-700 rounded cursor-pointer"
                  title="Изменить цвет"
                />
                {!stage.isDefault && (
                  <button
                    onClick={() => onDelete(stage.id)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                    title="Удалить этап"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Triggers Section */}
      <div className="mt-4 pt-4 border-t border-architect-200 dark:border-architect-700">
        <h4 className="text-xs font-semibold uppercase text-architect-600 dark:text-architect-400 mb-2">
          Триггеры
        </h4>
        {/* Список триггеров (пока пустой) */}
        {hasPermission('MANAGE_PIPELINE') && (
          <button
            onClick={() => onAddTrigger(stage)}
            className="w-full px-3 py-2 text-sm border border-dashed border-architect-300 dark:border-architect-600 rounded-lg hover:border-architect-400 dark:hover:border-architect-500 flex items-center justify-center gap-2 text-architect-600 dark:text-architect-400"
          >
            <Plus className="w-4 h-4" />
            Добавить тригер
          </button>
        )}
      </div>
    </div>
  );
};
