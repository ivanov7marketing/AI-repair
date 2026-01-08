import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Save } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

export const UsersManagement: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'manager' as UserRole,
  });

  useEffect(() => {
    if (user && hasPermission('create_users')) {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      alert('Ошибка при загрузке пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.createUser(formData);
      await loadUsers();
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      alert(error.message || 'Ошибка при создании пользователя');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.updateUser(id, {
        email: formData.email,
        name: formData.name,
        role: formData.role,
      });
      await loadUsers();
      resetForm();
      setEditingId(null);
    } catch (error: any) {
      alert(error.message || 'Ошибка при обновлении пользователя');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (error: any) {
      alert(error.message || 'Ошибка при удалении пользователя');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'manager',
    });
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      password: '',
      name: user.name || '',
      role: user.role,
    });
  };

  if (!user || !hasPermission('create_users')) {
    return (
      <div className="p-6 text-center text-architect-500">
        У вас нет прав для управления пользователями
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-center">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold dark:text-white">Пользователи</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
            setEditingId(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-xl hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Добавить пользователя
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-architect-800 rounded-xl border border-architect-200 dark:border-architect-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold dark:text-white">
              {editingId ? 'Редактировать пользователя' : 'Новый пользователь'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
                setEditingId(null);
              }}
              className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 dark:text-white">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg dark:bg-architect-900 dark:text-white"
              />
            </div>
            {!editingId && (
              <div>
                <label className="block text-sm font-semibold mb-2 dark:text-white">Пароль</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg dark:bg-architect-900 dark:text-white"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold mb-2 dark:text-white">Имя</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg dark:bg-architect-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 dark:text-white">Роль</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-4 py-2 border border-architect-200 dark:border-architect-700 rounded-lg dark:bg-architect-900 dark:text-white"
              >
                <option value="manager">Менеджер</option>
                <option value="measurer">Замерщик</option>
                <option value="foreman">Прораб</option>
                <option value="master">Мастер</option>
                <option value="client">Клиент</option>
              </select>
            </div>
            <button
              onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
              className="w-full px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:opacity-90"
            >
              {editingId ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-architect-800 rounded-xl border border-architect-200 dark:border-architect-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-architect-50 dark:bg-architect-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">Имя</th>
              <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">Роль</th>
              <th className="px-4 py-3 text-left text-sm font-semibold dark:text-white">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-architect-100 dark:border-architect-700">
                <td className="px-4 py-3 text-sm dark:text-white">{u.email}</td>
                <td className="px-4 py-3 text-sm dark:text-white">{u.name || '—'}</td>
                <td className="px-4 py-3 text-sm dark:text-white">
                  <span className="px-2 py-1 bg-architect-100 dark:bg-architect-700 rounded text-xs">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(u)}
                      className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {u.id !== user?.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

