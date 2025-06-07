export interface ConnectorConfig {
  [key: string]: any;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: any;
}

export interface ExtractedData {
  entityType: string;
  records: any[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
  extractionSummary?: {
    pagesProcessed: number;
    recordsExtracted: number;
    totalAvailable: number;
    completionRate: number;
    limitedByMaxRecords: boolean;
  };
}

export interface ExtractionOptions {
  entityType: string;
  batchSize?: number;
  startDate?: string;
  endDate?: string;
  maxRecords?: number;
  cursor?: string;
  filters?: Record<string, any>;
  
  // New options for detailed extraction
  includeDetails?: boolean;          // Whether to fetch detailed information (default: true for tickets)
  detailBatchSize?: number;          // Batch size for detail API calls (default: 10, max: 20)
  ticketIncludes?: string[];         // Additional includes for ticket detail API (e.g., 'conversations', 'assets')
}

// New interfaces for loading operations
export interface LoadOptions {
  entityType: string;
  batchSize?: number;
  validateOnly?: boolean;
  overwriteExisting?: boolean;
  skipDuplicates?: boolean;
}

export interface LoadResult {
  entityType: string;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  errors: LoadError[];
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
}

export interface LoadError {
  recordId?: string;
  externalId?: string;
  error: string;
  field?: string;
  value?: any;
}

// Entity definition for the new architecture
export interface EntityDefinition {
  name: string;
  type: EntityType;
  
  // Extraction configuration
  extraction: {
    endpoint: string;
    method: 'GET';
    detailEndpoint?: string;         // Optional detail endpoint for two-step extraction (e.g., '/tickets/{id}')
    detailRequired?: boolean;        // Whether detail extraction is required for complete data
    fields: Record<string, FieldDefinition>;
    pagination?: {
      type: 'cursor' | 'offset' | 'page';
      param: string;
    };
  };
  
  // Loading configuration
  loading: {
    endpoint: string;
    method: 'POST' | 'PUT';
    fields: Record<string, FieldDefinition>;
    requiredFields: string[];
    validation?: Record<string, ValidationRule>;
  };
}

export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  readOnly?: boolean;
  createOnly?: boolean;
  updateOnly?: boolean;
  validation?: ValidationRule;
}

export interface ValidationRule {
  type: 'regex' | 'enum' | 'range' | 'custom';
  value: any;
  message: string;
}

export interface ConnectorInterface {
  /**
   * Test the connection to the external system
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Authenticate with the external system
   */
  authenticate(): Promise<boolean>;

  /**
   * Extract data from the external system
   */
  extractData(options: ExtractionOptions): Promise<ExtractedData>;

  /**
   * Load data into the external system
   */
  loadData(options: LoadOptions, data: any[]): Promise<LoadResult>;

  /**
   * Get the supported entity types for this connector
   */
  getSupportedEntities(): string[];

  /**
   * Get the schema for a specific entity type
   */
  getEntitySchema(entityType: string): Record<string, any>;

  /**
   * Get the entity definition for a specific entity type (new architecture)
   */
  getEntityDefinition(entityType: EntityType): EntityDefinition;

  /**
   * Transform data from external format to internal format (for extraction)
   */
  transformData(entityType: string, externalData: any[]): any[];

  /**
   * Transform data from internal format to external format (for loading)
   */
  transformForLoad(entityType: string, internalData: any[]): any[];

  /**
   * Validate data before loading
   */
  validateForLoad(entityType: string, data: any[]): LoadError[];
}

export interface ConnectorCapabilities {
  maxBatchSize: number;           // Maximum records per API request (per_page limit)
  defaultBatchSize: number;       // Recommended batch size for optimal performance
  maxDetailBatchSize: number;     // Maximum concurrent detail requests (for tickets)
  defaultDetailBatchSize: number; // Recommended concurrent detail requests
  maxRecordsLimit?: number;       // Optional: Maximum total records the API can handle
  supportsPagination: boolean;    // Whether the API supports pagination
  supportsDateFiltering: boolean; // Whether the API supports date-based filtering
  supportsDetailExtraction: boolean; // Whether the connector supports detailed extraction
}

export interface ConnectorMetadata {
  type: string;
  name: string;
  description: string;
  version: string;
  capabilities: ConnectorCapabilities;  // Add capabilities to metadata
}

export enum EntityType {
  TICKETS = 'tickets',
  ASSETS = 'assets',
  USERS = 'users',
  GROUPS = 'groups',
  INCIDENTS = 'incidents',
  CHANGES = 'changes',
  PROBLEMS = 'problems',
  RELEASES = 'releases'
}

export interface ConnectorError extends Error {
  code: string;
  statusCode?: number;
  details?: any;
  retryAfter?: number | undefined; // Milliseconds to wait before retrying
} 