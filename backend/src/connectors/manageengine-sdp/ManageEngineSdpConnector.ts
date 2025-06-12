import { InternalAxiosRequestConfig } from 'axios';
import { BaseConnector } from '../base/BaseConnector';
import { 
  ConnectorConfig, 
  ConnectionTestResult,
  ExtractedData,
  ExtractionOptions, 
  ConnectorMetadata,
  EntityType,
  LoadOptions, 
  LoadResult, 
  LoadError,
  EntityDefinition
} from '../base/ConnectorInterface';
import {
  ManageEngineSdpConfig,
  ManageEngineSdpRequest,
  ManageEngineSdpAsset,
  ManageEngineSdpUser,
  ManageEngineSdpProblem,
  ManageEngineSdpChange,
  ManageEngineSdpProject,
  ManageEngineSdpCmdbItem,
  MANAGEENGINE_SDP_SCHEMAS,
  MANAGEENGINE_SDP_ENTITY_DEFINITIONS,
  OAuthTokenResponse
} from './ManageEngineSdpTypes';
import axios from 'axios';

export class ManageEngineSdpConnector extends BaseConnector {
  private sdpConfig: ManageEngineSdpConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor(config: ConnectorConfig, connectorId?: string) {
    const metadata: ConnectorMetadata = {
      type: 'MANAGEENGINE_SDP',
      name: 'ManageEngine ServiceDesk Plus',
      description: 'ManageEngine ServiceDesk Plus ITSM platform connector with OAuth 2.0',
      version: '1.0.0',
      capabilities: {
        maxBatchSize: 100,
        defaultBatchSize: 50,
        maxDetailBatchSize: 20,
        defaultDetailBatchSize: 10,
        supportsPagination: true,
        supportsDateFiltering: true,
        supportsDetailExtraction: true
      }
    };

    super(config, metadata, connectorId);
    this.sdpConfig = config as ManageEngineSdpConfig;
    this.validateConfig();
    this.setupHttpClient();
  }

  protected override validateConfig(): void {
    super.validateConfig();
    
    if (!this.sdpConfig.baseUrl) {
      throw new Error('ManageEngine SDP base URL is required');
    }
    
    if (!this.sdpConfig.clientId) {
      throw new Error('ManageEngine SDP client ID is required');
    }
    
    if (!this.sdpConfig.clientSecret) {
      throw new Error('ManageEngine SDP client secret is required');
    }

    if (!this.sdpConfig.scope) {
      throw new Error('ManageEngine SDP OAuth scope is required');
    }

    // Validate OAuth flow type
    if (!['authorization_code', 'client_credentials'].includes(this.sdpConfig.grantType || 'authorization_code')) {
      throw new Error('Invalid grant type. Must be authorization_code or client_credentials');
    }
  }

  protected setupHttpClient(): void {
    // Determine the correct base URL for API calls
    const apiBaseUrl = this.sdpConfig.baseUrl.includes('/api/v3') 
      ? this.sdpConfig.baseUrl 
      : `${this.sdpConfig.baseUrl}/api/v3`;

    this.httpClient = axios.create({
      baseURL: apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/vnd.manageengine.sdp.v3+json',
        'User-Agent': 'Project-Bridge/1.0',
      },
    });

