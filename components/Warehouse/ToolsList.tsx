import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Wrench, MapPin, User, Package, Edit } from 'lucide-react';
import { api } from '../../services/api';
import { Tool } from '../../types';

interface ToolsListProps {
  onSelectTool: (tool: Tool) => void;
  onCreateNew: () => void;
  onEditTool?: (tool: Tool) => void;
  hasPermission: (permission: string) => boolean;
  refreshTrigger?: number;
}

export const ToolsList: React.FC<ToolsListProps> = ({
  onSelectTool,
  onCreateNew,
  onEditTool,
  hasPermission,
  refreshTrigger,
}) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadTools();
  }, [categoryFilter, statusFilter, refreshTrigger]);

  const loadTools = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await api.getTools(params);
      setTools(data);
    } catch (error) {
      console.error('Failed to load tools:', error);
      alert('Ошибка при загрузке инструментов');
    } finally {
      setLoading(false);
    }
  };

  const getLocationText = (tool: Tool) => {
    if (tool.currentLocation === 'base') return 'На базе';
    if (tool.currentLocation === 'project') return `Объект: ${tool.currentProjectName || '—'}`;
    if (tool.currentLocation === 'employee') return `У сотрудника: ${tool.currentEmployeeName || '—'}`;
    return '—';
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'working':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'repair':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'disposed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getConditionText = (condition: string) => {
    const conditionMap: Record<string, string> = {
      working: 'Исправен',
      repair: 'В ремонте',
      disposed: 'Утилизирован',
    };
    return conditionMap[condition] || condition;
  };

  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.inventoryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.model?.toLowerCase().includes(searchQuery.toLowerCase())
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
              placeholder="Поиск по названию, инвентарному номеру..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
          >
            <option value="all">Все категории</option>
            <option value="электроинструмент">Электроинструмент</option>
            <option value="ручной">Ручной</option>
            <option value="измерительный">Измерительный</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-lg outline-none dark:text-white text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="free">Свободен</option>
            <option value="occupied">Занят</option>
          </select>
          {hasPermission('manage_tools') && (
            <button
              onClick={onCreateNew}
              className="bg-architect-900 dark:bg-white text-white dark:text-architect-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Новый инструмент
            </button>
          )}
        </div>
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.length === 0 ? (
          <div className="col-span-full text-center py-12 text-architect-500 dark:text-architect-400">
            Инструменты не найдены
          </div>
        ) : (
          filteredTools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => onSelectTool(tool)}
              className="bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 p-4 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-architect-900 dark:text-white mb-1">{tool.name}</h3>
                  <p className="text-xs text-architect-500 dark:text-architect-400">
                    Инв. № {tool.inventoryNumber}
                  </p>
                </div>
                {tool.photo && (
                  <img
                    src={tool.photo}
                    alt={tool.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
              </div>
              <div className="space-y-2 text-sm">
                {tool.brand && tool.model && (
                  <div className="flex justify-between">
                    <span className="text-architect-500 dark:text-architect-400">Модель:</span>
                    <span className="text-architect-900 dark:text-white">
                      {tool.brand} {tool.model}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-architect-500 dark:text-architect-400">Категория:</span>
                  <span className="text-architect-900 dark:text-white">{tool.category || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-architect-500 dark:text-architect-400">Состояние:</span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConditionColor(
                      tool.condition
                    )}`}
                  >
                    {getConditionText(tool.condition)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-architect-600 dark:text-architect-300">
                  {tool.currentLocation === 'base' ? (
                    <Package className="w-4 h-4" />
                  ) : tool.currentLocation === 'project' ? (
                    <MapPin className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span className="text-xs">{getLocationText(tool)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
