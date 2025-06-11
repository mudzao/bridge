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
import { rateLimiterService } from '@/services/rate-limiter.service';

export abstract class BaseConnector implements ConnectorInterface {
  protected config: ConnectorConfig;
  protected httpClient: AxiosInstance;
  protected metadata: ConnectorMetadata;
  protected isAuthenticated: boolean = false;
  protected connectorId: string; // Add connector ID for rate limiting

  constructor(config: ConnectorConfig, metadata: ConnectorMetadata, connectorId?: string) {
    this.config = config;
    this.metadata = metadata;
    this.connectorId = connectorId || `${metadata.type}_${Date.now()}`; // Fallback ID
    
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
    // Handle rate limiting (429) errors
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      rateLimiterService.record429Error(
        this.connectorId,
        this.metadata.type,
        retryAfter
      );
      
      const connectorError: ConnectorError = new Error(
        `Rate limit exceeded. Retry after ${retryAfter || 'unknown'} seconds.`
      ) as ConnectorError;
      
      connectorError.code = 'RATE_LIMITED';
      connectorError.statusCode = 429;
      connectorError.retryAfter = retryAfter ? parseInt(retryAfter) * 1000 : undefined;
      connectorError.details = { retryAfter, ...error.response?.data };
      
      return Promise.reject(connectorError);
    }

    const connectorError: ConnectorError = new Error(
      error.response?.data?.message || error.message || 'Unknown error'
    ) as ConnectorError;
    
    connectorError.code = error.response?.data?.code || 'HTTP_ERROR';
    connectorError.statusCode = error.response?.status;
    connectorError.details = error.response?.data;
    
    return Promise.reject(connectorError);
  }

  /**
   * Make rate-limited HTTP request
   */
  protected async makeRateLimitedRequest(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    options: any = {},
    retryCount: number = 0
  ): Promise<any> {
    const maxRetries = 3;
    
    try {
      // Check rate limit before making request
      const rateLimitResult = await rateLimiterService.checkRateLimit(
        this.connectorId,
        this.metadata.type
      );

      if (!rateLimitResult.allowed) {
        this.log('warn', `Rate limit exceeded for ${this.metadata.type}:${this.connectorId}`, {
          remainingRequests: rateLimitResult.remainingRequests,
          resetTime: new Date(rateLimitResult.resetTime).toISOString()
        });

        // Wait for rate limit to reset
        await rateLimiterService.waitForRateLimit(
          this.connectorId,
          this.metadata.type,
          rateLimitResult.retryAfterMs
        );

        // Retry the request
        return this.makeRateLimitedRequest(method, endpoint, options, retryCount + 1);
      }

      // Make the actual HTTP request
      const response = await this.httpClient[method](endpoint, options);
      
      this.log('info', `API request successful: ${method.toUpperCase()} ${endpoint}`, {
        remainingRequests: rateLimitResult.remainingRequests
      });
      
      return response;
      
    } catch (error: any) {
      // Handle 429 errors with circuit breaker pattern
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60 seconds
        
        // Record the 429 error
        await rateLimiterService.record429Error(
          this.connectorId,
          this.metadata.type,
          retryAfter
        );
        
        this.log('warn', `429 Rate limit exceeded from API. Pausing extraction for ${retryAfterMs}ms`, {
          retryAfter,
          endpoint,
          retryCount: retryCount + 1
        });
        
        // Circuit breaker: pause the entire extraction process
        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
        
        // Retry the same request (don't fail and move to next ticket)
        if (retryCount < maxRetries) {
          this.log('info', `Retrying request after rate limit pause: ${method.toUpperCase()} ${endpoint}`);
          return this.makeRateLimitedRequest(method, endpoint, options, retryCount + 1);
        } else {
          // After max retries, throw error but with clear message
          const circuitBreakerError = new Error(
            `Rate limit exceeded: Failed after ${maxRetries} retries with 429 errors. API may need longer cool-down period.`
          ) as any;
          circuitBreakerError.code = 'CIRCUIT_BREAKER_OPEN';
          circuitBreakerError.statusCode = 429;
          circuitBreakerError.retryAfter = retryAfterMs;
          throw circuitBreakerError;
        }
      }
      
      // Handle other HTTP errors normally
      if (error.response?.status) {
        const httpError = new Error(
          error.response?.data?.message || error.message || 'HTTP request failed'
        ) as any;
        httpError.statusCode = error.response.status;
        httpError.details = error.response?.data;
        throw httpError;
      }
      
      throw error;
    }
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

  /**
   * Default implementation - child classes can override for progress support
   */
  async extractDataWithProgress(
    options: ExtractionOptions,
    progressCallback?: (current: number, total: number, phase?: string) => Promise<void>
  ): Promise<ExtractedData> {
    // Default implementation falls back to regular extraction
    // Child classes should override this for true progress support
    // Suppress unused parameter warning
    void progressCallback;
    return this.extractData(options);
  }
} 