export interface PipelineStage {
  id: string;
  organizationId: string;
  name: string;
  orderIndex: number;
  color: string;
  stageType: 'active' | 'won' | 'lost' | 'system';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealSource {
  id: string;
  organizationId: string;
  name: string;
  icon: string | null;
  isActive: boolean;
  leadCost: number | null;
  createdAt: Date;
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
  desiredStartDate: string | null;
  urgency: string | null;
  
  // Sales process
  responsibleManagerId: string | null;
  leadTemperature: 'hot' | 'warm' | 'cold';
  daysOnStage: number;
  stageEnteredAt: Date;
  
  // Measurement
  measurerId: string | null;
  measurementDate: string | null;
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
  contractSignedDate: Date | null;
  prepaymentAmount: number | null;
  prepaymentDate: Date | null;
  
  // Metadata
  isRealized: boolean;
  isClosed: boolean;
  closedReason: string | null;
  closedAt: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  
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
  createdAt: Date;
  
  // Joined data
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
  createdAt: Date;
  
  // Joined data
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
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined data
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
