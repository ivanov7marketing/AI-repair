import React, { useState } from 'react';
import { X, Edit, Trash2, FileText, Link2, Activity, MessageSquare } from 'lucide-react';
import { Deal, PipelineStage, User, DealSource } from '../../types';
import { api } from '../../services/api';
import { TimelineView } from './TimelineView';

interface DealModalProps {
  deal: Deal;
  onClose: () => void;
  onEdit: (deal: Deal) => void;
  onUpdate: () => void;
  stages: PipelineStage[];
  users: User[];
  sources: DealSource[];
  hasPermission: (permission: string) => boolean;
}

export const DealModal: React.FC<DealModalProps> = ({
  deal,
  onClose,
  onEdit,
  onUpdate,
  stages,
  users,
  sources,
  hasPermission,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'files' | 'related' | 'activity'>('info');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту сделку?')) return;

    try {
      setDeleting(true);
      await api.deleteDeal(deal.id);
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Failed to delete deal:', error);
      alert('Ошибка при удалении сделки');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveStage = async (newStageId: string) => {
    try {
      await api.moveDeal(deal.id, newStageId);
      onUpdate();
    } catch (error) {
      console.error('Failed to move deal:', error);
      alert('Ошибка при перемещении сделки');
    }
  };

  const handleCreateProject = () => {
    sessionStorage.setItem('createProjectFromDeal', deal.id);
    sessionStorage.setItem('projectFromDealData', JSON.stringify({
      name: `Смета для ${deal.leadName}`,
      address: deal.address,
      area: deal.area,
      repairType: deal.repairType,
      budget: deal.budgetTo || deal.budgetFrom,
    }));
    // Will be handled in App.tsx
    onClose();
    window.dispatchEvent(new Event('navigateToProjects'));
  };

  const currentStage = stages.find(s => s.id === deal.stageId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg mr-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
              {deal.leadName}
            </h2>
            <span className="text-sm text-architect-500 dark:text-architect-400">#{deal.id.slice(0, 8)}</span>
            <button className="px-2 py-1 text-xs border border-architect-200 dark:border-architect-700 rounded hover:bg-architect-50 dark:hover:bg-architect-700">
              #ТЕГИРОВАТЬ
            </button>
          </div>
          <div className="flex items-center gap-2">
            {currentStage && (
              <div
                className="px-3 py-1.5 rounded text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: currentStage.color }}
              >
                {currentStage.name}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
            {hasPermission('edit_deals') && (
              <button
                onClick={() => onEdit(deal)}
                className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            {hasPermission('delete_deals') && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg text-red-600 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Deal details */}
          <div className="w-1/2 border-r border-architect-200 dark:border-architect-700 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Отв-ный:</label>
                  <div className="text-sm text-architect-900 dark:text-architect-100 text-right">
                    {deal.responsibleManager ? (deal.responsibleManager.name || deal.responsibleManager.email) : 'Не назначен'}
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Бюджет:</label>
                  <div className="text-sm text-architect-900 dark:text-architect-100 text-right">
                    {(deal.budgetFrom || deal.budgetTo)
                      ? (deal.budgetFrom && deal.budgetTo
                        ? `${(deal.budgetFrom / 1000).toFixed(0)}K - ${(deal.budgetTo / 1000).toFixed(0)}K ₽`
                        : deal.budgetFrom
                        ? `от ${(deal.budgetFrom / 1000).toFixed(0)}K ₽`
                        : `до ${(deal.budgetTo! / 1000).toFixed(0)}K ₽`)
                      : '0 ₽'}
                  </div>
                </div>
                {deal.area && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Площадь:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.area}</div>
                  </div>
                )}
                {deal.repairType && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Тип ремонта:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.repairType}</div>
                  </div>
                )}
                {deal.objectCondition && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Состояние:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.objectCondition}</div>
                  </div>
                )}
                {deal.roomsCount && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Комнаты:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.roomsCount}</div>
                  </div>
                )}
                {deal.bathroomType && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Санузел:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.bathroomType}</div>
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Электрика:</label>
                  <div className="text-sm text-architect-900 dark:text-architect-400 text-right">...</div>
                </div>
                <div className="flex justify-between items-start">
                  <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Сантехника:</label>
                  <div className="text-sm text-architect-900 dark:text-architect-400 text-right">...</div>
                </div>
                {deal.phone && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Телефон:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.phone}</div>
                  </div>
                )}
                {deal.email && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Email:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.email}</div>
                  </div>
                )}
                {deal.address && (
                  <div className="flex justify-between items-start">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Адрес:</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100 text-right">{deal.address}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right panel - Timeline and comments */}
          <div className="w-1/2 overflow-y-auto p-4">
            <TimelineView dealId={deal.id} onUpdate={onUpdate} />
          </div>
        </div>
      </div>
    </div>
  );
};
