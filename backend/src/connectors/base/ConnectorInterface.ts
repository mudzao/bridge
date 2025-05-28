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
}

export interface ExtractionOptions {
  entityType: string;
  batchSize?: number;
  startDate?: string;
  endDate?: string;
  cursor?: string;
  filters?: Record<string, any>;
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
   * Get the supported entity types for this connector
   */
  getSupportedEntities(): string[];

  /**
   * Get the schema for a specific entity type
   */
  getEntitySchema(entityType: string): Record<string, any>;

  /**
   * Transform data from external format to internal format
   */
  transformData(entityType: string, externalData: any[]): any[];

  /**
   * Load data into the external system (for destination connectors)
   */
  loadData?(entityType: string, data: any[]): Promise<any>;
}

export interface ConnectorMetadata {
  name: string;
  type: string;
  version: string;
  supportedEntities: string[];
  authType: 'api_key' | 'oauth' | 'basic' | 'token';
  baseUrl?: string;
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
} 