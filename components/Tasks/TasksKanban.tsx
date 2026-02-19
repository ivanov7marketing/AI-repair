import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Filter, X, Calendar, User, Flag, CheckCircle2, Circle, CheckSquare, RefreshCw, Briefcase, FileText, Clock } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { api } from '../../services/api';
import { Task, User as UserType } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const BASE_STATUS_COLUMNS = [
  { id: 'today', title: 'Задачи на сегодня', color: 'bg-red-50 dark:bg-red-900/20' },
  { id: 'tomorrow', title: 'Задачи на завтра', color: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { id: 'week', title: 'Задачи на неделю', color: 'bg-blue-50 dark:bg-blue-900/20' },
] as const;

const OPTIONAL_STATUS_COLUMNS = [
  { id: 'overdue', title: 'Просроченные задачи', color: 'bg-red-100 dark:bg-red-900/40' },
  { id: 'future', title: 'Задачи на будущее', color: 'bg-purple-50 dark:bg-purple-900/20' },
] as const;

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const PRIORITY_LABELS = {
  urgent: 'Срочно',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const TASK_TYPES = [
  { id: 'contact', label: 'Связаться', icon: CheckSquare, secondaryIcon: RefreshCw, color: 'text-green-600' },
  { id: 'meeting', label: 'Встреча', icon: Briefcase, color: 'text-amber-700' },
  { id: 'task', label: 'Задача', icon: FileText, color: 'text-red-600' },
  { id: 'other', label: 'Другой', icon: Clock, color: 'text-gray-600' },
] as const;

export const TasksKanban: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Drag & Drop
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksData, usersData] = await Promise.all([
        api.getTasks(),
        api.getUsers(),
      ]);
      setTasks(tasksData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: any) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const newStatus = over.id as 'today' | 'tomorrow' | 'week' | 'overdue' | 'future';

    if (!['today', 'tomorrow', 'week', 'overdue', 'future'].includes(newStatus)) return;

    try {
      await api.moveTask(taskId, newStatus);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      ));
    } catch (error) {
      console.error('Error moving task:', error);
    }
  };

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    assignedTo?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    taskType?: string | null;
    dueDate?: string | null;
    // status is now auto-determined from dueDate on backend
  }) => {
    try {
      const newTask = await api.createTask(data);
      setTasks(prev => [...prev, newTask]);
      setShowTaskForm(false);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  const handleUpdateTask = async (id: string, data: Partial<Task>) => {
    try {
      const updatedTask = await api.updateTask(id, data);
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
      setEditingTask(null);
      setShowTaskForm(false);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Удалить задачу?')) return;
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    await handleUpdateTask(task.id, { completed: !task.completed });
  };

  const filteredTasks = tasks.filter(task => {
    if (task.completed && !showFilters) return false; // Hide completed by default
    
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    if (selectedAssignees.length > 0 && (!task.assignedTo || !selectedAssignees.includes(task.assignedTo))) {
      return false;
    }
    
    if (selectedPriorities.length > 0 && !selectedPriorities.includes(task.priority)) {
      return false;
    }
    
    if (selectedTypes.length > 0 && (!task.taskType || !selectedTypes.includes(task.taskType))) {
      return false;
    }
    
    return true;
  });

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter(t => t.status === status && !t.completed);
  };

  // Determine which columns to show based on available tasks
  const getVisibleColumns = () => {
    const columns = [...BASE_STATUS_COLUMNS];
    
    // Add overdue column if there are overdue tasks
    const hasOverdue = filteredTasks.some(t => t.status === 'overdue' && !t.completed);
    if (hasOverdue) {
      columns.unshift(OPTIONAL_STATUS_COLUMNS[0]); // Add overdue at the beginning
    }
    
    // Add future column if there are future tasks
    const hasFuture = filteredTasks.some(t => t.status === 'future' && !t.completed);
    if (hasFuture) {
      columns.push(OPTIONAL_STATUS_COLUMNS[1]); // Add future at the end
    }
    
    return columns;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    if (d.toDateString() === tomorrow.toDateString()) return 'Завтра';
    
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const isOverdue = (dueDate: Date | string | null) => {
    if (!dueDate) return false;
    const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    return d < new Date() && d.toDateString() !== new Date().toDateString();
  };

  const taskTypes = Array.from(new Set(tasks.map(t => t.taskType).filter(Boolean))) as string[];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-architect-900"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-architect-200 dark:border-architect-700">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-architect-900 dark:text-white">Задачи</h1>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Поиск задач..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-architect-300 dark:border-architect-600 rounded-lg text-sm bg-white dark:bg-architect-800 text-architect-900 dark:text-white"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg ${showFilters ? 'bg-architect-200 dark:bg-architect-700' : ''}`}
            >
              <Filter className="w-5 h-5 text-architect-600 dark:text-architect-400" />
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setShowTaskForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Создать задачу</span>
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-architect-200 dark:border-architect-700 bg-architect-50 dark:bg-architect-800/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Исполнитель
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {users.map(user => (
                  <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAssignees.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAssignees([...selectedAssignees, user.id]);
                        } else {
                          setSelectedAssignees(selectedAssignees.filter(id => id !== user.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-architect-700 dark:text-architect-300">{user.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Приоритет
              </label>
              <div className="space-y-2">
                {(['urgent', 'high', 'medium', 'low'] as const).map(priority => (
                  <label key={priority} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPriorities.includes(priority)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPriorities([...selectedPriorities, priority]);
                        } else {
                          setSelectedPriorities(selectedPriorities.filter(p => p !== priority));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-architect-700 dark:text-architect-300">{PRIORITY_LABELS[priority]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-2">
                Тип задачи
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {taskTypes.map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTypes([...selectedTypes, type]);
                        } else {
                          setSelectedTypes(selectedTypes.filter(t => t !== type));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-architect-700 dark:text-architect-300">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {getVisibleColumns().map(column => {
              const columnTasks = getTasksByStatus(column.id);
              return (
                <DroppableColumn
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  color={column.color}
                  tasks={columnTasks}
                  onTaskEdit={(task) => setEditingTask(task)}
                  onTaskDelete={(id) => handleDeleteTask(id)}
                  onTaskToggleComplete={(task) => handleToggleComplete(task)}
                />
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="bg-white dark:bg-architect-800 rounded-lg shadow-xl p-4 w-80 opacity-90">
              <div className="font-semibold text-architect-900 dark:text-white mb-2">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskFormModal
          task={editingTask}
          users={users}
          taskTypes={taskTypes}
          onClose={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
          onSubmit={editingTask ? 
            (data) => handleUpdateTask(editingTask.id, data) :
            handleCreateTask
          }
        />
      )}
    </div>
  );
};

// Droppable Column Component
interface DroppableColumnProps {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (id: string) => void;
  onTaskToggleComplete: (task: Task) => void;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({
  id,
  title,
  color,
  tasks,
  onTaskEdit,
  onTaskDelete,
  onTaskToggleComplete,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-80 ${color} rounded-lg p-4 ${isOver ? 'ring-2 ring-architect-500' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-architect-900 dark:text-white">
          {title}
        </h2>
        <span className="bg-white dark:bg-architect-800 text-architect-700 dark:text-architect-300 px-2 py-1 rounded-full text-sm">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">
        {tasks.map(task => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            onEdit={() => onTaskEdit(task)}
            onDelete={() => onTaskDelete(task.id)}
            onToggleComplete={() => onTaskToggleComplete(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-architect-500 dark:text-architect-400 py-8 text-sm">
            Нет задач
          </div>
        )}
      </div>
    </div>
  );
};

// Draggable Task Card Component
interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}

const DraggableTaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onToggleComplete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;
  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    if (d.toDateString() === tomorrow.toDateString()) return 'Завтра';
    
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const isOverdue = (dueDate: Date | string | null) => {
    if (!dueDate) return false;
    const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    return d < new Date() && d.toDateString() !== new Date().toDateString();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-architect-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div {...listeners} {...attributes} className="flex-1 cursor-move">
          <h3 className="font-semibold text-architect-900 dark:text-white">{task.title}</h3>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleComplete();
            }}
            className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded"
          >
            {task.completed ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Circle className="w-4 h-4 text-architect-400" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEdit();
            }}
            className="p-1 hover:bg-architect-100 dark:hover:bg-architect-700 rounded text-architect-600 dark:text-architect-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {task.description && (
        <p className="text-sm text-architect-600 dark:text-architect-400 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}
      
      <div className="flex items-center gap-2 flex-wrap">
        {task.priority && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white ${PRIORITY_COLORS[task.priority]}`}>
            <Flag className="w-3 h-3" />
            {PRIORITY_LABELS[task.priority]}
          </div>
        )}
        
        {task.dueDate && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
            isOverdue(task.dueDate) 
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
              : 'bg-architect-100 dark:bg-architect-700 text-architect-700 dark:text-architect-300'
          }`}>
            <Calendar className="w-3 h-3" />
            {formatDate(task.dueDate)}
          </div>
        )}
        
        {task.assignedToUser && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-architect-100 dark:bg-architect-700 text-architect-700 dark:text-architect-300">
            <User className="w-3 h-3" />
            {task.assignedToUser.name.split(' ')[0]}
          </div>
        )}
        
        {task.taskType && (() => {
          const taskTypeConfig = TASK_TYPES.find(t => t.id === task.taskType);
          const Icon = taskTypeConfig?.icon || FileText;
          const SecondaryIcon = taskTypeConfig?.secondaryIcon;
          const label = taskTypeConfig?.label || task.taskType;
          const color = taskTypeConfig?.color || 'text-architect-700 dark:text-architect-300';
          
          return (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-architect-100 dark:bg-architect-700 ${color}`}>
              <Icon className="w-3 h-3" />
              {SecondaryIcon && <SecondaryIcon className="w-3 h-3" />}
              {label}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// Task Form Modal Component
