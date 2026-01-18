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
      <div className="bg-white dark:bg-architect-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
          <div className="flex items-center gap-3">
            {currentStage && (
              <div
                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: currentStage.color }}
              >
                {currentStage.name}
              </div>
            )}
            <h2 className="text-xl font-semibold text-architect-900 dark:text-architect-100">
              {deal.leadName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Tabs */}
        <div className="flex border-b border-architect-200 dark:border-architect-700">
          {[
            { id: 'info', label: 'Основная информация', icon: FileText },
            { id: 'timeline', label: 'История', icon: MessageSquare },
            { id: 'files', label: 'Файлы', icon: FileText },
            { id: 'related', label: 'Связанные', icon: Link2 },
            { id: 'activity', label: 'Активность', icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-architect-900 dark:border-white text-architect-900 dark:text-white'
                  : 'border-transparent text-architect-500 hover:text-architect-700 dark:hover:text-architect-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Телефон</label>
                  <div className="text-sm text-architect-900 dark:text-architect-100">{deal.phone}</div>
                </div>
                {deal.email && (
                  <div>
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Email</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100">{deal.email}</div>
                  </div>
                )}
                {deal.address && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Адрес</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100">{deal.address}</div>
                  </div>
                )}
                {deal.repairType && (
                  <div>
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Тип ремонта</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100">{deal.repairType}</div>
                  </div>
                )}
                {deal.area && (
                  <div>
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Площадь</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100">{deal.area} м²</div>
                  </div>
                )}
                {(deal.budgetFrom || deal.budgetTo) && (
                  <div>
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Бюджет</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100">
                      {deal.budgetFrom && deal.budgetTo
                        ? `${(deal.budgetFrom / 1000).toFixed(0)}K - ${(deal.budgetTo / 1000).toFixed(0)}K ₽`
                        : deal.budgetFrom
                        ? `от ${(deal.budgetFrom / 1000).toFixed(0)}K ₽`
                        : `до ${(deal.budgetTo! / 1000).toFixed(0)}K ₽`}
                    </div>
                  </div>
                )}
                {deal.source && (
                  <div>
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Источник</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100">
                      {deal.source.icon} {deal.source.name}
                    </div>
                  </div>
                )}
                {deal.responsibleManager && (
                  <div>
                    <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Менеджер</label>
                    <div className="text-sm text-architect-900 dark:text-architect-100">
                      {deal.responsibleManager.name || deal.responsibleManager.email}
                    </div>
                  </div>
                )}
              </div>

              {/* Move to stage */}
              {hasPermission('edit_deals') && (
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium mb-2">Переместить на этап</label>
                  <select
                    value={deal.stageId}
                    onChange={(e) => handleMoveStage(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-architect-700 dark:text-white"
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && <TimelineView dealId={deal.id} />}

          {activeTab === 'files' && (
            <div className="text-center py-8 text-architect-500 dark:text-architect-400">
              Функционал загрузки файлов будет добавлен позже
            </div>
          )}

          {activeTab === 'related' && (
            <div className="space-y-4">
              <div className="bg-architect-50 dark:bg-architect-900 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Смета/Проект</h3>
                {deal.projectId ? (
                  <div>
                    <p className="text-sm text-architect-600 dark:text-architect-400">
                      Смета создана: #{deal.projectId}
                    </p>
                    <button className="mt-2 text-sm text-architect-900 dark:text-architect-100 hover:underline">
                      Открыть смету
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-architect-600 dark:text-architect-400 mb-2">
                      Смета не создана
                    </p>
                    <button
                      onClick={handleCreateProject}
                      className="px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 text-sm"
                    >
                      Создать смету
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Дней на этапе</label>
                <div className="text-sm text-architect-900 dark:text-architect-100">{deal.daysOnStage}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-architect-500 dark:text-architect-400">Дата создания</label>
                <div className="text-sm text-architect-900 dark:text-architect-100">
                  {new Date(deal.createdAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
