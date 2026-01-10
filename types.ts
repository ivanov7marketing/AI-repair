
export interface FurnitureItem {
  id: string;
  name: string;
  image?: string;
}

export interface EstimationItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
  type?: 'work' | 'rough' | 'finish';
  linkedMaterials?: EstimationItem[];
  supplierUrl?: string;
  subcategory?: string;
}

export interface EstimationSection {
  items: EstimationItem[];
}

export interface RoomEstimation {
  works: Record<string, EstimationSection>;
  roughMaterials: EstimationSection;
  finishMaterials: EstimationSection;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  suggestedStyle?: string;
  area?: string;
  perimeter?: string;
  angles?: string;
  doors?: string;
  windows?: string;
  wallArea?: string;
  realPhotos?: string[];
  furniture: FurnitureItem[];
  estimation?: RoomEstimation;
}

export interface AnalysisResult {
  rooms: Room[];
  architecturalStyle: string;
  styleReferenceImage?: string;
  totalAreaEstimate?: string;
  propertyDescription?: string;
  globalDescription?: string;
  ceilingHeight?: string;
  propertyPhotos?: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  thumbnail?: string;
  analysis?: AnalysisResult;
  global3DImage?: string;
  roomImages?: Record<string, string>;
  planFile?: File | null;
  planPreview?: string | null;
}

export enum AppState {
  LOGIN = 'LOGIN',
  PROJECT_LIST = 'PROJECT_LIST',
  UPLOAD = 'UPLOAD',
  ANALYZING = 'ANALYZING',
  VIEW_PROJECT = 'VIEW_PROJECT',
}

export type ImageSize = '1K' | '2K' | '4K';

// Auth types
export type UserRole = 'admin' | 'manager' | 'measurer' | 'foreman' | 'master' | 'client';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterAdminRequest {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const PERMISSIONS = {
  EDIT_PRICES: 'edit_prices',
  VIEW_ALL_PROJECTS: 'view_all_projects',
  CREATE_PROJECTS: 'create_projects',
  CREATE_USERS: 'create_users',
  USE_AI_GENERATION: 'use_ai_generation',
  VIEW_ESTIMATES: 'view_estimates',
  EDIT_ESTIMATES: 'edit_estimates',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_PERMISSIONS: 'manage_permissions',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];