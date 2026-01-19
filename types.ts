
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
  global3DImages?: string[];
  roomImages?: Record<string, string[]>;
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
  // Warehouse permissions
  VIEW_WAREHOUSE: 'view_warehouse',
  CREATE_PURCHASE_REQUESTS: 'create_purchase_requests',
  APPROVE_PURCHASE_REQUESTS: 'approve_purchase_requests',
  MANAGE_WAREHOUSE: 'manage_warehouse',
  MANAGE_TOOLS: 'manage_tools',
  // Sales permissions
  VIEW_SALES: 'view_sales',
  CREATE_DEALS: 'create_deals',
  EDIT_DEALS: 'edit_deals',
  DELETE_DEALS: 'delete_deals',
  MANAGE_PIPELINE: 'manage_pipeline',
  VIEW_ALL_DEALS: 'view_all_deals',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Export types
export interface ExportOptions {
  includeWorks: boolean;
  includeRoughMaterials: boolean;
  includeFinishMaterials: boolean;
  groupByRooms: boolean;
  format: 'xlsx' | 'pdf';
}

// Warehouse types
export interface Material {
  id: string;
  organizationId: string;
  name: string;
  category?: string;
  unit: string;
  photo?: string;
  averagePrice?: number;
  notes?: string;
  minStockLevel?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface PurchaseRequest {
  id: string;
  organizationId: string;
  projectId?: string;
  requestNumber: string;
  status: 'new' | 'in_progress' | 'approved' | 'purchased' | 'rejected';
  createdBy: string;
  createdAt: string;
  urgency: 'normal' | 'urgent';
  totalAmount: number;
  estimateProjectId?: string;
  approvedBy?: string;
  approvedAt?: string | null;
  rejectedReason?: string;
  needsReorder: boolean;
  items?: PurchaseRequestItem[];
  purchaseInfo?: PurchaseInfo;
  log?: PurchaseRequestLogEntry[];
}

export interface PurchaseRequestItem {
  id: string;
  requestId: string;
  materialId?: string;
  material?: Material;
  quantityRequested: number;
  quantityApproved?: number;
  quantityPurchased: number;
  unitPrice?: number;
  note?: string;
  fromEstimate: boolean;
  estimateItemId?: string;
  estimateProjectId?: string;
  estimateRoomId?: string;
  estimateItemPath?: string;
}

export interface PurchaseInfo {
  id: string;
  requestId: string;
  supplierId?: string;
  supplier?: Supplier;
  responsiblePerson?: string;
  plannedDate?: string;
  actualDate?: string;
  documentUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseRequestLogEntry {
  id: string;
  requestId: string;
  action: string;
  performedBy: string;
  performedAt: string;
  comment?: string;
  oldStatus?: string;
  newStatus?: string;
}

export interface ProjectMaterial {
  id: string;
  organizationId: string;
  projectId: string;
  materialId: string;
  material?: Material;
  quantityPlanned: number;
  quantityPurchased: number;
  quantityOnSite: number;
  quantityUsed: number;
  status: 'excess' | 'normal' | 'low';
  lastMovementDate?: string;
}

export interface MaterialMovement {
  id: string;
  organizationId: string;
  projectId?: string;
  materialId: string;
  material?: Material;
  movementType: 'arrival' | 'writeoff' | 'return' | 'transfer';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  performedBy: string;
  documentUrl?: string;
  comment?: string;
  workStage?: string;
  createdAt: string;
}

export interface MaterialReturn {
  id: string;
  organizationId: string;
  projectId: string;
  materialId: string;
  material?: Material;
  quantity: number;
  returnAmount?: number;
  supplierId?: string;
  supplier?: Supplier;
  status: 'planned' | 'returned' | 'money_received';
  reason?: string;
  plannedDate?: string;
  actualDate?: string;
  documentUrl?: string;
  initiatedBy: string;
  responsiblePerson?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tool {
  id: string;
  organizationId: string;
  inventoryNumber: string;
  name: string;
  brand?: string;
  model?: string;
  category?: 'электроинструмент' | 'ручной' | 'измерительный';
  photo?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  condition: 'working' | 'repair' | 'disposed';
  currentLocation: 'base' | 'project' | 'employee';
  currentProjectId?: string;
  currentEmployeeId?: string;
  assignedSince?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface ToolMovement {
  id: string;
  toolId: string;
  tool?: Tool;
  movementType: 'issue' | 'return';
  employeeId?: string;
  projectId?: string;
  issuedBy?: string;
  returnedBy?: string;
  issuedAt?: string;
  returnedAt?: string;
  plannedReturnDate?: string;
  conditionOnReturn?: 'working' | 'repair' | 'disposed';
  photoOnIssue?: string;
  photoOnReturn?: string;
  comment?: string;
  createdAt: string;
}

export interface WarehouseOperation {
  id: string;
  organizationId: string;
  operationType: 'purchase' | 'arrival' | 'writeoff' | 'return' | 'tool_issue' | 'tool_return' | 'transfer';
  projectId?: string;
  materialId?: string;
  material?: Material;
  toolId?: string;
  tool?: Tool;
  quantity?: number;
  fromLocation?: string;
  toLocation?: string;
  performedBy: string;
  documentUrl?: string;
  comment?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  contacts?: string;
  address?: string;
  returnConditions?: string;
  discounts?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseStock {
  id: string;
  organizationId: string;
  materialId: string;
  material?: Material;
  quantity: number;
  lastUpdated: string;
}

// Sales types
export interface PipelineStage {
  id: string;
  organizationId: string;
  name: string;
  orderIndex: number;
  color: string;
  stageType: 'active' | 'won' | 'lost' | 'system';
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DealSource {
  id: string;
  organizationId: string;
  name: string;
  icon: string | null;
  isActive: boolean;
  leadCost: number | null;
  createdAt: Date | string;
}

export type TimelineEventType = 
  | 'comment' 
  | 'stage_change' 
  | 'call' 
  | 'email' 
  | 'task' 
  | 'file_upload' 
  | 'field_change' 
  | 'deal_created';

export interface DealTimelineEvent {
  id: string;
  dealId: string;
  eventType: TimelineEventType;
  userId: string;
  content: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date | string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DealFile {
  id: string;
  dealId: string;
  fileType: 'photo' | 'drawing' | 'document' | 'reference';
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  uploadedBy: string;
  createdAt: Date | string;
  uploadedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DealTask {
  id: string;
  dealId: string;
  title: string;
  description: string | null;
  assignedTo: string;
  dueDate: Date | string | null;
  completed: boolean;
  completedAt: Date | string | null;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  assignedToUser?: {
    id: string;
    name: string;
    email: string;
  };
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Deal {
  id: string;
  organizationId: string;
  stageId: string;
  sourceId: string | null;
  projectId: string | null;
  objectId: string | null;
  
  // Contact information
  leadName: string;
  phone: string;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  
  // Object information
  address: string | null;
  buildingType: string | null;
  area: number | null;
  roomsCount: string | null;
  bathroomType: string | null;
  ceilingHeight: number | null;
  hasElevator: boolean;
  
  // Repair parameters
  repairType: string | null;
  objectCondition: string | null;
  budgetFrom: number | null;
  budgetTo: number | null;
  needsDesign: boolean;
  needsDemolition: boolean;
  materialPurchaseType: string | null;
  desiredStartDate: Date | string | null;
  urgency: string | null;
  
  // Sales process
  responsibleManagerId: string | null;
  leadTemperature: 'hot' | 'warm' | 'cold';
  daysOnStage: number;
  stageEnteredAt: Date | string;
  
  // Measurement
  measurerId: string | null;
  measurementDate: Date | string | null;
  measurementTime: string | null;
  measurementCompleted: boolean;
  measurementNotes: string | null;
  
  // Traffic source
  trafficSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  utmDevice: string | null;
  utmRegionName: string | null;
  clientId: string | null;
  
  // Documents
  contractFileUrl: string | null;
  contractSignedDate: Date | string | null;
  prepaymentAmount: number | null;
  prepaymentDate: Date | string | null;
  
  // Metadata
  isRealized: boolean;
  isClosed: boolean;
  closedReason: string | null;
  closedAt: Date | string | null;
  tags: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  
  // Joined data (optional, populated when needed)
  stage?: PipelineStage;
  source?: DealSource;
  responsibleManager?: {
    id: string;
    name: string;
    email: string;
  };
  measurer?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  };
}