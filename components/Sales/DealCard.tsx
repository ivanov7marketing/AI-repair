import React from 'react';
import { Phone, MapPin, Home, DollarSign, Clock } from 'lucide-react';
import { Deal } from '../../types';

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onClick }) => {
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

  const getTemperatureIcon = () => {
    switch (deal.leadTemperature) {
      case 'hot':
        return '🔥';
      case 'warm':
        return '🌡️';
      case 'cold':
        return '❄️';
      default:
        return '';
    }
  };

  const getDaysColor = () => {
    if (deal.daysOnStage <= 3) return 'text-green-600 dark:text-green-400';
    if (deal.daysOnStage <= 7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
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

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div
      className={`bg-white dark:bg-architect-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-3 ${getTemperatureColor()}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-sm">{getTemperatureIcon()}</span>
          <span className="font-semibold text-sm text-architect-900 dark:text-architect-100 truncate">
            {deal.leadName}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-architect-600 dark:text-architect-400">
        <div className="flex items-center gap-1.5">
          <Phone className="w-3 h-3 shrink-0" />
          <span className="truncate">{deal.phone}</span>
        </div>

        {deal.address && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{truncateText(deal.address, 30)}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Home className="w-3 h-3 shrink-0" />
          <span>
            {deal.repairType || 'Не указан'}
            {deal.area && ` • ${deal.area}м²`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3 h-3 shrink-0" />
          <span>{formatBudget()}</span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-architect-100 dark:border-architect-700">
          <div className="flex items-center gap-1">
            {deal.source?.icon && <span>{deal.source.icon}</span>}
            <span className="text-xs">{deal.source?.name || 'Не указан'}</span>
          </div>
          <div className={`flex items-center gap-1 ${getDaysColor()}`}>
            <Clock className="w-3 h-3" />
            <span className="text-xs font-medium">{deal.daysOnStage} дн.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
