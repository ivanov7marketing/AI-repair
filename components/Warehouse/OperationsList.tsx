import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, Package, Wrench, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { WarehouseOperation } from '../../types';

interface OperationsListProps {
  hasPermission: (permission: string) => boolean;
}

export const OperationsList: React.FC<OperationsListProps> = ({ hasPermission }) => {
  const [operations, setOperations] = useState<WarehouseOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    operationType: 'all',
    dateFrom: '',
    dateTo: '',
    projectId: '',
    employeeId: '',
    materialId: '',
    toolId: '',
  });

  useEffect(() => {
    loadOperations();
  }, [filters]);

  const loadOperations = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.operationType !== 'all') {
        params.operationType = filters.operationType;
      }
      if (filters.dateFrom) {
        params.dateFrom = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.dateTo = filters.dateTo;
      }
      if (filters.projectId) {
        params.projectId = filters.projectId;
      }
      if (filters.employeeId) {
        params.employeeId = filters.employeeId;
      }
      if (filters.materialId) {
        params.materialId = filters.materialId;
      }
      if (filters.toolId) {
        params.toolId = filters.toolId;
      }
      const data = await api.getWarehouseOperations(params);
      setOperations(data);
    } catch (error) {
      console.error('Failed to load operations:', error);
      alert('Ошибка при загрузке операций');
    } finally {
      setLoading(false);
    }
  };

  const getOperationTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      purchase: 'Закупка',
      arrival: 'Приход на объект',
      writeoff: 'Списание',
      return: 'Возврат',
      tool_issue: 'Выдача инструмента',
      tool_return: 'Возврат инструмента',
      transfer: 'Перемещение',
    };
    return typeMap[type] || type;
  };

  const getOperationIcon = (type: string) => {
    if (type.includes('tool')) {
      return <Wrench className="w-4 h-4" />;
    }
    return <Package className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-architect-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-architect-500 dark:text-architect-400 mb-1">
              Тип операции
            </label>
            <select
              value={filters.operationType}
              onChange={(e) => setFilters({ ...filters, operationType: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            >
              <option value="all">Все типы</option>
              <option value="purchase">Закупка</option>
              <option value="arrival">Приход на объект</option>
              <option value="writeoff">Списание</option>
              <option value="return">Возврат</option>
              <option value="tool_issue">Выдача инструмента</option>
              <option value="tool_return">Возврат инструмента</option>
              <option value="transfer">Перемещение</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-architect-500 dark:text-architect-400 mb-1">
              Дата от
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-architect-500 dark:text-architect-400 mb-1">
              Дата до
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() =>
                setFilters({
                  operationType: 'all',
                  dateFrom: '',
                  dateTo: '',
                  projectId: '',
                  employeeId: '',
                  materialId: '',
                  toolId: '',
                })
              }
              className="w-full px-3 py-2 bg-architect-200 dark:bg-architect-700 text-architect-900 dark:text-white rounded-lg hover:bg-architect-300 dark:hover:bg-architect-600 transition-colors text-sm"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {/* Operations table */}
      <div className="bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-architect-50 dark:bg-architect-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Дата и время
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Тип операции
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Что
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Количество
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Откуда → Куда
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Кто
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-architect-500 dark:text-architect-400 uppercase">
                  Комментарий
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-architect-200 dark:divide-architect-700">
              {operations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-architect-500 dark:text-architect-400">
                    Операции не найдены
                  </td>
                </tr>
              ) : (
                operations.map((operation) => (
                  <tr key={operation.id} className="hover:bg-architect-50 dark:hover:bg-architect-700">
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {new Date(operation.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-architect-900 dark:text-white">
                        {getOperationIcon(operation.operationType)}
                        {getOperationTypeText(operation.operationType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {operation.material?.name || operation.tool?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {operation.quantity ? operation.quantity.toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      <div className="flex items-center gap-1">
                        <span>{operation.fromLocation || '—'}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>{operation.toLocation || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-600 dark:text-architect-300">
                      {operation.performedByName || operation.performedByEmail || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-architect-500 dark:text-architect-400">
                      {operation.comment || '—'}
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
