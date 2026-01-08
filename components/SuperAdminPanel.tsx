import React, { useState, useEffect } from 'react';
import { 
  Settings, LogOut, Plus, Trash2, Edit2, Save, X, Lock, 
  Hammer, Package, Sparkles, Search, ChevronDown, ChevronUp, Upload
} from 'lucide-react';
import { api } from '../services/api';
import { PriceItem } from '../types';

interface SuperAdminPanelProps {
  onLogout: () => void;
}

const WORK_SUBSECTIONS = [
  "Подготовительные работы",
  "Демонтажные работы",
  "Черновая электрика",
  "Черновая сантехника",
  "Черновые отделочные работы",
  "Чистовые отделочные работы",
  "Чистовая сантехника",
  "Чистовая электрика"
];

const FINISHING_SUBSECTIONS = ['Стены', 'Пол', 'Потолок'] as const;

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'prices' | 'settings'>('prices');
  const [activePriceTab, setActivePriceTab] = useState<'works' | 'rough' | 'finish'>('works');
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceSearchQuery, setPriceSearchQuery] = useState('');
  const [priceSearchFocused, setPriceSearchFocused] = useState(false);
  const [expandedPriceSections, setExpandedPriceSections] = useState<Record<string, boolean>>({});
  const [highlightedPriceId, setHighlightedPriceId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<PriceItem>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrice, setNewPrice] = useState<Partial<PriceItem>>({
    name: '',
    unit: 'м2',
    price: 0,
    category: '',
    type: 'work',
  });

  // Settings
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      setLoading(true);
      const prices = await api.getDefaultPrices();
      setPriceList(prices);
      
      // Auto-expand all sections
      const sections: Record<string, boolean> = {};
      prices.forEach(p => {
        const key = `${p.type}-${p.category}${p.subcategory ? `-${p.subcategory}` : ''}`;
        sections[key] = true;
      });
      setExpandedPriceSections(sections);
    } catch (error: any) {
      alert(`Ошибка загрузки прайсов: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePriceItem = async (id: string, field: keyof PriceItem, value: string | number) => {
    // Optimistically update UI
    setPriceList(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: field === 'price' ? Number(value) : value };
      }
      return item;
    }));

    // Save to backend with debounce
    const timeoutId = setTimeout(async () => {
      try {
        const updateData: any = {};
        updateData[field] = field === 'price' ? Number(value) : value;
        await api.updateDefaultPrice(id, updateData);
      } catch (error) {
        console.error('Failed to update price item:', error);
        await loadPrices();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  };

  const handleDeletePriceItem = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот пункт?')) return;
    
    try {
      await api.deleteDefaultPrice(id);
      await loadPrices();
    } catch (error: any) {
      alert(`Ошибка удаления: ${error.message}`);
    }
  };

  const handleAddPriceItem = async (type: 'work' | 'rough' | 'finish', category: string, subcategory?: string) => {
    try {
      const newItem = await api.createDefaultPrice({
        name: '',
        unit: type === 'work' ? 'м2' : type === 'rough' ? 'кг' : 'м2',
        price: 0,
        category,
        subcategory,
        type,
      });
      setPriceList(prev => [...prev, newItem]);
      setExpandedPriceSections(prev => ({ ...prev, [`${type}-${category}${subcategory ? `-${subcategory}` : ''}`]: true }));
    } catch (error: any) {
      alert(`Ошибка при создании позиции прайса: ${error.message}`);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Пароли не совпадают');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Пароль должен быть не менее 8 символов');
      return;
    }

    try {
      setPasswordError(null);
      await api.superadminChangePassword(passwordData.currentPassword, passwordData.newPassword);
      alert('Пароль успешно изменен');
      setShowChangePassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      setPasswordError(error.message || 'Ошибка смены пароля');
    }
  };

  const scrollToPriceItem = (item: PriceItem) => {
    const element = document.getElementById(`price-item-${item.id}`);
    if (element) {
      setHighlightedPriceId(item.id);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedPriceId(null), 2000);
    }
    setPriceSearchQuery('');
    setPriceSearchFocused(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-architect-50 dark:bg-architect-900 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-architect-800 shadow-sm border-b border-architect-200 dark:border-architect-700 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-architect-900 dark:text-white">
                Панель суперадмина
              </h1>
              <p className="text-sm text-architect-500 dark:text-architect-400 mt-1">
                Управление дефолтными прайсами для новых организаций
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-2 border-b border-architect-200 dark:border-architect-700 mb-6">
          <button
            onClick={() => setActiveTab('prices')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'prices'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-architect-500 hover:text-architect-700 dark:text-architect-400 dark:hover:text-architect-200'
            }`}
          >
            Дефолтные прайсы ({priceList.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-architect-500 hover:text-architect-700 dark:text-architect-400 dark:hover:text-architect-200'
            }`}
          >
            Настройки
          </button>
        </div>

        {activeTab === 'prices' && (
          <div className="space-y-6">
            {/* Табы для переключения между типами */}
            <div className="flex gap-2 bg-white dark:bg-architect-800 p-2 rounded-xl border border-architect-200 dark:border-architect-700">
              <button 
                onClick={() => setActivePriceTab('works')} 
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activePriceTab === 'works' ? 'bg-emerald-500 text-white shadow-lg' : 'text-architect-600 hover:bg-architect-50 dark:hover:bg-architect-700'}`}
              >
                <span className="flex items-center justify-center gap-2"><Hammer className="w-4 h-4" /> Работы</span>
              </button>
              <button 
                onClick={() => setActivePriceTab('rough')} 
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activePriceTab === 'rough' ? 'bg-amber-500 text-white shadow-lg' : 'text-architect-600 hover:bg-architect-50 dark:hover:bg-architect-700'}`}
              >
                <span className="flex items-center justify-center gap-2"><Package className="w-4 h-4" /> Черновые материалы</span>
              </button>
              <button 
                onClick={() => setActivePriceTab('finish')} 
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${activePriceTab === 'finish' ? 'bg-blue-500 text-white shadow-lg' : 'text-architect-600 hover:bg-architect-50 dark:hover:bg-architect-700'}`}
              >
                <span className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Чистовые материалы</span>
              </button>
            </div>

            {/* Блок работ */}
            {activePriceTab === 'works' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 shrink-0"><Hammer className="w-5 h-5 text-emerald-500" /> Справочник работ</h3>
                  {/* Поиск */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-architect-400" />
                    <input 
                      type="text" 
                      value={priceSearchQuery}
                      onChange={e => setPriceSearchQuery(e.target.value)}
                      onFocus={() => setPriceSearchFocused(true)}
                      onBlur={() => setTimeout(() => setPriceSearchFocused(false), 200)}
                      placeholder="Поиск по работам..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm dark:text-white transition-all"
                    />
                    {/* Выпадающий список результатов */}
                    {priceSearchFocused && priceSearchQuery && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-architect-800 border border-architect-200 dark:border-architect-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                        {priceList
                          .filter(p => p.type === 'work' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase()))
                          .slice(0, 15)
                          .map(item => (
                            <div 
                              key={item.id}
                              onClick={() => scrollToPriceItem(item)}
                              className="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer border-b border-architect-50 dark:border-architect-700 last:border-0"
                            >
                              <div className="text-sm font-medium dark:text-white">{item.name}</div>
                              <div className="text-[10px] text-architect-400 mt-0.5">{item.category} • {item.price} ₽/{item.unit}</div>
                            </div>
                          ))
                        }
                        {priceList.filter(p => p.type === 'work' && p.name.toLowerCase().includes(priceSearchQuery.toLowerCase())).length === 0 && (
                          <div className="px-4 py-4 text-center text-sm text-architect-400">Ничего не найдено</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {WORK_SUBSECTIONS.map((sub, idx) => {
                    const isExpanded = !!expandedPriceSections[`work-${sub}`];
                    const isFinishingSection = sub === 'Черновые отделочные работы' || sub === 'Чистовые отделочные работы';
                    const items = priceList.filter(p => {
                      if (p.type === 'work' && p.category === sub) {
                        if (isFinishingSection) {
                          return p.subcategory && p.subcategory.trim() !== '';
                        }
                        return true;
                      }
                      return false;
                    });
                    
                    return (
                      <div key={idx} className="border border-architect-100 dark:border-architect-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-architect-800">
                        <div className="w-full flex items-center justify-between px-4 py-4 bg-architect-50/50 dark:bg-architect-900/50">
                          <button 
                            onClick={() => setExpandedPriceSections(prev => ({ ...prev, [`work-${sub}`]: !isExpanded }))} 
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <span className="text-sm font-bold text-architect-700 dark:text-architect-300">{sub}</span>
                            <span className="text-xs text-architect-400">({items.length} позиций)</span>
                          </button>
                          {!isFinishingSection && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => { handleAddPriceItem('work', sub); setExpandedPriceSections(prev => ({ ...prev, [`work-${sub}`]: true })); }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                              >
                                <Plus className="w-3 h-3" /> Добавить
                              </button>
                            </div>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="p-4 border-t border-architect-50 dark:border-architect-700">
                            {isFinishingSection ? (
                              <div className="space-y-4">
                                {FINISHING_SUBSECTIONS.map((subSec) => {
                                  const subItems = items.filter(item => item.subcategory === subSec);
                                  const headerBg = subSec === 'Стены' 
                                    ? 'bg-purple-50 dark:bg-purple-900/20' 
                                    : subSec === 'Пол' 
                                      ? 'bg-amber-50 dark:bg-amber-900/20' 
                                      : 'bg-cyan-50 dark:bg-cyan-900/20';
                                  const titleClass = subSec === 'Стены' 
                                    ? 'text-purple-700 dark:text-purple-400' 
                                    : subSec === 'Пол' 
                                      ? 'text-amber-700 dark:text-amber-400' 
                                      : 'text-cyan-700 dark:text-cyan-400';
                                  const btnClass = subSec === 'Стены' 
                                    ? 'text-purple-600 hover:bg-purple-100' 
                                    : subSec === 'Пол' 
                                      ? 'text-amber-600 hover:bg-amber-100' 
                                      : 'text-cyan-600 hover:bg-cyan-100';
                                  
                                  return (
                                    <div key={subSec} className="border border-architect-100 dark:border-architect-700 rounded-lg overflow-hidden">
                                      <div className={`flex items-center justify-between px-3 py-2 ${headerBg}`}>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-bold ${titleClass}`}>{subSec}</span>
                                          <span className="text-xs text-architect-400">({subItems.length})</span>
                                        </div>
                                        <button 
                                          onClick={() => { handleAddPriceItem('work', sub, subSec); }}
                                          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-white dark:bg-architect-800 rounded transition-all ${btnClass}`}
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                      <div className="overflow-x-auto">
                                        {subItems.length > 0 ? (
                                          <table className="w-full text-left text-xs min-w-[400px]">
                                            <tbody>
                                              {subItems.map((item, i) => (
                                                <tr key={item.id} id={`price-item-${item.id}`} className={`border-b border-architect-50 dark:border-architect-900/50 group transition-all duration-500 ${highlightedPriceId === item.id ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500' : ''}`}>
                                                  <td className="py-1.5 px-2 text-architect-400 w-6">{i + 1}</td>
                                                  <td className="py-1.5 px-2">
                                                    <input 
                                                      type="text" 
                                                      value={item.name} 
                                                      onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                                      className="w-full bg-transparent outline-none focus:text-emerald-600 font-medium text-xs" 
                                                      placeholder="Название работы..." 
                                                    />
                                                  </td>
                                                  <td className="py-1.5 px-2 w-16">
                                                    <input 
                                                      type="text" 
                                                      value={item.unit} 
                                                      onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                                      className="w-full bg-transparent outline-none text-architect-500 text-xs" 
                                                    />
                                                  </td>
                                                  <td className="py-1.5 px-2 w-20">
                                                    <div className="flex items-center gap-1">
                                                      <input 
                                                        type="number" 
                                                        value={item.price} 
                                                        onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                                        className="w-full bg-transparent outline-none font-bold text-xs" 
                                                      />
                                                      <span className="text-architect-400 text-[10px]">₽</span>
                                                    </div>
                                                  </td>
                                                  <td className="py-1.5 px-2 w-6">
                                                    <button onClick={() => handleDeletePriceItem(item.id)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        ) : (
                                          <div className="text-center py-3 text-architect-400 text-xs">
                                            Нет позиций
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                {items.length > 0 ? (
                                  <table className="w-full text-left text-xs min-w-[500px]">
                                    <thead>
                                      <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter">
                                        <th className="py-2 w-8">№</th>
                                        <th className="py-2">Наименование</th>
                                        <th className="py-2 w-20">Ед.изм</th>
                                        <th className="py-2 w-24">Цена</th>
                                        <th className="py-2 w-8"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item, i) => (
                                        <tr key={item.id} id={`price-item-${item.id}`} className={`border-b border-architect-50 dark:border-architect-900/50 group transition-all duration-500 ${highlightedPriceId === item.id ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500' : ''}`}>
                                          <td className="py-2 text-architect-400">{i + 1}</td>
                                          <td className="py-2">
                                            <input 
                                              type="text" 
                                              value={item.name} 
                                              onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                              className="w-full bg-transparent outline-none focus:text-emerald-600 font-medium" 
                                              placeholder="Название работы..." 
                                            />
                                          </td>
                                          <td className="py-2">
                                            <input 
                                              type="text" 
                                              value={item.unit} 
                                              onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                              className="w-full bg-transparent outline-none text-architect-500" 
                                            />
                                          </td>
                                          <td className="py-2">
                                            <div className="flex items-center gap-1">
                                              <input 
                                                type="number" 
                                                value={item.price} 
                                                onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                                className="w-full bg-transparent outline-none font-bold" 
                                              />
                                              <span className="text-architect-400 text-[10px]">₽</span>
                                            </div>
                                          </td>
                                          <td className="py-2">
                                            <button onClick={() => handleDeletePriceItem(item.id)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="text-center py-3 text-architect-400 text-xs">
                                    Нет позиций
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Блок черновых материалов */}
            {activePriceTab === 'rough' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 shrink-0"><Package className="w-5 h-5 text-amber-500" /> Справочник черновых материалов</h3>
                  <button 
                    onClick={() => { handleAddPriceItem('rough', 'Черновые материалы'); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>
                <div className="border border-architect-100 dark:border-architect-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-architect-800">
                  <div className="p-4 border-t border-architect-50 dark:border-architect-700">
                    {priceList.filter(p => p.type === 'rough').length > 0 ? (
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter">
                            <th className="py-2 w-8">№</th>
                            <th className="py-2">Наименование</th>
                            <th className="py-2 w-20">Ед.изм</th>
                            <th className="py-2 w-24">Цена</th>
                            <th className="py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceList.filter(p => p.type === 'rough').map((item, i) => (
                            <tr key={item.id} className="border-b border-architect-50 dark:border-architect-900/50 group">
                              <td className="py-2 text-architect-400">{i + 1}</td>
                              <td className="py-2">
                                <input 
                                  type="text" 
                                  value={item.name} 
                                  onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                  className="w-full bg-transparent outline-none focus:text-amber-600 font-medium" 
                                  placeholder="Название материала..." 
                                />
                              </td>
                              <td className="py-2">
                                <input 
                                  type="text" 
                                  value={item.unit} 
                                  onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                  className="w-full bg-transparent outline-none text-architect-500" 
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    value={item.price} 
                                    onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                    className="w-full bg-transparent outline-none font-bold" 
                                  />
                                  <span className="text-architect-400 text-[10px]">₽</span>
                                </div>
                              </td>
                              <td className="py-2">
                                <button onClick={() => handleDeletePriceItem(item.id)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-12 text-architect-400">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">Нет черновых материалов</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Блок чистовых материалов */}
            {activePriceTab === 'finish' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 shrink-0"><Sparkles className="w-5 h-5 text-blue-500" /> Справочник чистовых материалов</h3>
                  <button 
                    onClick={() => { handleAddPriceItem('finish', 'Чистовые материалы'); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>
                <div className="border border-architect-100 dark:border-architect-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-architect-800">
                  <div className="p-4 border-t border-architect-50 dark:border-architect-700">
                    {priceList.filter(p => p.type === 'finish').length > 0 ? (
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-architect-100 dark:border-architect-700 text-architect-400 uppercase tracking-tighter">
                            <th className="py-2 w-8">№</th>
                            <th className="py-2">Наименование</th>
                            <th className="py-2 w-20">Ед.изм</th>
                            <th className="py-2 w-24">Цена</th>
                            <th className="py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceList.filter(p => p.type === 'finish').map((item, i) => (
                            <tr key={item.id} className="border-b border-architect-50 dark:border-architect-900/50 group">
                              <td className="py-2 text-architect-400">{i + 1}</td>
                              <td className="py-2">
                                <input 
                                  type="text" 
                                  value={item.name} 
                                  onChange={(e) => handleUpdatePriceItem(item.id, 'name', e.target.value)} 
                                  className="w-full bg-transparent outline-none focus:text-blue-600 font-medium" 
                                  placeholder="Название материала..." 
                                />
                              </td>
                              <td className="py-2">
                                <input 
                                  type="text" 
                                  value={item.unit} 
                                  onChange={(e) => handleUpdatePriceItem(item.id, 'unit', e.target.value)} 
                                  className="w-full bg-transparent outline-none text-architect-500" 
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    value={item.price} 
                                    onChange={(e) => handleUpdatePriceItem(item.id, 'price', e.target.value)} 
                                    className="w-full bg-transparent outline-none font-bold" 
                                  />
                                  <span className="text-architect-400 text-[10px]">₽</span>
                                </div>
                              </td>
                              <td className="py-2">
                                <button onClick={() => handleDeletePriceItem(item.id)} className="p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-12 text-architect-400">
                        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">Нет чистовых материалов</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-architect-800 p-6 rounded-lg border border-architect-200 dark:border-architect-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-architect-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Смена пароля
                </h3>
                <button
                  onClick={() => setShowChangePassword(!showChangePassword)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {showChangePassword ? 'Отмена' : 'Изменить пароль'}
                </button>
              </div>

              {showChangePassword && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
                      Текущий пароль
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-800 text-architect-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
                      Новый пароль
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-800 text-architect-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
                      Подтвердите новый пароль
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-800 text-architect-900 dark:text-white"
                    />
                  </div>
                  {passwordError && (
                    <div className="text-red-600 text-sm">{passwordError}</div>
                  )}
                  <button
                    onClick={handleChangePassword}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Сохранить новый пароль
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
