import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, Loader2, Check, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { PriceItem } from '../App';

interface SuppliersModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialType: 'rough' | 'finish';
  materials: PriceItem[];
  onUpdate: () => void;
}

interface SupplierResult {
  materialId: string;
  materialName: string;
  results: Array<{
    supplier: string;
    url: string;
    price: number;
    name: string;
  }>;
  bestPrice?: {
    supplier: string;
    url: string;
    price: number;
    name: string;
  };
}

const DEFAULT_SUPPLIERS = [
  'https://chel.saturn.net/',
  'https://chelyabinsk.lemanapro.ru/',
  'https://sdvor.com/chelyabinsk'
];

export const SuppliersModal: React.FC<SuppliersModalProps> = ({
  isOpen,
  onClose,
  materialType,
  materials,
  onUpdate
}) => {
  const [suppliers, setSuppliers] = useState<string[]>(DEFAULT_SUPPLIERS);
  const [newSupplierUrl, setNewSupplierUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<SupplierResult[]>([]);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Загружаем сохраненных поставщиков из localStorage
    const saved = localStorage.getItem(`suppliers_${materialType}`);
    if (saved) {
      try {
        setSuppliers(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved suppliers:', e);
      }
    }
  }, [materialType]);

  const saveSuppliers = (suppliersList: string[]) => {
    localStorage.setItem(`suppliers_${materialType}`, JSON.stringify(suppliersList));
  };

  const addSupplier = () => {
    if (newSupplierUrl.trim() && !suppliers.includes(newSupplierUrl.trim())) {
      const updated = [...suppliers, newSupplierUrl.trim()];
      setSuppliers(updated);
      saveSuppliers(updated);
      setNewSupplierUrl('');
    }
  };

  const removeSupplier = (index: number) => {
    const updated = suppliers.filter((_, i) => i !== index);
    setSuppliers(updated);
    saveSuppliers(updated);
  };

  const handleSearch = async () => {
    if (suppliers.length === 0) {
      setError('Добавьте хотя бы одного поставщика');
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);
    setSelectedUpdates(new Set());
    setProgress({ current: 0, total: materials.length });

    try {
      console.log('Starting bulk search with suppliers:', suppliers);
      console.log('Material type:', materialType);
      
      const response = await api.bulkSearchPrices(suppliers, materialType);
      
      console.log('Search response:', response);
      
      if (response.success) {
        const searchResults = response.results || [];
        setResults(searchResults);
        
        // Автоматически выбираем лучшие цены
        const bestPrices = new Set(
          searchResults
            .filter((r: any) => r.bestPrice)
            .map((r: any) => r.materialId)
        );
        setSelectedUpdates(bestPrices);
        
        // Показываем информацию о результатах
        const foundCount = searchResults.filter((r: any) => r.bestPrice).length;
        if (foundCount === 0 && searchResults.length > 0) {
          setError('Товары не найдены на указанных сайтах. Попробуйте уточнить названия материалов или добавить другие сайты поставщиков.');
        }
      } else {
        setError(response.error || 'Ошибка при поиске цен');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Не удалось выполнить поиск цен. Проверьте подключение к интернету и повторите попытку.');
    } finally {
      setIsSearching(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const toggleSelection = (materialId: string) => {
    const updated = new Set(selectedUpdates);
    if (updated.has(materialId)) {
      updated.delete(materialId);
    } else {
      updated.add(materialId);
    }
    setSelectedUpdates(updated);
  };

  const handleApplyUpdates = async () => {
    if (selectedUpdates.size === 0) {
      setError('Выберите хотя бы один товар для обновления');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const updates = results
        .filter(r => selectedUpdates.has(r.materialId) && r.bestPrice)
        .map(r => ({
          id: r.materialId,
          price: r.bestPrice!.price,
          supplierUrl: r.bestPrice!.url,
          supplierName: r.bestPrice!.supplier,
        }));

      const response = await api.bulkUpdatePrices(updates);

      if (response.success) {
        onUpdate();
        onClose();
      } else {
        setError(response.error || 'Ошибка при обновлении цен');
      }
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Не удалось обновить цены');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-architect-200 dark:border-architect-700">
          <h2 className="text-2xl font-bold dark:text-white">
            Поставщики - {materialType === 'rough' ? 'Черновые материалы' : 'Чистовые материалы'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Suppliers list */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-architect-700 dark:text-architect-300 mb-2">
              Список поставщиков
            </label>
            <div className="space-y-2 mb-3">
              {suppliers.map((supplier, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-architect-50 dark:bg-architect-900 rounded-lg"
                >
                  <a
                    href={supplier}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-architect-600 dark:text-architect-400 hover:text-architect-900 dark:hover:text-architect-200 truncate"
                  >
                    {supplier}
                  </a>
                  <button
                    onClick={() => removeSupplier(index)}
                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={newSupplierUrl}
                onChange={(e) => setNewSupplierUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSupplier()}
                placeholder="https://example.com"
                className="flex-1 px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg bg-white dark:bg-architect-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addSupplier}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </div>
          </div>

          {/* Search button */}
          <div className="mb-6">
            <button
              onClick={handleSearch}
              disabled={isSearching || suppliers.length === 0}
              className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Поиск цен... {progress.total > 0 && `(${progress.current}/${progress.total})`}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Найти цены для всех материалов
                </>
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              <p className="font-semibold mb-2">{error}</p>
              <p className="text-xs mt-2">
                💡 Совет: Добавьте прямые ссылки на товары в столбец "Ссылка" и используйте кнопку обновления цены для каждого материала отдельно.
              </p>
            </div>
          )}

          {/* Results summary */}
          {results.length > 0 && (
            <div className="mb-4 p-4 bg-architect-50 dark:bg-architect-900 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-architect-600 dark:text-architect-400">
                  Проверено материалов: <span className="font-bold text-architect-900 dark:text-white">{results.length}</span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  Найдены цены: <span className="font-bold">{results.filter(r => r.bestPrice).length}</span>
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  Не найдено: <span className="font-bold">{results.filter(r => !r.bestPrice).length}</span>
                </span>
              </div>
            </div>
          )}

          {/* Results table */}
          {results.length > 0 && (
            <div className="border border-architect-200 dark:border-architect-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-architect-100 dark:bg-architect-900 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input
                          type="checkbox"
                          checked={selectedUpdates.size === results.filter(r => r.bestPrice).length && results.filter(r => r.bestPrice).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUpdates(new Set(results.filter(r => r.bestPrice).map(r => r.materialId)));
                            } else {
                              setSelectedUpdates(new Set());
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Материал</th>
                      <th className="px-4 py-3 text-left">Поставщик</th>
                      <th className="px-4 py-3 text-right">Цена</th>
                      <th className="px-4 py-3 text-left">Ссылка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => {
                      const isSelected = selectedUpdates.has(result.materialId);
                      const hasBestPrice = !!result.bestPrice;
                      
                      return (
                        <tr
                          key={result.materialId}
                          className={`border-b border-architect-100 dark:border-architect-700 ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          } ${!hasBestPrice ? 'opacity-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => hasBestPrice && toggleSelection(result.materialId)}
                              disabled={!hasBestPrice}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium dark:text-white">
                            {result.materialName}
                            {result.results && result.results.length > 1 && (
                              <span className="ml-2 text-xs text-architect-400">
                                ({result.results.length} вариантов)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-architect-600 dark:text-architect-400">
                            {hasBestPrice ? result.bestPrice!.supplier : (
                              <span className="text-amber-500 text-xs">Не найдено</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold dark:text-white">
                            {hasBestPrice ? (
                              `${result.bestPrice!.price.toLocaleString('ru-RU')} ₽`
                            ) : (
                              <span className="text-architect-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {hasBestPrice ? (
                              <a
                                href={result.bestPrice!.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                              >
                                Открыть <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-architect-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {results.length === 0 && !isSearching && (
            <div className="text-center py-12 text-architect-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-semibold mb-3">Как найти цены на материалы:</p>
              <div className="text-xs space-y-2 max-w-lg mx-auto text-left bg-architect-50 dark:bg-architect-900 p-4 rounded-lg">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Рекомендуемый способ (самый надежный):</p>
                <p className="pl-4">1. Добавьте прямую ссылку на товар в столбец "Ссылка" рядом с материалом</p>
                <p className="pl-4">2. Нажмите кнопку обновления цены (↻) рядом со ссылкой</p>
                <p className="pl-4">3. Цена будет автоматически извлечена со страницы товара</p>
                <p className="mt-3 font-semibold text-amber-600 dark:text-amber-400">⚠ Массовый поиск:</p>
                <p className="pl-4">• Может не работать из-за защиты сайтов от автоматизации</p>
                <p className="pl-4">• Используйте точные названия товаров для лучших результатов</p>
                <p className="pl-4">• Если поиск не находит товары, используйте прямые ссылки</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-architect-200 dark:border-architect-700">
          <div className="text-sm text-architect-500 dark:text-architect-400">
            {selectedUpdates.size > 0 && `Выбрано: ${selectedUpdates.size} товаров`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-architect-300 dark:border-architect-600 rounded-lg hover:bg-architect-50 dark:hover:bg-architect-700 transition-colors font-semibold"
            >
              Отмена
            </button>
            <button
              onClick={handleApplyUpdates}
              disabled={isUpdating || selectedUpdates.size === 0}
              className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Обновление...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Применить выбранные ({selectedUpdates.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