interface TaskFormModalProps {
  task: Task | null;
  users: UserType[];
  taskTypes: string[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({ task, users, taskTypes, onClose, onSubmit }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(task?.priority || 'medium');
  const [taskType, setTaskType] = useState(() => {
    if (!task?.taskType) return '';
    const isStandardType = TASK_TYPES.some(t => t.id === task.taskType);
    return isStandardType ? task.taskType : 'other';
  });
  const [customTaskType, setCustomTaskType] = useState(
    task?.taskType && !TASK_TYPES.some(t => t.id === task.taskType) ? task.taskType : ''
  );
  const [dueDate, setDueDate] = useState(task?.dueDate ? (typeof task.dueDate === 'string' ? task.dueDate : task.dueDate.toISOString().split('T')[0]) : '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      const finalTaskType = taskType === 'other' ? (customTaskType.trim() || null) : (taskType.trim() || null);
      
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        assignedTo: assignedTo || null,
        priority,
        taskType: finalTaskType,
        dueDate: dueDate || null,
        // status is auto-determined from dueDate on backend
      });
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-architect-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-architect-900 dark:text-white mb-4">
          {task ? 'Редактировать задачу' : 'Создать задачу'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
              Название *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-700 text-architect-900 dark:text-white"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-700 text-architect-900 dark:text-white"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
                Исполнитель
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-700 text-architect-900 dark:text-white"
              >
                <option value="">Не назначен</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
                Приоритет
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-700 text-architect-900 dark:text-white"
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочно</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
                Тип задачи
              </label>
              <div className="relative">
                <select
                  value={taskType === '' || TASK_TYPES.some(t => t.id === taskType) ? taskType : 'other'}
                  onChange={(e) => {
                    if (e.target.value === 'other') {
                      setTaskType('other');
                    } else {
                      setTaskType(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-700 text-architect-900 dark:text-white appearance-none pr-10"
                >
                  <option value="">Не выбран</option>
                  {TASK_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
                {taskType && TASK_TYPES.find(t => t.id === taskType) && (() => {
                  const selectedType = TASK_TYPES.find(t => t.id === taskType)!;
                  const Icon = selectedType.icon;
                  return (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <Icon className={`w-4 h-4 ${selectedType.color}`} />
                    </div>
                  );
                })()}
              </div>
              {taskType === 'other' && (
                <input
                  type="text"
                  value={customTaskType}
                  onChange={(e) => setCustomTaskType(e.target.value)}
                  placeholder="Введите тип задачи"
                  className="w-full mt-2 px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-700 text-architect-900 dark:text-white"
                />
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-architect-700 dark:text-architect-300 mb-1">
                Срок выполнения
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-architect-300 dark:border-architect-600 rounded-lg bg-white dark:bg-architect-700 text-architect-900 dark:text-white"
              />
            </div>
          </div>
          
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-architect-300 dark:border-architect-600 rounded-lg text-architect-700 dark:text-architect-300 hover:bg-architect-50 dark:hover:bg-architect-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 bg-architect-900 dark:bg-white text-white dark:text-architect-900 rounded-lg hover:bg-architect-800 dark:hover:bg-architect-100 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : (task ? 'Сохранить' : 'Создать')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
