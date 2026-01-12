import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, CheckCircle, Clock, XCircle, ShoppingCart, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { PurchaseRequest } from '../../types';

interface PurchaseRequestsListProps {
  onSelectRequest: (request: PurchaseRequest) => void;
  onCreateNew: () => void;
  hasPermission: (permission: string) => boolean;
  refreshTrigger?: number;
}

export const PurchaseRequestsList: React.FC<PurchaseRequestsListProps> = ({
  onSelectRequest,
  onCreateNew,
  hasPermission,
  refreshTrigger,
}) => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  useEffect(() => {
    loadRequests();
  }, [statusFilter, urgencyFilter, refreshTrigger]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await api.getPurchaseRequests(params);
      setRequests(data);
    } catch (error) {
      console.error('Failed to load purchase requests:', error);
      alert('Ошибка при загрузке заявок');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Clock className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'purchased':
        return <ShoppingCart className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'purchased':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      new: 'Новая',
      in_progress: 'В обработке',
      approved: 'Одобрена',
      purchased: 'Закуплено',
      rejected: 'Отклонена',
    };
    return statusMap[status] || status;
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.createdByName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-architect-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-architect-400" />
            <input
              type="text"
              placeholder="Поиск по номеру, объекту, автору..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="new">Новая</option>
            <option value="in_progress">В обработке</option>
            <option value="approved">Одобрена</option>
            <option value="purchased">Закуплено</option>
            <option value="rejected">Отклонена</option>
          </select>
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
          >
            <option value="all">Вся срочность</option>
            <option value="normal">Обычная</option>
            <option value="urgent">Срочная</option>
          </select>
          {hasPermission('create_purchase_requests') && (
            <button
              onClick={onCreateNew}
              className="bg-architect-900 dark:bg-white text-white dark:text-architect-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Новая заявка
            </button>
          )}
        </div>
      </div>

      {/* Requests table */}
      <div className="bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-architect-50 dark:bg-architect-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase tracking-wider">
                  Номер
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase tracking-wider">
                  Объект
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase tracking-wider">
                  Автор
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase tracking-wider">
                  Срочность
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase tracking-wider">
                  Сумма
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-architect-200 dark:divide-architect-700">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-architect-500 dark:text-architect-400">
                    Заявки не найдены
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    onClick={() => onSelectRequest(request)}
                    className="hover:bg-architect-50 dark:hover:bg-architect-700 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-architect-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {request.requestNumber}
                        {request.needsReorder && (
                          <AlertCircle className="w-4 h-4 text-orange-500" title="Требуется дозакупка" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {getStatusIcon(request.status)}
                        {getStatusText(request.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {request.projectName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {request.createdByName || request.createdByEmail || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {new Date(request.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      {request.urgency === 'urgent' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Срочная
                        </span>
                      ) : (
                        <span className="text-sm text-architect-500 dark:text-architect-400">Обычная</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-architect-900 dark:text-white">
                      {request.totalAmount.toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
