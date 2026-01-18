import React, { useState, useEffect, useRef } from 'react';
import { Send, Filter } from 'lucide-react';
import { api } from '../../services/api';
import { DealTimelineEvent, TimelineEventType, User } from '../../types';
import { TimelineEvent } from './TimelineEvent';

interface TimelineViewProps {
  dealId: string;
  onUpdate?: () => void;
  users?: User[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ dealId, onUpdate, users = [] }) => {
  const [events, setEvents] = useState<DealTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<TimelineEventType | 'all'>('all');
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTimeline();
  }, [dealId, eventTypeFilter]);

  // Auto-scroll to bottom when events are loaded or updated
  useEffect(() => {
    if (!loading && timelineScrollRef.current && events.length > 0) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollTop = timelineScrollRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [loading, events]);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const data = await api.getDealTimeline(dealId, eventTypeFilter !== 'all' ? eventTypeFilter : undefined);
      // Reverse to show newest events at the bottom
      setEvents([...data].reverse());
    } catch (error) {
      console.error('Failed to load timeline:', error);
      alert('Ошибка при загрузке истории');
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!comment.trim()) return;

    try {
      setSending(true);
      const newEvent = await api.addDealComment(dealId, comment);
      setEvents([...events, newEvent]);
      setComment('');
      // Auto-scroll to bottom after adding comment
      setTimeout(() => {
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollTop = timelineScrollRef.current.scrollHeight;
        }
      }, 0);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Ошибка при добавлении комментария');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-architect-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Filter className="w-4 h-4 text-architect-500" />
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value as TimelineEventType | 'all')}
          className="px-3 py-1.5 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm"
        >
          <option value="all">Все события</option>
          <option value="comment">Комментарии</option>
          <option value="stage_change">Изменения этапов</option>
          <option value="field_change">Изменения полей</option>
          <option value="deal_created">Создание сделки</option>
        </select>
      </div>

      {/* Timeline - scrollable area */}
      <div ref={timelineScrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="bg-architect-50 dark:bg-architect-900 p-4 rounded-lg">
          {events.length === 0 ? (
            <div className="text-center py-8 text-architect-500 dark:text-architect-400">
              Нет событий в истории
            </div>
          ) : (
            events.map((event) => <TimelineEvent key={event.id} event={event} users={users} />)
          )}
        </div>
      </div>

      {/* Comment form - fixed at bottom */}
      <div className="border-t border-architect-200 dark:border-architect-700 pt-4 mt-4 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Добавить комментарий..."
            className="flex-1 px-3 py-2 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm resize-none"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSendComment();
              }
            }}
          />
          <button
            onClick={handleSendComment}
            disabled={!comment.trim() || sending}
            className="px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Отправить
          </button>
        </div>
        <p className="text-xs text-architect-500 dark:text-architect-400 mt-1">
          Ctrl+Enter для отправки
        </p>
      </div>
    </div>
  );
};
