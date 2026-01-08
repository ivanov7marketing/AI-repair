import React, { useState, useEffect } from 'react';
import { 
  Settings, LogOut, Plus, Trash2, Edit2, Save, X, Lock, 
  Hammer, Package, Sparkles, Search, ChevronDown, ChevronUp 
} from 'lucide-react';
import { api } from '../services/api';
import { PriceItem } from '../types';

interface SuperAdminPanelProps {
  onLogout: () => void;
}

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'prices' | 'settings'>('prices');
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
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
      setExpandedSections(sections);
    } catch (error: any) {
      alert(`Ошибка загрузки прайсов: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: PriceItem) => {
    setEditingId(item.id);
    setEditingData({ ...item });
  };

  const handleSave = async (id: string) => {
    try {
      await api.updateDefaultPrice(id, editingData);
      await loadPrices();
      setEditingId(null);
      setEditingData({});
    } catch (error: any) {
      alert(`Ошибка сохранения: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData({});
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот пункт?')) return;
    
    try {
      await api.deleteDefaultPrice(id);
      await loadPrices();
    } catch (error: any) {
      alert(`Ошибка удаления: ${error.message}`);
    }
  };

  const handleAdd = async () => {
    if (!newPrice.name || !newPrice.category || !newPrice.type) {
      alert('Заполните все обязательные поля');
      return;
    }

    try {
      await api.createDefaultPrice({
        name: newPrice.name!,
        unit: newPrice.unit || 'м2',
        price: newPrice.price || 0,
        category: newPrice.category!,
        subcategory: newPrice.subcategory,
        type: newPrice.type!,
      });
      await loadPrices();
      setShowAddForm(false);
      setNewPrice({
        name: '',
        unit: 'м2',
        price: 0,
        category: '',
        type: 'work',
      });
    } catch (error: any) {
      alert(`Ошибка добавления: ${error.message}`);
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

  const filteredPrices = priceList.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedPrices = filteredPrices.reduce((acc, price) => {
    const key = `${price.type}-${price.category}${price.subcategory ? `-${price.subcategory}` : ''}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(price);
    return acc;
  }, {} as Record<string, PriceItem[]>);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Панель суперадмина
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('prices')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'prices'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Дефолтные прайсы
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Настройки
          </button>
        </div>

        {activeTab === 'prices' && (
          <div className="space-y-6">
            {/* Search and Add */}
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по названию или категории..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            </div>

            {/* Add Form */}
            {showAddForm && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Новый пункт прайса</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Название *
                    </label>
                    <input
                      type="text"
                      value={newPrice.name}
                      onChange={(e) => setNewPrice({ ...newPrice, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Единица измерения
                    </label>
                    <input
                      type="text"
                      value={newPrice.unit}
                      onChange={(e) => setNewPrice({ ...newPrice, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Цена *
                    </label>
                    <input
                      type="number"
                      value={newPrice.price}
                      onChange={(e) => setNewPrice({ ...newPrice, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Категория *
                    </label>
                    <input
                      type="text"
                      value={newPrice.category}
                      onChange={(e) => setNewPrice({ ...newPrice, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Подкатегория
                    </label>
                    <input
                      type="text"
                      value={newPrice.subcategory || ''}
                      onChange={(e) => setNewPrice({ ...newPrice, subcategory: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Тип *
                    </label>
                    <select
                      value={newPrice.type}
                      onChange={(e) => setNewPrice({ ...newPrice, type: e.target.value as 'work' | 'rough' | 'finish' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="work">Работы</option>
                      <option value="rough">Черновые материалы</option>
                      <option value="finish">Чистовые материалы</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Price List */}
            <div className="space-y-4">
              {Object.entries(groupedPrices).map(([key, prices]) => {
                const [type, category, subcategory] = key.split('-');
                const isExpanded = expandedSections[key] ?? true;
                
                return (
                  <div key={key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <button
                      onClick={() => setExpandedSections({ ...expandedSections, [key]: !isExpanded })}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {type === 'work' && <Hammer className="w-5 h-5 text-emerald-500" />}
                        {type === 'rough' && <Package className="w-5 h-5 text-amber-500" />}
                        {type === 'finish' && <Sparkles className="w-5 h-5 text-blue-500" />}
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{category}</h3>
                          {subcategory && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{subcategory}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {prices.length} {prices.length === 1 ? 'пункт' : 'пунктов'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Название
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Ед. изм.
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Цена
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Действия
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {prices.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                {editingId === item.id ? (
                                  <>
                                    <td className="px-6 py-4">
                                      <input
                                        type="text"
                                        value={editingData.name || ''}
                                        onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-6 py-4">
                                      <input
                                        type="text"
                                        value={editingData.unit || ''}
                                        onChange={(e) => setEditingData({ ...editingData, unit: e.target.value })}
                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-6 py-4">
                                      <input
                                        type="number"
                                        value={editingData.price || 0}
                                        onChange={(e) => setEditingData({ ...editingData, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                      />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => handleSave(item.id)}
                                          className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                        >
                                          <Save className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={handleCancel}
                                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-6 py-4 text-gray-900 dark:text-white">{item.name}</td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{item.unit}</td>
                                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                                      {item.price.toLocaleString()} ₽
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => handleEdit(item)}
                                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDelete(item.id)}
                                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Текущий пароль
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Новый пароль
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Подтвердите новый пароль
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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

