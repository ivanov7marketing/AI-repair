import React from 'react';
import { MessageSquare, ArrowRight, Phone, Mail, CheckSquare, FileText, Edit, Plus } from 'lucide-react';
import { DealTimelineEvent, User } from '../../types';

interface TimelineEventProps {
  event: DealTimelineEvent;
  users?: User[];
}

// Маппинг английских названий полей на русские (как в левом блоке карточки сделки)
const FIELD_LABELS: Record<string, string> = {
  'responsibleManagerId': 'Отв-ный',
  'leadName': 'Имя',
  'phone': 'Телефон',
  'email': 'E-mail',
  'address': 'Адрес',
  'budgetFrom': 'Бюджет',
  'area': 'Площадь',
  'repairType': 'Тип ремонта',
  'objectCondition': 'Состояние',
  'roomsCount': 'Комнаты',
  'bathroomType': 'Санузел',
  'telegram': 'Электрика',
  'whatsapp': 'Сантехника',
  'measurementNotes': 'Доп.работы',
  'materialPurchaseType': 'Подарок',
  'desiredStartDate': 'Удобное время',
  'measurementDate': 'День замера',
};

export const TimelineEvent: React.FC<TimelineEventProps> = ({ event, users = [] }) => {
  const getEventIcon = (size: 'normal' | 'small' = 'normal') => {
    const iconSize = size === 'small' ? 'w-2 h-2' : 'w-4 h-4';
    switch (event.eventType) {
      case 'comment':
        return <MessageSquare className={iconSize} />;
      case 'stage_change':
        return <ArrowRight className={iconSize} />;
      case 'call':
        return <Phone className={iconSize} />;
      case 'email':
        return <Mail className={iconSize} />;
      case 'task':
        return <CheckSquare className={iconSize} />;
      case 'file_upload':
        return <FileText className={iconSize} />;
      case 'field_change':
        return <Edit className={iconSize} />;
      case 'deal_created':
        return <Plus className={iconSize} />;
      default:
        return <MessageSquare className={iconSize} />;
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

  const formatDateAndTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dateStr = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
    const timeStr = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
    return { date: dateStr, time: timeStr };
  };

  // Определяем, является ли событие "не основным" действием
  const isSecondaryAction = (eventType: string) => {
    return ['deal_created', 'stage_change', 'field_change'].includes(eventType);
  };

  const renderContent = () => {
    const isSecondary = isSecondaryAction(event.eventType);
    
    // Стили для "не основных" действий: шрифт 12px и более светлый цвет
    const secondaryTextClass = 'text-[12px] text-architect-500 dark:text-architect-400';
    // Стили для основных действий: текущий размер и цвет
    const primaryTextClass = 'text-xs text-architect-900 dark:text-architect-100';
    
    if (event.eventType === 'field_change' && event.metadata) {
      const { field, oldValue, newValue } = event.metadata;
      // Заменяем английское название поля на русское в тексте события
      const fieldLabel = FIELD_LABELS[field] || field;
      const content = event.content?.replace(field, fieldLabel) || `Изменено поле: ${fieldLabel}`;
      
      // Для поля responsibleManagerId преобразуем UUID в имя пользователя
      let displayOldValue = oldValue || 'пусто';
      let displayNewValue = newValue || 'пусто';
      
      if (field === 'responsibleManagerId') {
        if (oldValue && typeof oldValue === 'string' && oldValue.trim() !== '') {
          const oldUser = users.find(u => u.id === oldValue);
          displayOldValue = oldUser ? (oldUser.name || oldUser.email) : 'пусто';
        } else {
          displayOldValue = 'пусто';
        }
        if (newValue && typeof newValue === 'string' && newValue.trim() !== '') {
          const newUser = users.find(u => u.id === newValue);
          displayNewValue = newUser ? (newUser.name || newUser.email) : 'пусто';
        } else {
          displayNewValue = 'пусто';
        }
      }
      
      // Не основное действие - всё в одну строку
      return (
        <div className={`${secondaryTextClass} inline-flex items-center gap-1`}>
          <span>{content}</span>
          <span className="line-through">{displayOldValue}</span>
          <span>→</span>
          <span>{displayNewValue}</span>
        </div>
      );
    }

    if (event.eventType === 'stage_change' && event.metadata) {
      const { oldStageName, newStageName } = event.metadata;
      // Не основное действие - всё в одну строку
      return (
        <div className={`${secondaryTextClass} inline-flex items-center gap-1`}>
          <span>{event.content}</span>
          <span>{oldStageName}</span>
          <span>→</span>
          <span>{newStageName}</span>
        </div>
      );
    }

    // Для остальных событий используем соответствующий стиль
    return <div className={isSecondary ? secondaryTextClass : primaryTextClass}>{event.content}</div>;
  };

  const isSecondary = isSecondaryAction(event.eventType);
  
  // Для "не основных" действий объединяем дату, время, имя и действие в одну строку
  if (isSecondary) {
    const { date, time } = formatDateAndTime(event.createdAt);
    const userName = event.user?.name || 'Система';
    const secondaryTextClass = 'text-[12px] text-architect-500 dark:text-architect-400';
    
    let actionText = '';
    if (event.eventType === 'field_change' && event.metadata) {
      const { field, oldValue, newValue } = event.metadata;
      const fieldLabel = FIELD_LABELS[field] || field;
      const content = event.content?.replace(field, fieldLabel) || `Изменено поле: ${fieldLabel}`;
      
      let displayOldValue = oldValue || 'пусто';
      let displayNewValue = newValue || 'пусто';
      
      if (field === 'responsibleManagerId') {
        if (oldValue && typeof oldValue === 'string' && oldValue.trim() !== '') {
          const oldUser = users.find(u => u.id === oldValue);
          displayOldValue = oldUser ? (oldUser.name || oldUser.email) : 'пусто';
        } else {
          displayOldValue = 'пусто';
        }
        if (newValue && typeof newValue === 'string' && newValue.trim() !== '') {
          const newUser = users.find(u => u.id === newValue);
          displayNewValue = newUser ? (newUser.name || newUser.email) : 'пусто';
        } else {
          displayNewValue = 'пусто';
        }
      }
      
      actionText = `${content} ${displayOldValue} → ${displayNewValue}`;
    } else if (event.eventType === 'stage_change' && event.metadata) {
      const { oldStageName, newStageName } = event.metadata;
      actionText = `${event.content} ${oldStageName} → ${newStageName}`;
    } else {
      actionText = event.content || '';
    }
    
    return (
      <div className="flex gap-2 items-center pb-[2px] last:pb-0">
        <div className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-architect-200 dark:bg-architect-700 text-architect-500 dark:text-architect-400">
          {getEventIcon('small')}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`${secondaryTextClass} inline-flex items-center gap-1`}>
            <span>{date}</span>
            <span>{time}</span>
            <span>{userName}</span>
            <span>{actionText}</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Для основных действий используем обычную структуру с белым фоном
  return (
    <div className="bg-white dark:bg-architect-800 rounded-lg p-3 pb-[4px] last:pb-3 border border-architect-200 dark:border-architect-700">
      <div className="flex gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor()}`}>
          {getEventIcon('normal')}
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
    </div>
  );
};
