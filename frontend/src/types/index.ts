// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User and Authentication types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'USER';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expiresIn: string;
}

// Tenant types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

// Connector types
export interface Connector {
  id: string;
  tenantId: string;
  connectorType: 'FRESHSERVICE' | 'SERVICENOW' | 'ZENDESK';
  name: string;
  config: Record<string, any>;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectorRequest {
  connectorType: string;
  name: string;
  config: Record<string, any>;
}

export interface TestConnectorResponse {
  success: boolean;
  message: string;
  details?: {
    version?: string;
    endpoints?: string[];
    permissions?: string[];
  };
}

// Job types
export interface Job {
  id: string;
  tenantId: string;
  sourceConnectorId: string;
  destinationConnectorId?: string;
  entities: string[];
  options: Record<string, any>;
  status: 'QUEUED' | 'RUNNING' | 'EXTRACTING' | 'DATA_READY' | 'LOADING' | 'COMPLETED' | 'FAILED';
  progress?: JobProgress;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobProgress {
  jobId: string;
  status: string;
  currentEntity?: string;
  recordsProcessed: number;
  totalRecords?: number;
  estimatedCompletion?: string;
  error?: string;
  phase?: string;
}

export interface CreateJobRequest {
  sourceConnectorId: string;
  destinationConnectorId?: string;
  entities: string[];
  options: {
    batchSize?: number;
    startDate?: string;
    endDate?: string;
    filters?: Record<string, any>;
  };
}

// UI State types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
}

export interface LoadingState {
  [key: string]: boolean;
}

export interface ErrorState {
  [key: string]: string | null;
} 