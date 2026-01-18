import React from 'react';
import { MessageSquare, ArrowRight, Phone, Mail, CheckSquare, FileText, Edit, Plus } from 'lucide-react';
import { DealTimelineEvent } from '../../types';

interface TimelineEventProps {
  event: DealTimelineEvent;
}

export const TimelineEvent: React.FC<TimelineEventProps> = ({ event }) => {
  const getEventIcon = () => {
    switch (event.eventType) {
      case 'comment':
        return <MessageSquare className="w-4 h-4" />;
      case 'stage_change':
        return <ArrowRight className="w-4 h-4" />;
      case 'call':
        return <Phone className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'task':
        return <CheckSquare className="w-4 h-4" />;
      case 'file_upload':
        return <FileText className="w-4 h-4" />;
      case 'field_change':
        return <Edit className="w-4 h-4" />;
      case 'deal_created':
        return <Plus className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getEventColor = () => {
    switch (event.eventType) {
      case 'stage_change':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'deal_created':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'field_change':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-architect-100 dark:bg-architect-700 text-architect-800 dark:text-architect-200';
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const renderContent = () => {
    if (event.eventType === 'field_change' && event.metadata) {
      const { field, oldValue, newValue } = event.metadata;
      return (
        <div>
          <div className="font-medium">{event.content}</div>
          <div className="text-sm text-architect-600 dark:text-architect-400 mt-1">
            <span className="line-through">{oldValue || 'пусто'}</span>
            {' → '}
            <span className="font-medium">{newValue || 'пусто'}</span>
          </div>
        </div>
      );
    }

    if (event.eventType === 'stage_change' && event.metadata) {
      const { oldStageName, newStageName } = event.metadata;
      return (
        <div>
          <div className="font-medium">{event.content}</div>
          <div className="text-sm text-architect-600 dark:text-architect-400 mt-1">
            {oldStageName} → {newStageName}
          </div>
        </div>
      );
    }

    return <div className="font-medium">{event.content}</div>;
  };

  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor()}`}>
        {getEventIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-architect-900 dark:text-architect-100">
            {event.user?.name || 'Система'}
          </span>
          <span className="text-xs text-architect-500 dark:text-architect-400">
            {formatDate(event.createdAt)}
          </span>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};
