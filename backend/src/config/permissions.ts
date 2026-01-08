import { UserRole } from '../types/auth';

export const PERMISSIONS = {
  EDIT_PRICES: 'edit_prices',
  VIEW_ALL_PROJECTS: 'view_all_projects',
  CREATE_PROJECTS: 'create_projects',
  DELETE_PROJECTS: 'delete_projects',
  CREATE_USERS: 'create_users',
  USE_AI_GENERATION: 'use_ai_generation',
  VIEW_ESTIMATES: 'view_estimates',
  EDIT_ESTIMATES: 'edit_estimates',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_PERMISSIONS: 'manage_permissions',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    PERMISSIONS.EDIT_PRICES,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.DELETE_PROJECTS,
    PERMISSIONS.CREATE_USERS,
    PERMISSIONS.USE_AI_GENERATION,
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.EDIT_ESTIMATES,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_PERMISSIONS,
  ],
  manager: [
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.EDIT_ESTIMATES,
    PERMISSIONS.USE_AI_GENERATION,
  ],
  measurer: [
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.USE_AI_GENERATION,
  ],
  foreman: [
    PERMISSIONS.VIEW_ESTIMATES,
    PERMISSIONS.EDIT_ESTIMATES,
  ],
  master: [
    PERMISSIONS.VIEW_ESTIMATES,
  ],
  client: [],
};

