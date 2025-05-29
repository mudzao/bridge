// Re-export Prisma types
export * from '@prisma/client';

// Job Type enum
export enum JobType {
  EXTRACTION = 'EXTRACTION',
  MIGRATION = 'MIGRATION'
}

// Job Status enum (matching Prisma schema)
export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  EXTRACTING = 'EXTRACTING',
  DATA_READY = 'DATA_READY',
  LOADING = 'LOADING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

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

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    tenantId: string;
  };
  token: string;
  expiresIn: string;
}

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  iat: number;
  exp: number;
}

// Job types
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
  jobType: JobType;
  sourceConnectorId: string;
  targetConnectorId?: string;
  destinationConnectorId?: string;
  name?: string;
  description?: string;
  entities: string[];
  options: {
    batchSize?: number;
    startDate?: string;
    endDate?: string;
    filters?: Record<string, any>;
  };
}

// Connector types
export interface ConnectorConfig {
  [key: string]: any;
}

export interface CreateConnectorRequest {
  connectorType: string;
  name: string;
  config: Record<string, any>;
}

export interface UpdateConnectorRequest {
  name?: string;
  config?: Record<string, any>;
  status?: 'ACTIVE' | 'DISABLED' | 'ERROR';
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

// Error types
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
} 