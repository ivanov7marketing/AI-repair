import React, { useState, useEffect } from 'react';
import { Plus, Search, Clock, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { MaterialReturn } from '../../types';

interface ReturnsListProps {
  onCreateNew: () => void;
  hasPermission: (permission: string) => boolean;
}

export const ReturnsList: React.FC<ReturnsListProps> = ({
  onCreateNew,
  hasPermission,
  refreshTrigger,
}) => {
  const [returns, setReturns] = useState<MaterialReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadReturns();
  }, [statusFilter, refreshTrigger]);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await api.getReturns(params);
      setReturns(data);
    } catch (error) {
      console.error('Failed to load returns:', error);
      alert('Ошибка при загрузке возвратов');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned':
        return <Clock className="w-4 h-4" />;
      case 'returned':
        return <CheckCircle className="w-4 h-4" />;
      case 'money_received':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'returned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'money_received':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      planned: 'Планируется',
      returned: 'Возвращено',
      money_received: 'Деньги получены',
    };
    return statusMap[status] || status;
  };

  const filteredReturns = returns.filter((ret) =>
    ret.materialName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ret.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ret.supplierName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              placeholder="Поиск по материалу, объекту, поставщику..."
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
            <option value="planned">Планируется</option>
            <option value="returned">Возвращено</option>
            <option value="money_received">Деньги получены</option>
          </select>
          {hasPermission('manage_warehouse') && (
            <button
              onClick={onCreateNew}
              className="bg-architect-900 dark:bg-white text-white dark:text-architect-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Новый возврат
            </button>
          )}
        </div>
      </div>

      {/* Returns table */}
      <div className="bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-architect-50 dark:bg-architect-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Дата
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Объект
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Материал
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Количество
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Сумма
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Магазин
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-architect-200 dark:divide-architect-700">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-architect-500 dark:text-architect-400">
                    Возвраты не найдены
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-architect-50 dark:hover:bg-architect-700">
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {new Date(ret.createdAt || '').toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {ret.projectName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-architect-900 dark:text-white">
                      {ret.materialName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {ret.quantity.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {ret.returnAmount ? `${ret.returnAmount.toLocaleString('ru-RU')} ₽` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {ret.supplierName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          ret.status
                        )}`}
                      >
                        {getStatusIcon(ret.status)}
                        {getStatusText(ret.status)}
                      </span>
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
