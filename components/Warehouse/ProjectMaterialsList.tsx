import React, { useState, useEffect } from 'react';
import { Package2, Plus, ArrowRight, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Project, ProjectMaterial } from '../../types';

interface ProjectMaterialsListProps {
  onSelectProject: (project: Project) => void;
  hasPermission: (permission: string) => boolean;
  refreshTrigger?: number;
}

export const ProjectMaterialsList: React.FC<ProjectMaterialsListProps> = ({
  onSelectProject,
  hasPermission,
  refreshTrigger,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectMaterials, setProjectMaterials] = useState<Record<string, ProjectMaterial[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, [refreshTrigger]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
      
      // Load materials for each project
      const materialsMap: Record<string, ProjectMaterial[]> = {};
      for (const project of data) {
        try {
          const materials = await api.getProjectMaterials(project.id);
          materialsMap[project.id] = materials;
        } catch (error) {
          console.error(`Failed to load materials for project ${project.id}:`, error);
          materialsMap[project.id] = [];
        }
      }
      setProjectMaterials(materialsMap);
    } catch (error) {
      console.error('Failed to load projects:', error);
      alert('Ошибка при загрузке объектов');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excess':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'low':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      excess: 'Избыток',
      normal: 'Норма',
      low: 'Нехватка',
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excess':
        return <CheckCircle className="w-4 h-4" />;
      case 'normal':
        return <CheckCircle className="w-4 h-4" />;
      case 'low':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const calculateTotalAmount = (materials: ProjectMaterial[]) => {
    return materials.reduce((sum, m) => {
      const price = m.material?.averagePrice || 0;
      return sum + m.quantityOnSite * price;
    }, 0);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const materials = projectMaterials[project.id] || [];
          const totalAmount = calculateTotalAmount(materials);
          const hasLowStock = materials.some((m) => m.status === 'low');

          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="bg-white dark:bg-architect-800 rounded-lg border border-architect-200 dark:border-architect-700 p-4 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-architect-900 dark:text-white mb-1">{project.name}</h3>
                  {hasLowStock && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3 h-3" />
                      Критично мало материалов
                    </span>
                  )}
                </div>
                <ArrowRight className="w-5 h-5 text-architect-400 shrink-0" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-architect-500 dark:text-architect-400">Материалов:</span>
                  <span className="font-medium text-architect-900 dark:text-white">{materials.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-architect-500 dark:text-architect-400">Сумма:</span>
                  <span className="font-medium text-architect-900 dark:text-white">
                    {totalAmount.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {projects.length === 0 && (
        <div className="text-center py-12 text-architect-500 dark:text-architect-400">
          Объекты не найдены
        </div>
      )}
    </div>
  );
};
