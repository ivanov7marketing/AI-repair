import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { User, DealSource } from '../../types';

interface DealsFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedManagers: string[];
  onManagersChange: (ids: string[]) => void;
  selectedSources: string[];
  onSourcesChange: (ids: string[]) => void;
  leadTemperature: string | null;
  onTemperatureChange: (value: string | null) => void;
  budgetFrom: number | null;
  budgetTo: number | null;
  onBudgetChange: (from: number | null, to: number | null) => void;
  managers: User[];
  sources: DealSource[];
  onReset: () => void;
}

export const DealsFilters: React.FC<DealsFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedManagers,
  onManagersChange,
  selectedSources,
  onSourcesChange,
  leadTemperature,
  onTemperatureChange,
  budgetFrom,
  budgetTo,
  onBudgetChange,
  managers,
  sources,
  onReset,
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = 
    searchQuery ||
    selectedManagers.length > 0 ||
    selectedSources.length > 0 ||
    leadTemperature !== null ||
    budgetFrom !== null ||
    budgetTo !== null;

  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filtersRef.current &&
        !filtersRef.current.contains(event.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsFiltersOpen(false);
      }
    };

    if (isFiltersOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isFiltersOpen]);

  return (
    <div className="relative">
      {/* Search input - always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-architect-400" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Поиск по ФИО, телефону, адресу..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFiltersOpen(true)}
          className="w-full pl-10 pr-10 py-2 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm focus:border-architect-400 dark:focus:border-architect-500"
        />
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-architect-100 dark:hover:bg-architect-600 rounded"
          >
            <X className="w-4 h-4 text-architect-500" />
          </button>
        )}
      </div>

      {/* Filters dropdown - appears below search */}
      {isFiltersOpen && (
        <div
          ref={filtersRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 shadow-lg z-50 p-4 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-architect-900 dark:text-architect-100">Фильтры</h3>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  onReset();
                  setIsFiltersOpen(false);
                }}
                className="text-xs text-architect-500 hover:text-architect-700 dark:hover:text-architect-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Сбросить
              </button>
            )}
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Managers filter */}
        <div>
          <label className="block text-xs font-medium text-architect-700 dark:text-architect-300 mb-2">
            Ответственный менеджер
          </label>
          <select
            multiple
            value={selectedManagers}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value);
              onManagersChange(values);
            }}
            className="w-full px-3 py-2 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm"
            size={3}
          >
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name || manager.email}
              </option>
            ))}
          </select>
        </div>

        {/* Sources filter */}
        <div>
          <label className="block text-xs font-medium text-architect-700 dark:text-architect-300 mb-2">
            Источник
          </label>
          <select
            multiple
            value={selectedSources}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value);
              onSourcesChange(values);
            }}
            className="w-full px-3 py-2 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm"
            size={3}
          >
            {sources.filter(s => s.isActive).map((source) => (
              <option key={source.id} value={source.id}>
                {source.icon} {source.name}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature filter */}
        <div>
          <label className="block text-xs font-medium text-architect-700 dark:text-architect-300 mb-2">
            Температура лида
          </label>
          <select
            value={leadTemperature || ''}
            onChange={(e) => onTemperatureChange(e.target.value || null)}
            className="w-full px-3 py-2 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm"
          >
            <option value="">Все</option>
            <option value="hot">🔥 Горячий</option>
            <option value="warm">🌡️ Теплый</option>
            <option value="cold">❄️ Холодный</option>
          </select>
        </div>
      </div>

      {/* Budget filter */}
      <div>
        <label className="block text-xs font-medium text-architect-700 dark:text-architect-300 mb-2">
          Бюджет (₽)
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="От"
            value={budgetFrom || ''}
            onChange={(e) => onBudgetChange(e.target.value ? parseFloat(e.target.value) : null, budgetTo)}
            className="flex-1 px-3 py-2 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm"
          />
          <span className="text-architect-500">—</span>
          <input
            type="number"
            placeholder="До"
            value={budgetTo || ''}
            onChange={(e) => onBudgetChange(budgetFrom, e.target.value ? parseFloat(e.target.value) : null)}
            className="flex-1 px-3 py-2 bg-white dark:bg-architect-700 border border-architect-200 dark:border-architect-600 rounded-lg outline-none dark:text-white text-sm"
          />
        </div>
      </div>
        </div>
      )}
    </div>
  );
};
