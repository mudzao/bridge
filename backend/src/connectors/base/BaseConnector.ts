import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { 
  ConnectorInterface, 
  ConnectorConfig, 
  ConnectionTestResult, 
  ExtractedData, 
  ExtractionOptions,
  ConnectorMetadata,
  ConnectorError,
  EntityType,
  LoadOptions,
  LoadResult,
  LoadError,
  EntityDefinition
} from './ConnectorInterface';

export abstract class BaseConnector implements ConnectorInterface {
  protected config: ConnectorConfig;
  protected httpClient: AxiosInstance;
  protected metadata: ConnectorMetadata;
  protected isAuthenticated: boolean = false;

  constructor(config: ConnectorConfig, metadata: ConnectorMetadata) {
    this.config = config;
    this.metadata = metadata;
    
    // Create HTTP client with base configuration
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => this.addAuthHeaders(config),
      (error: any) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response: any) => response,
      (error: any) => this.handleHttpError(error)
    );
  }

  /**
   * Add authentication headers to requests
   */
  protected abstract addAuthHeaders(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig;

  /**
   * Handle HTTP errors and convert to ConnectorError
   */
  protected handleHttpError(error: any): Promise<never> {
    const connectorError: ConnectorError = new Error(
      error.response?.data?.message || error.message || 'Unknown error'
    ) as ConnectorError;
    
    connectorError.code = error.response?.data?.code || 'HTTP_ERROR';
    connectorError.statusCode = error.response?.status;
    connectorError.details = error.response?.data;
    
    return Promise.reject(connectorError);
  }

  /**
   * Make a paginated request to the API
   */
  protected async makePaginatedRequest(
    endpoint: string,
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    const params: any = {
      per_page: options.batchSize || 100
    };

    if (options.startDate) {
      params.updated_since = options.startDate;
    }

    if (options.cursor) {
      params.page = options.cursor;
    }

    if (options.filters) {
      Object.assign(params, options.filters);
    }

    try {
      const response = await this.httpClient.get(endpoint, { params });
      const nextCursor = this.getNextCursor(response);
      
      return {
        entityType: options.entityType,
        records: response.data[this.getDataArrayKey(options.entityType)] || response.data,
        totalCount: this.extractTotalCount(response),
        hasMore: this.hasMorePages(response),
        ...(nextCursor && { nextCursor })
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the key for the data array in API responses
   */
  protected abstract getDataArrayKey(entityType: string): string;

  /**
   * Extract total count from API response
   */
  protected abstract extractTotalCount(response: any): number;

  /**
   * Check if there are more pages available
   */
  protected abstract hasMorePages(response: any): boolean;

  /**
   * Get the cursor for the next page
   */
  protected abstract getNextCursor(response: any): string | undefined;

  /**
   * Validate configuration
   */
  protected validateConfig(): void {
    if (!this.config) {
      throw new Error('Connector configuration is required');
    }
  }

  /**
   * Helper method for logging
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logData = {
      connector: this.metadata.type,
      message,
      ...(data && { data })
    };
    
    console[level](`[${this.metadata.type.toUpperCase()}]`, logData);
  }

  /**
   * Get connector metadata
   */
  public getMetadata(): ConnectorMetadata {
    return this.metadata;
  }

  // Abstract methods that must be implemented by concrete connectors
  public abstract testConnection(): Promise<ConnectionTestResult>;
  public abstract authenticate(): Promise<boolean>;
  public abstract extractData(options: ExtractionOptions): Promise<ExtractedData>;
  public abstract loadData(options: LoadOptions, data: any[]): Promise<LoadResult>;
  public abstract getSupportedEntities(): string[];
  public abstract getEntitySchema(entityType: string): Record<string, any>;
  public abstract getEntityDefinition(entityType: EntityType): EntityDefinition;
  public abstract transformData(entityType: string, externalData: any[]): any[];
  public abstract transformForLoad(entityType: string, internalData: any[]): any[];
  public abstract validateForLoad(entityType: string, data: any[]): LoadError[];

  /**
   * Check if connector is authenticated
   */
  public getAuthenticationStatus(): boolean {
    return this.isAuthenticated;
  }
} 