    // Add auth headers interceptor
    this.httpClient.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.accessToken) {
        config.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
      }
      return config;
    });

    // Add response interceptor for token refresh
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.refreshToken) {
          try {
            await this.refreshAccessToken();
            // Retry the original request
            const originalRequest = error.config;
            originalRequest.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
            return this.httpClient.request(originalRequest);
          } catch (refreshError) {
            this.log('error', 'Token refresh failed', refreshError);
            this.accessToken = null;
            this.refreshToken = null;
            this.tokenExpiresAt = null;
            return Promise.reject(error);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  protected addAuthHeaders(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    // Auth is handled by the interceptor in setupHttpClient
    return config;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        await this.authenticate();
      }
    }
  }

  /**
   * Check if the current token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    // Add 5 minute buffer before expiration
    return Date.now() >= (this.tokenExpiresAt - 300000);
  }

  /**
   * Authenticate using OAuth 2.0
   */
  public async authenticate(): Promise<boolean> {
    try {
      this.log('info', 'Authenticating with ManageEngine SDP using OAuth 2.0');

      if (this.sdpConfig.grantType === 'client_credentials') {
        return await this.authenticateClientCredentials();
      } else {
        return await this.authenticateAuthorizationCode();
      }
    } catch (error: any) {
      this.log('error', 'Authentication failed', error);
      return false;
    }
  }

  /**
   * Authenticate using client credentials flow
   */
  private async authenticateClientCredentials(): Promise<boolean> {
    const tokenUrl = this.getTokenUrl();
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.sdpConfig.clientId,
      client_secret: this.sdpConfig.clientSecret,
      scope: this.sdpConfig.scope
    });

    try {
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData: OAuthTokenResponse = response.data;
      this.setTokens(tokenData);
      this.isAuthenticated = true;
      
      this.log('info', 'Client credentials authentication successful');
      return true;
    } catch (error: any) {
      this.log('error', 'Client credentials authentication failed', error);
      return false;
    }
  }

  /**
   * Authenticate using authorization code flow
   */
  private async authenticateAuthorizationCode(): Promise<boolean> {
    if (!this.sdpConfig.authorizationCode) {
      throw new Error('Authorization code is required for authorization_code grant type');
    }

    const tokenUrl = this.getTokenUrl();
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.sdpConfig.clientId,
      client_secret: this.sdpConfig.clientSecret,
      code: this.sdpConfig.authorizationCode,
      redirect_uri: this.sdpConfig.redirectUri || 'https://localhost'
    });

    try {
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData: OAuthTokenResponse = response.data;
      this.setTokens(tokenData);
      this.isAuthenticated = true;
      
      this.log('info', 'Authorization code authentication successful');
      return true;
    } catch (error: any) {
      this.log('error', 'Authorization code authentication failed', error);
      return false;
    }
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = this.getTokenUrl();
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.sdpConfig.clientId,
      client_secret: this.sdpConfig.clientSecret,
      refresh_token: this.refreshToken
    });

    try {
      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData: OAuthTokenResponse = response.data;
      this.setTokens(tokenData);
      
      this.log('info', 'Token refresh successful');
    } catch (error: any) {
      this.log('error', 'Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Set tokens from OAuth response
   */
  private setTokens(tokenData: OAuthTokenResponse): void {
    this.accessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      this.refreshToken = tokenData.refresh_token;
    }
    
    // Calculate expiration time (default to 1 hour if not provided)
    const expiresIn = tokenData.expires_in || 3600;
    this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
  }

  /**
   * Get the appropriate token URL based on data center
   */
  private getTokenUrl(): string {
    // Default to .com if no specific data center is configured
    const dataCenterDomain = this.sdpConfig.dataCenterDomain || 'accounts.zoho.com';
    return `https://${dataCenterDomain}/oauth/v2/token`;
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    try {
      this.log('info', 'Testing ManageEngine SDP connection');
      
      // First authenticate
      const authResult = await this.authenticate();
      if (!authResult) {
        return {
          success: false,
          message: 'Authentication failed',
          details: {
            baseUrl: this.sdpConfig.baseUrl,
            error: 'OAuth authentication failed'
          }
        };
      }

      // Test connection by fetching a simple endpoint
      const response = await this.httpClient.get('/requests', {
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 1
            }
          })
        }
      });
      
      if (response.status === 200 && response.data) {
        this.log('info', 'ManageEngine SDP connection test successful');
        
        return {
          success: true,
          message: 'Successfully connected to ManageEngine ServiceDesk Plus',
          details: {
            baseUrl: this.sdpConfig.baseUrl,
            apiVersion: 'v3',
            authenticated: true
          }
        };
      } else {
        throw new Error('Invalid response from ManageEngine SDP API');
      }
    } catch (error: any) {
      this.log('error', 'ManageEngine SDP connection test failed', error);
      
      return {
        success: false,
        message: error.message || 'Failed to connect to ManageEngine ServiceDesk Plus',
        details: {
          baseUrl: this.sdpConfig.baseUrl,
          error: error.response?.data || error.message
        }
      };
    }
  }

  public async extractData(options: ExtractionOptions): Promise<ExtractedData> {
    if (!this.isAuthenticated) {
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Authentication failed');
      }
    }

    this.log('info', `Extracting ${options.entityType} data`, { options });

    switch (options.entityType) {
      case EntityType.TICKETS:
        return this.extractRequests(options);
      case EntityType.ASSETS:
        return this.extractAssets(options);
      case EntityType.USERS:
        return this.extractUsers(options);
      case EntityType.PROBLEMS:
        return this.extractProblems(options);
      case EntityType.CHANGES:
        return this.extractChanges(options);
      case EntityType.PROJECTS:
        return this.extractProjects(options);
      case EntityType.CMDB_ITEMS:
        return this.extractCmdbItems(options);
      default:
        throw new Error(`Unsupported entity type: ${options.entityType}`);
    }
  }

  private async extractRequests(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/requests';
    return this.extractPaginatedData(endpoint, 'requests', options);
  }

  private async extractAssets(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/assets';
    return this.extractPaginatedData(endpoint, 'assets', options);
  }

  private async extractUsers(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/requesters';
    return this.extractPaginatedData(endpoint, 'requesters', options);
  }

  private async extractProblems(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/problems';
    return this.extractPaginatedData(endpoint, 'problems', options);
  }

  private async extractChanges(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/changes';
    return this.extractPaginatedData(endpoint, 'changes', options);
  }

  private async extractProjects(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/projects';
    return this.extractPaginatedData(endpoint, 'projects', options);
  }

  private async extractCmdbItems(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/cmdb/cis';
    return this.extractPaginatedData(endpoint, 'configuration_items', options);
  }

  /**
   * Generic method to extract paginated data from ManageEngine SDP
   */
  private async extractPaginatedData(
    endpoint: string, 
    dataKey: string, 
    options: ExtractionOptions
  ): Promise<ExtractedData> {
    const maxRecords = options.maxRecords;
    const batchSize = Math.min(options.batchSize || 100, 100); // SDP max is 100
    
    let allData: any[] = [];
    let currentIndex = options.cursor ? parseInt(options.cursor) : 1;
    let totalCount = 0;
    let hasMoreData = true;

    this.log('info', `Starting extraction from ${endpoint}`);

    while (hasMoreData && (!maxRecords || allData.length < maxRecords)) {
      const listInfo: any = {
        start_index: currentIndex,
        row_count: batchSize
      };

      // Add date filtering if provided
      if (options.startDate) {
        listInfo.search_criteria = {
          field: 'created_time.value',
          condition: 'greater than',
          value: new Date(options.startDate).getTime().toString()
        };
      }

      // Add custom filters
      if (options.filters) {
        if (listInfo.search_criteria) {
          // Combine with existing criteria using logical_operator
          listInfo.search_criteria = [
            listInfo.search_criteria,
            ...this.buildSearchCriteria(options.filters)
          ];
          listInfo.logical_operator = 'AND';
        } else {
          listInfo.search_criteria = this.buildSearchCriteria(options.filters);
        }
      }

      const params = {
        input_data: JSON.stringify({ list_info: listInfo })
      };

      try {
        this.log('info', `Extracting ${endpoint} batch starting at index ${currentIndex}`);
        const response = await this.makeRateLimitedRequest('get', endpoint, { params });
        
        const responseData = response.data;
        const batchData = responseData[dataKey] || [];
        
        // Store total count from first batch
        if (currentIndex === 1 && responseData.list_info) {
          totalCount = responseData.list_info.total_count || 0;
          this.log('info', `Total ${dataKey} available: ${totalCount}`);
        }

        if (batchData.length === 0) {
          hasMoreData = false;
          break;
        }

        allData.push(...batchData);
        currentIndex += batchData.length;

        // Check if we have more data
        hasMoreData = batchData.length === batchSize && 
                     (!maxRecords || allData.length < maxRecords) &&
                     (totalCount === 0 || currentIndex <= totalCount);

        this.log('info', `Extracted ${batchData.length} ${dataKey}, total: ${allData.length}`);

        // Respect rate limits
        if (hasMoreData) {
          await this.delay(100); // Small delay between requests
        }

      } catch (error: any) {
        this.log('error', `Error extracting ${endpoint}`, error);
        throw error;
      }
    }

    // Transform the data
    const transformedData = this.transformData(options.entityType, allData);

    return {
      data: transformedData,
      totalCount: totalCount || allData.length,
      extractedCount: allData.length,
      hasMore: hasMoreData,
      nextCursor: hasMoreData ? currentIndex.toString() : undefined,
      metadata: {
        endpoint,
        dataKey,
        batchSize,
        totalBatches: Math.ceil(allData.length / batchSize)
      }
    };
  }

  /**
   * Build search criteria from filters
   */
  private buildSearchCriteria(filters: Record<string, any>): any[] {
    const criteria: any[] = [];
    
    for (const [field, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        criteria.push({
          field: field,
          condition: 'is',
          value: value.toString()
        });
      }
    }
    
    return criteria;
  }

  /**
   * Add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getSupportedEntities(): string[] {
    return [
      EntityType.TICKETS,
      EntityType.ASSETS, 
      EntityType.USERS,
      EntityType.PROBLEMS,
      EntityType.CHANGES,
      EntityType.PROJECTS,
      EntityType.CMDB_ITEMS
    ];
  }

  public getEntitySchema(entityType: string): Record<string, any> {
    return MANAGEENGINE_SDP_SCHEMAS[entityType] || {};
  }

  public getEntityDefinition(entityType: EntityType): EntityDefinition {
    return MANAGEENGINE_SDP_ENTITY_DEFINITIONS[entityType] || {
      name: entityType,
      fields: [],
      primaryKey: 'id',
      displayField: 'name'
    };
  }

  public transformData(entityType: string, externalData: any[]): any[] {
    switch (entityType) {
      case EntityType.TICKETS:
        return this.transformRequests(externalData);
      case EntityType.ASSETS:
        return this.transformAssets(externalData);
      case EntityType.USERS:
        return this.transformUsers(externalData);
      case EntityType.PROBLEMS:
        return this.transformProblems(externalData);
      case EntityType.CHANGES:
        return this.transformChanges(externalData);
      case EntityType.PROJECTS:
        return this.transformProjects(externalData);
      case EntityType.CMDB_ITEMS:
        return this.transformCmdbItems(externalData);
      default:
        return externalData;
    }
  }

  private transformRequests(requests: ManageEngineSdpRequest[]): any[] {
    return requests.map(request => ({
      id: request.id?.toString(),
      externalId: request.id?.toString(),
      subject: request.subject,
      description: request.description,
      status: request.status?.name,
      priority: request.priority?.name,
      requester: {
        id: request.requester?.id?.toString(),
        name: request.requester?.name,
        email: request.requester?.email_id
      },
      technician: request.technician ? {
        id: request.technician.id?.toString(),
        name: request.technician.name,
        email: request.technician.email_id
      } : null,
      group: request.group ? {
        id: request.group.id?.toString(),
        name: request.group.name
      } : null,
      category: request.category?.name,
      subcategory: request.subcategory?.name,
      createdAt: request.created_time?.value ? new Date(parseInt(request.created_time.value)) : null,
      updatedAt: request.last_updated_time?.value ? new Date(parseInt(request.last_updated_time.value)) : null,
      dueDate: request.due_by_time?.value ? new Date(parseInt(request.due_by_time.value)) : null,
      isServiceRequest: request.is_service_request,
      displayId: request.display_id,
      source: 'manageengine_sdp',
      rawData: request
    }));
  }

  private transformAssets(assets: ManageEngineSdpAsset[]): any[] {
    return assets.map(asset => ({
      id: asset.id?.toString(),
      externalId: asset.id?.toString(),
      name: asset.name,
      assetTag: asset.asset_tag,
      serialNumber: asset.serial_number,
      assetType: asset.asset_type?.name,
      assetState: asset.asset_state?.name,
      location: asset.location?.name,
      department: asset.department?.name,
      user: asset.user ? {
        id: asset.user.id?.toString(),
        name: asset.user.name,
        email: asset.user.email_id
      } : null,
      vendor: asset.vendor?.name,
      product: asset.product?.name,
      model: asset.model,
      warrantyExpiryDate: asset.warranty_expiry_date?.value ? new Date(parseInt(asset.warranty_expiry_date.value)) : null,
      acquisitionDate: asset.acquisition_date?.value ? new Date(parseInt(asset.acquisition_date.value)) : null,
      cost: asset.cost,
      salvageValue: asset.salvage_value,
      source: 'manageengine_sdp',
      rawData: asset
    }));
  }

  private transformUsers(users: ManageEngineSdpUser[]): any[] {
    return users.map(user => ({
      id: user.id?.toString(),
      externalId: user.id?.toString(),
      name: user.name,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email_id,
      phone: user.phone,
      mobile: user.mobile,
      jobTitle: user.job_title,
      department: user.department?.name,
      location: user.location?.name,
      isActive: !user.is_deleted,
      isTechnician: user.is_technician,
      isVipUser: user.is_vip_user,
      language: user.language,
      timeZone: user.time_zone,
      source: 'manageengine_sdp',
      rawData: user
    }));
  }

  private transformProblems(problems: ManageEngineSdpProblem[]): any[] {
    return problems.map(problem => ({
      id: problem.id?.toString(),
      externalId: problem.id?.toString(),
      subject: problem.subject,
      description: problem.description,
      status: problem.status?.name,
      priority: problem.priority?.name,
      impact: problem.impact?.name,
      urgency: problem.urgency?.name,
      category: problem.category?.name,
      subcategory: problem.subcategory?.name,
      assignedTo: problem.technician ? {
        id: problem.technician.id?.toString(),
        name: problem.technician.name,
        email: problem.technician.email_id
      } : null,
      group: problem.group ? {
        id: problem.group.id?.toString(),
        name: problem.group.name
      } : null,
      createdAt: problem.created_time?.value ? new Date(parseInt(problem.created_time.value)) : null,
      updatedAt: problem.last_updated_time?.value ? new Date(parseInt(problem.last_updated_time.value)) : null,
      source: 'manageengine_sdp',
      rawData: problem
    }));
  }

  private transformChanges(changes: ManageEngineSdpChange[]): any[] {
    return changes.map(change => ({
      id: change.id?.toString(),
      externalId: change.id?.toString(),
      title: change.title,
      description: change.description,
      status: change.status?.name,
      priority: change.priority?.name,
      impact: change.impact?.name,
      urgency: change.urgency?.name,
      risk: change.risk?.name,
      changeType: change.change_type?.name,
      category: change.category?.name,
      subcategory: change.subcategory?.name,
      assignedTo: change.technician ? {
        id: change.technician.id?.toString(),
        name: change.technician.name,
        email: change.technician.email_id
      } : null,
      group: change.group ? {
        id: change.group.id?.toString(),
        name: change.group.name
      } : null,
      scheduledStartTime: change.scheduled_start_time?.value ? new Date(parseInt(change.scheduled_start_time.value)) : null,
      scheduledEndTime: change.scheduled_end_time?.value ? new Date(parseInt(change.scheduled_end_time.value)) : null,
      createdAt: change.created_time?.value ? new Date(parseInt(change.created_time.value)) : null,
      updatedAt: change.last_updated_time?.value ? new Date(parseInt(change.last_updated_time.value)) : null,
      source: 'manageengine_sdp',
      rawData: change
    }));
  }

  private transformProjects(projects: ManageEngineSdpProject[]): any[] {
    return projects.map(project => ({
      id: project.id?.toString(),
      externalId: project.id?.toString(),
      title: project.title,
      description: project.description,
      status: project.status?.name,
      priority: project.priority?.name,
      projectType: project.project_type?.name,
      owner: project.owner ? {
        id: project.owner.id?.toString(),
        name: project.owner.name,
        email: project.owner.email_id
      } : null,
      startDate: project.start_date?.value ? new Date(parseInt(project.start_date.value)) : null,
      endDate: project.end_date?.value ? new Date(parseInt(project.end_date.value)) : null,
      actualStartDate: project.actual_start_date?.value ? new Date(parseInt(project.actual_start_date.value)) : null,
      actualEndDate: project.actual_end_date?.value ? new Date(parseInt(project.actual_end_date.value)) : null,
      percentageCompletion: project.percentage_completion,
      cost: project.cost,
      createdAt: project.created_time?.value ? new Date(parseInt(project.created_time.value)) : null,
      updatedAt: project.last_updated_time?.value ? new Date(parseInt(project.last_updated_time.value)) : null,
      source: 'manageengine_sdp',
      rawData: project
    }));
  }

  private transformCmdbItems(items: ManageEngineSdpCmdbItem[]): any[] {
    return items.map(item => ({
      id: item.id?.toString(),
      externalId: item.id?.toString(),
      name: item.name,
      ciType: item.ci_type?.name,
      status: item.status?.name,
      location: item.location?.name,
      department: item.department?.name,
      vendor: item.vendor?.name,
      model: item.model,
      serialNumber: item.serial_number,
      assetTag: item.asset_tag,
      description: item.description,
      createdAt: item.created_time?.value ? new Date(parseInt(item.created_time.value)) : null,
      updatedAt: item.last_updated_time?.value ? new Date(parseInt(item.last_updated_time.value)) : null,
      source: 'manageengine_sdp',
      rawData: item
    }));
  }

  // Loading operations (for future implementation)
  public async loadData(options: LoadOptions, data: any[]): Promise<LoadResult> {
    throw new Error('Loading data to ManageEngine SDP is not yet implemented');
  }

  public transformForLoad(entityType: string, internalData: any[]): any[] {
    throw new Error('Transform for load is not yet implemented');
  }

  public validateForLoad(entityType: string, data: any[]): LoadError[] {
    throw new Error('Validate for load is not yet implemented');
  }

  public override async extractDataWithProgress(
    options: ExtractionOptions,
    progressCallback?: (current: number, total: number, phase?: string) => Promise<void>
  ): Promise<ExtractedData> {
    // For now, delegate to the regular extractData method
    // TODO: Implement progress tracking for large extractions
    return this.extractData(options);
  }
} 