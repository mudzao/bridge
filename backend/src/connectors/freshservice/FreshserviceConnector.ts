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
  FreshserviceConfig,
  FreshserviceTicket,
  FreshserviceAsset,
  FreshserviceUser,
  FreshserviceGroup,
  FreshserviceAssetsResponse,
  FreshserviceUsersResponse,
  FreshserviceGroupsResponse,
  FRESHSERVICE_SCHEMAS,
  FRESHSERVICE_ENTITY_DEFINITIONS
} from './FreshserviceTypes';
import axios from 'axios';

export class FreshserviceConnector extends BaseConnector {
  private freshserviceConfig: FreshserviceConfig;

  constructor(config: ConnectorConfig, connectorId?: string) {
    const metadata: ConnectorMetadata = {
      type: 'FRESHSERVICE',
      name: 'Freshservice',
      description: 'Freshservice IT Service Management platform connector',
      version: '1.0.0',
      capabilities: {
        maxBatchSize: 100,
        defaultBatchSize: 100,
        maxDetailBatchSize: 20,
        defaultDetailBatchSize: 10,
        supportsPagination: true,
        supportsDateFiltering: true,
        supportsDetailExtraction: true
      }
    };

    super(config, metadata, connectorId);
    this.freshserviceConfig = config as FreshserviceConfig;
    this.validateConfig();
    this.setupHttpClient();
  }

  protected override validateConfig(): void {
    super.validateConfig();
    
    if (!this.freshserviceConfig.domain) {
      throw new Error('Freshservice domain is required');
    }
    
    if (!this.freshserviceConfig.apiKey) {
      throw new Error('Freshservice API key is required');
    }
  }

  protected setupHttpClient(): void {
    this.httpClient = axios.create({
      baseURL: `https://${this.config.domain}/api/v2`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Project-Bridge/1.0',
      },
      // Add SSL configuration to handle TLS issues
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: true,
        secureProtocol: 'TLSv1_2_method', // Force TLS 1.2
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384',
      }),
    });

    // Add auth headers
    this.httpClient.interceptors.request.use((config) => {
      const auth = Buffer.from(`${this.config.apiKey}:X`).toString('base64');
      config.headers.Authorization = `Basic ${auth}`;
      return config;
    });
  }

  protected addAuthHeaders(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    // Auth is handled by the interceptor in setupHttpClient
    return config;
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    try {
      this.log('info', 'Testing Freshservice connection');
      
      // Test connection by fetching the current user's profile
      const response = await this.httpClient.get('/agents/me');
      
      if (response.status === 200 && response.data) {
        this.isAuthenticated = true;
        this.log('info', 'Freshservice connection test successful');
        
        return {
          success: true,
          message: 'Successfully connected to Freshservice',
          details: {
            domain: this.freshserviceConfig.domain,
            user: response.data.agent?.email || 'Unknown',
            apiVersion: 'v2'
          }
        };
      } else {
        throw new Error('Invalid response from Freshservice API');
      }
    } catch (error: any) {
      this.log('error', 'Freshservice connection test failed', error);
      
      return {
        success: false,
        message: error.message || 'Failed to connect to Freshservice',
        details: {
          domain: this.freshserviceConfig.domain,
          error: error.response?.data || error.message
        }
      };
    }
  }

  public async authenticate(): Promise<boolean> {
    const result = await this.testConnection();
    return result.success;
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
        return this.extractTickets(options);
      case EntityType.ASSETS:
        return this.extractAssets(options);
      case EntityType.USERS:
        return this.extractUsers(options);
      case EntityType.GROUPS:
        return this.extractGroups(options);
      default:
        throw new Error(`Unsupported entity type: ${options.entityType}`);
    }
  }

  private async extractTickets(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/tickets';
    const maxRecords = options.maxRecords;
    const batchSize = options.batchSize || 100;
    
    let allTickets: any[] = [];
    let currentPage = options.cursor ? parseInt(options.cursor) : 1;
    let totalCount = 0;
    let hasMorePages = true;

    this.log('info', 'Starting multi-page ticket extraction from Freshservice');

    // Multi-page extraction loop
    while (hasMorePages) {
      const params: any = {
        per_page: batchSize,
        include: 'requester,stats',
        page: currentPage
      };

      if (options.startDate) {
        params.updated_since = options.startDate;
      }

      if (options.filters) {
        Object.assign(params, options.filters);
      }

      try {
        this.log('info', `Extracting ticket page ${currentPage} (${allTickets.length} records so far)`);
        const response = await this.makeRateLimitedRequest('get', endpoint, { params });
        const pageTickets = response.data.tickets || [];
        
        // Store total count from first page
        if (currentPage === 1) {
          totalCount = response.data.total || 0;
          this.log('info', `Total tickets available: ${totalCount}`);
        }

        // Add tickets from this page
        allTickets.push(...pageTickets);
        this.log('info', `Page ${currentPage}: Retrieved ${pageTickets.length} tickets (total: ${allTickets.length})`);

        // Check if we should continue pagination
        hasMorePages = this.hasMorePages(response);
        
        // Stop if we've hit maxRecords limit
        if (maxRecords && allTickets.length >= maxRecords) {
          allTickets = allTickets.slice(0, maxRecords);
          this.log('info', `Reached maxRecords limit of ${maxRecords}. Stopping extraction.`);
          hasMorePages = false;
          break;
        }

        // Stop if no more pages or empty response
        if (!hasMorePages || pageTickets.length === 0) {
          this.log('info', `No more pages available. Extraction complete.`);
          break;
        }

        currentPage++;

      } catch (error) {
        this.log('error', `Failed to extract tickets page ${currentPage}`, error);
        throw error;
      }
    }

    this.log('info', `Multi-page extraction completed: ${allTickets.length} tickets extracted`);

    // Step 2: Determine if we need detailed information
    const needsDetailExtraction = this.shouldExtractTicketDetails(options);
    
    if (needsDetailExtraction && allTickets.length > 0) {
      this.log('info', `Fetching detailed information for ${allTickets.length} tickets`);
      const detailedTickets = await this.fetchTicketDetails(allTickets, options);
      
      return {
        entityType: options.entityType,
        records: detailedTickets,
        totalCount: totalCount,
        hasMore: false, // We've extracted all available data
        extractionSummary: {
          pagesProcessed: currentPage - (options.cursor ? parseInt(options.cursor) : 1),
          recordsExtracted: allTickets.length,
          totalAvailable: totalCount,
          completionRate: totalCount > 0 ? (allTickets.length / totalCount) * 100 : 100,
          limitedByMaxRecords: maxRecords ? allTickets.length >= maxRecords : false
        }
      };
    }
    
    // Return list data only (basic extraction)
    return {
      entityType: options.entityType,
      records: allTickets,
      totalCount: totalCount,
      hasMore: false, // We've extracted all available data
      extractionSummary: {
        pagesProcessed: currentPage - (options.cursor ? parseInt(options.cursor) : 1),
        recordsExtracted: allTickets.length,
        totalAvailable: totalCount,
        completionRate: totalCount > 0 ? (allTickets.length / totalCount) * 100 : 100,
        limitedByMaxRecords: maxRecords ? allTickets.length >= maxRecords : false
      }
    };
  }

  /**
   * Determine if we should extract detailed ticket information
   */
  private shouldExtractTicketDetails(options: ExtractionOptions): boolean {
    // Extract details if explicitly requested
    if (options.includeDetails !== undefined) {
      return options.includeDetails;
    }
    
    // Default to extracting details for comprehensive data migration
    // This ensures we get descriptions, tags, attachments, and complete custom fields
    return true;
  }

  /**
   * Fetch detailed information for a list of tickets
   */
  private async fetchTicketDetails(ticketList: any[], options: ExtractionOptions): Promise<any[]> {
    const detailedTickets: any[] = [];
    const includeParams = this.getTicketDetailIncludes(options);
    
    this.log('info', `Starting sequential detail extraction for ${ticketList.length} tickets`);
    
    // Process tickets one by one to avoid rate limiting
    for (let i = 0; i < ticketList.length; i++) {
      const ticket = ticketList[i];
      const ticketNumber = i + 1;
      
      this.log('info', `Processing ticket ${ticketNumber}/${ticketList.length} (ID: ${ticket.id})`);
      
      try {
        const detailEndpoint = `/tickets/${ticket.id}${includeParams}`;
        const detailResponse = await this.makeRateLimitedRequest('get', detailEndpoint);
        
        // Merge list data with detailed data (detail data takes precedence)
        detailedTickets.push({
          ...ticket,
          ...detailResponse.data.ticket,
          _extraction_source: 'detail_api'
        });
        
      } catch (error: any) {
        this.log('warn', `Failed to fetch details for ticket ${ticket.id}: ${error.message}`);
        
        // Fallback to list data with missing fields marked
        detailedTickets.push({
          ...ticket,
          _extraction_source: 'list_api_fallback',
          _detail_extraction_failed: true,
          _detail_extraction_error: error.message
        });
      }
      
      // Add delay between requests to prevent rate limit spikes
      if (ticketNumber < ticketList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Increased to 1000ms for 60 req/min
      }
      
      // Log progress every 50 tickets
      if (ticketNumber % 50 === 0) {
        const successCount = detailedTickets.filter(t => t._extraction_source === 'detail_api').length;
        const successRate = ((successCount / ticketNumber) * 100).toFixed(1);
        this.log('info', `Progress: ${ticketNumber}/${ticketList.length} processed (${successRate}% success rate)`);
      }
    }
    
    const successCount = detailedTickets.filter(t => t._extraction_source === 'detail_api').length;
    const fallbackCount = detailedTickets.filter(t => t._extraction_source === 'list_api_fallback').length;
    const successRate = ((successCount / detailedTickets.length) * 100).toFixed(1);
    
    this.log('info', `Detail extraction completed: ${successCount} successful, ${fallbackCount} fallbacks (${successRate}% success rate)`);
    
    return detailedTickets;
  }

  /**
   * Get the include parameters for ticket detail API calls
   */
  private getTicketDetailIncludes(options: ExtractionOptions): string {
    const defaultIncludes = ['tags', 'requester', 'stats'];
    const customIncludes = options.ticketIncludes || [];
    const allIncludes = [...new Set([...defaultIncludes, ...customIncludes])];
    
    if (allIncludes.length > 0) {
      return `?include=${allIncludes.join(',')}`;
    }
    
    return '';
  }

  private async extractAssets(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/assets';
    const maxRecords = options.maxRecords;
    const batchSize = options.batchSize || 100;
    
    let allAssets: any[] = [];
    let currentPage = options.cursor ? parseInt(options.cursor) : 1;
    let totalCount = 0;
    let hasMorePages = true;

    this.log('info', 'Starting multi-page asset extraction from Freshservice');

    // Multi-page extraction loop
    while (hasMorePages) {
      const params: any = {
        per_page: batchSize,
        page: currentPage
      };

      if (options.startDate) {
        params.updated_since = options.startDate;
      }

      if (options.filters) {
        Object.assign(params, options.filters);
      }

      try {
        this.log('info', `Extracting asset page ${currentPage} (${allAssets.length} records so far)`);
        const response = await this.httpClient.get<FreshserviceAssetsResponse>(endpoint, { params });
        const pageAssets = response.data.assets || [];
        
        // Store total count from first page
        if (currentPage === 1) {
          totalCount = response.data.total || 0;
          this.log('info', `Total assets available: ${totalCount}`);
        }

        // Add assets from this page
        allAssets.push(...pageAssets);
        this.log('info', `Page ${currentPage}: Retrieved ${pageAssets.length} assets (total: ${allAssets.length})`);

        // Check if we should continue pagination
        hasMorePages = this.hasMorePages(response);
        
        // Stop if we've hit maxRecords limit
        if (maxRecords && allAssets.length >= maxRecords) {
          allAssets = allAssets.slice(0, maxRecords);
          this.log('info', `Reached maxRecords limit of ${maxRecords}. Stopping extraction.`);
          hasMorePages = false;
          break;
        }

        // Stop if no more pages or empty response
        if (!hasMorePages || pageAssets.length === 0) {
          this.log('info', `No more pages available. Extraction complete.`);
          break;
        }

        currentPage++;

      } catch (error) {
        this.log('error', `Failed to extract assets page ${currentPage}`, error);
        throw error;
      }
    }

    this.log('info', `Multi-page extraction completed: ${allAssets.length} assets extracted`);
    
    return {
      entityType: options.entityType,
      records: allAssets,
      totalCount: totalCount,
      hasMore: false, // We've extracted all available data
      extractionSummary: {
        pagesProcessed: currentPage - (options.cursor ? parseInt(options.cursor) : 1),
        recordsExtracted: allAssets.length,
        totalAvailable: totalCount,
        completionRate: totalCount > 0 ? (allAssets.length / totalCount) * 100 : 100,
        limitedByMaxRecords: maxRecords ? allAssets.length >= maxRecords : false
      }
    };
  }

  private async extractUsers(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/requesters';
    const maxRecords = options.maxRecords;
    const batchSize = options.batchSize || 100;
    
    let allUsers: any[] = [];
    let currentPage = options.cursor ? parseInt(options.cursor) : 1;
    let totalCount = 0;
    let hasMorePages = true;

    this.log('info', 'Starting multi-page user extraction from Freshservice');

    // Multi-page extraction loop
    while (hasMorePages) {
      const params: any = {
        per_page: batchSize,
        page: currentPage
      };

      if (options.startDate) {
        params.updated_since = options.startDate;
      }

      if (options.filters) {
        Object.assign(params, options.filters);
      }

      try {
        this.log('info', `Extracting user page ${currentPage} (${allUsers.length} records so far)`);
        const response = await this.httpClient.get<FreshserviceUsersResponse>(endpoint, { params });
        const pageUsers = response.data.requesters || [];
        
        // Store total count from first page
        if (currentPage === 1) {
          totalCount = response.data.total || 0;
          this.log('info', `Total users available: ${totalCount}`);
        }

        // Add users from this page
        allUsers.push(...pageUsers);
        this.log('info', `Page ${currentPage}: Retrieved ${pageUsers.length} users (total: ${allUsers.length})`);

        // Check if we should continue pagination
        hasMorePages = this.hasMorePages(response);
        
        // Stop if we've hit maxRecords limit
        if (maxRecords && allUsers.length >= maxRecords) {
          allUsers = allUsers.slice(0, maxRecords);
          this.log('info', `Reached maxRecords limit of ${maxRecords}. Stopping extraction.`);
          hasMorePages = false;
          break;
        }

        // Stop if no more pages or empty response
        if (!hasMorePages || pageUsers.length === 0) {
          this.log('info', `No more pages available. Extraction complete.`);
          break;
        }

        currentPage++;

      } catch (error) {
        this.log('error', `Failed to extract users page ${currentPage}`, error);
        throw error;
      }
    }

    this.log('info', `Multi-page extraction completed: ${allUsers.length} users extracted`);
    
    return {
      entityType: options.entityType,
      records: allUsers,
      totalCount: totalCount,
      hasMore: false, // We've extracted all available data
      extractionSummary: {
        pagesProcessed: currentPage - (options.cursor ? parseInt(options.cursor) : 1),
        recordsExtracted: allUsers.length,
        totalAvailable: totalCount,
        completionRate: totalCount > 0 ? (allUsers.length / totalCount) * 100 : 100,
        limitedByMaxRecords: maxRecords ? allUsers.length >= maxRecords : false
      }
    };
  }

  private async extractGroups(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/groups';
    const maxRecords = options.maxRecords;
    const batchSize = options.batchSize || 100;
    
    let allGroups: any[] = [];
    let currentPage = options.cursor ? parseInt(options.cursor) : 1;
    let totalCount = 0;
    let hasMorePages = true;

    this.log('info', 'Starting multi-page group extraction from Freshservice');

    // Multi-page extraction loop
    while (hasMorePages) {
      const params: any = {
        per_page: batchSize,
        page: currentPage
      };

      if (options.startDate) {
        params.updated_since = options.startDate;
      }

      if (options.filters) {
        Object.assign(params, options.filters);
      }

      try {
        this.log('info', `Extracting group page ${currentPage} (${allGroups.length} records so far)`);
        const response = await this.httpClient.get<FreshserviceGroupsResponse>(endpoint, { params });
        const pageGroups = response.data.groups || [];
        
        // Store total count from first page
        if (currentPage === 1) {
          totalCount = response.data.total || 0;
          this.log('info', `Total groups available: ${totalCount}`);
        }

        // Add groups from this page
        allGroups.push(...pageGroups);
        this.log('info', `Page ${currentPage}: Retrieved ${pageGroups.length} groups (total: ${allGroups.length})`);

        // Check if we should continue pagination
        hasMorePages = this.hasMorePages(response);
        
        // Stop if we've hit maxRecords limit
        if (maxRecords && allGroups.length >= maxRecords) {
          allGroups = allGroups.slice(0, maxRecords);
          this.log('info', `Reached maxRecords limit of ${maxRecords}. Stopping extraction.`);
          hasMorePages = false;
          break;
        }

        // Stop if no more pages or empty response
        if (!hasMorePages || pageGroups.length === 0) {
          this.log('info', `No more pages available. Extraction complete.`);
          break;
        }

        currentPage++;

      } catch (error) {
        this.log('error', `Failed to extract groups page ${currentPage}`, error);
        throw error;
      }
    }

    this.log('info', `Multi-page extraction completed: ${allGroups.length} groups extracted`);
    
    return {
      entityType: options.entityType,
      records: allGroups,
      totalCount: totalCount,
      hasMore: false, // We've extracted all available data
      extractionSummary: {
        pagesProcessed: currentPage - (options.cursor ? parseInt(options.cursor) : 1),
        recordsExtracted: allGroups.length,
        totalAvailable: totalCount,
        completionRate: totalCount > 0 ? (allGroups.length / totalCount) * 100 : 100,
        limitedByMaxRecords: maxRecords ? allGroups.length >= maxRecords : false
      }
    };
  }

  protected getDataArrayKey(entityType: string): string {
    const keyMap: Record<string, string> = {
      tickets: 'tickets',
      assets: 'assets',
      users: 'requesters',
      groups: 'groups'
    };
    return keyMap[entityType] || entityType;
  }

  protected extractTotalCount(response: any): number {
    return response.data?.total || 0;
  }

  protected hasMorePages(response: any): boolean {
    // Freshservice uses Link headers for pagination, not JSON response fields
    const linkHeader = response.headers?.link;
    
    if (!linkHeader) {
      this.log('info', 'No Link header found, assuming no more pages');
      return false;
    }
    
    // Check if Link header contains rel="next"
    const hasNext = linkHeader.includes('rel="next"');
    this.log('info', `Link header pagination check: ${hasNext ? 'more pages available' : 'last page reached'}`);
    
    return hasNext;
  }

  protected getNextCursor(response: any): string | undefined {
    const linkHeader = response.headers?.link;
    
    if (!linkHeader || !linkHeader.includes('rel="next"')) {
      return undefined;
    }
    
    // Parse page number from Link header
    // Example: <https://domain.freshservice.com/api/v2/tickets?page=4>; rel="next"
    const nextPageMatch = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="next"/);
    
    if (nextPageMatch && nextPageMatch[1]) {
      const nextPage = nextPageMatch[1];
      this.log('info', `Parsed next page from Link header: ${nextPage}`);
      return nextPage;
    }
    
    // Fallback: try to extract from any page parameter in the Link header
    const fallbackMatch = linkHeader.match(/page=(\d+)/);
    if (fallbackMatch && fallbackMatch[1]) {
      const nextPage = fallbackMatch[1];
      this.log('info', `Fallback: extracted page from Link header: ${nextPage}`);
      return nextPage;
    }
    
    this.log('warn', 'Could not parse page number from Link header', { linkHeader });
    return undefined;
  }

  public getSupportedEntities(): string[] {
    return ['tickets', 'assets', 'users', 'groups'];
  }

  public getEntitySchema(entityType: string): Record<string, any> {
    return FRESHSERVICE_SCHEMAS[entityType as keyof typeof FRESHSERVICE_SCHEMAS] || {};
  }

  public transformData(entityType: string, externalData: any[]): any[] {
    this.log('info', `Transforming ${externalData.length} ${entityType} records`);

    switch (entityType) {
      case EntityType.TICKETS:
        return this.transformTickets(externalData as FreshserviceTicket[]);
      case EntityType.ASSETS:
        return this.transformAssets(externalData as FreshserviceAsset[]);
      case EntityType.USERS:
        return this.transformUsers(externalData as FreshserviceUser[]);
      case EntityType.GROUPS:
        return this.transformGroups(externalData as FreshserviceGroup[]);
      default:
        return externalData;
    }
  }

  private transformTickets(tickets: FreshserviceTicket[]): any[] {
    // Return all fields as-is for each ticket, so CSV export includes everything
    return tickets.map(ticket => ({ ...ticket }));
  }

  private transformAssets(assets: FreshserviceAsset[]): any[] {
    return assets.map(asset => ({
      id: asset.id,
      external_id: asset.id.toString(),
      display_id: asset.display_id,
      name: asset.name,
      description: asset.description,
      asset_type_id: asset.asset_type_id,
      impact: asset.impact,
      usage_type: asset.usage_type,
      asset_tag: asset.asset_tag,
      user_id: asset.user_id,
      location_id: asset.location_id,
      department_id: asset.department_id,
      agent_id: asset.agent_id,
      group_id: asset.group_id,
      assigned_on: asset.assigned_on,
      created_at: asset.created_at,
      updated_at: asset.updated_at,
      type_fields: asset.type_fields,
      source_system: 'freshservice'
    }));
  }

  private transformUsers(users: FreshserviceUser[]): any[] {
    return users.map(user => ({
      id: user.id,
      external_id: user.id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      job_title: user.job_title,
      work_phone: user.work_phone_number,
      mobile_phone: user.mobile_phone_number,
      department_id: user.department_id,
      reporting_manager_id: user.reporting_manager_id,
      address: user.address,
      time_zone: user.time_zone,
      language: user.language,
      location_id: user.location_id,
      active: user.active,
      vip_user: user.vip_user,
      created_at: user.created_at,
      updated_at: user.updated_at,
      has_logged_in: user.has_logged_in,
      roles: user.roles,
      custom_fields: user.custom_fields,
      source_system: 'freshservice'
    }));
  }

  private transformGroups(groups: FreshserviceGroup[]): any[] {
    return groups.map(group => ({
      id: group.id,
      external_id: group.id.toString(),
      name: group.name,
      description: group.description,
      escalate_to: group.escalate_to,
      agent_ids: group.agent_ids,
      members: group.members,
      observers: group.observers,
      restricted: group.restricted,
      approval_required: group.approval_required,
      auto_ticket_assign: group.auto_ticket_assign,
      created_at: group.created_at,
      updated_at: group.updated_at,
      source_system: 'freshservice'
    }));
  }

  // NEW: Loading methods implementation (placeholder with simulation)
  public async loadData(options: LoadOptions, data: any[]): Promise<LoadResult> {
    if (!this.isAuthenticated) {
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Authentication failed');
      }
    }

    this.log('info', `Loading ${data.length} ${options.entityType} records`, { options });

    switch (options.entityType) {
      case EntityType.TICKETS:
        return this.loadTickets(options, data);
      case EntityType.ASSETS:
        return this.loadAssets(options, data);
      case EntityType.USERS:
        return this.loadUsers(options, data);
      case EntityType.GROUPS:
        return this.loadGroups(options, data);
      default:
        throw new Error(`Unsupported entity type for loading: ${options.entityType}`);
    }
  }

  private async loadTickets(options: LoadOptions, data: any[]): Promise<LoadResult> {
    this.log('info', `Loading ${data.length} tickets (PLACEHOLDER)`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + (data.length * 50)));
    
    // Validate data before loading
    const validationErrors = this.validateForLoad(options.entityType, data);
    if (validationErrors.length > 0 && !options.validateOnly) {
      this.log('warn', `Found ${validationErrors.length} validation errors in tickets`);
    }

    // Simulate 95% success rate
    const successCount = Math.floor(data.length * 0.95);
    const failureCount = data.length - successCount;
    
    const errors: LoadError[] = [];
    
    // Generate sample errors for failed records
    for (let i = 0; i < failureCount; i++) {
      errors.push({
        recordId: data[successCount + i]?.id?.toString(),
        externalId: data[successCount + i]?.external_id,
        error: 'Simulated loading failure - duplicate requester_id',
        field: 'requester_id'
      });
    }

    const result: LoadResult = {
      entityType: options.entityType,
      totalRecords: data.length,
      successCount,
      failureCount,
      errors,
      summary: {
        created: successCount,
        updated: 0,
        skipped: 0
      }
    };

    this.log('info', `Ticket loading completed: ${successCount}/${data.length} successful`);
    return result;
  }

  private async loadAssets(options: LoadOptions, data: any[]): Promise<LoadResult> {
    this.log('info', `Loading ${data.length} assets (PLACEHOLDER)`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800 + (data.length * 40)));
    
    // Validate data
    const validationErrors = this.validateForLoad(options.entityType, data);
    if (validationErrors.length > 0) {
      this.log('warn', `Found ${validationErrors.length} validation errors in assets`);
    }
    
    // Simulate 98% success rate for assets
    const successCount = Math.floor(data.length * 0.98);
    const failureCount = data.length - successCount;
    
    const errors: LoadError[] = [];
    for (let i = 0; i < failureCount; i++) {
      errors.push({
        recordId: data[successCount + i]?.id?.toString(),
        externalId: data[successCount + i]?.external_id,
        error: 'Invalid asset_type_id',
        field: 'asset_type_id'
      });
    }

    const result: LoadResult = {
      entityType: options.entityType,
      totalRecords: data.length,
      successCount,
      failureCount,
      errors,
      summary: {
        created: successCount,
        updated: 0,
        skipped: 0
      }
    };

    this.log('info', `Asset loading completed: ${successCount}/${data.length} successful`);
    return result;
  }

  private async loadUsers(options: LoadOptions, data: any[]): Promise<LoadResult> {
    this.log('info', `Loading ${data.length} users (PLACEHOLDER)`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 600 + (data.length * 30)));
    
    // Validate data
    const validationErrors = this.validateForLoad(options.entityType, data);
    if (validationErrors.length > 0) {
      this.log('warn', `Found ${validationErrors.length} validation errors in users`);
    }
    
    // Simulate 92% success rate for users (email conflicts)
    const successCount = Math.floor(data.length * 0.92);
    const failureCount = data.length - successCount;
    
    const errors: LoadError[] = [];
    for (let i = 0; i < failureCount; i++) {
      errors.push({
        recordId: data[successCount + i]?.id?.toString(),
        externalId: data[successCount + i]?.external_id,
        error: 'Email already exists in target system',
        field: 'email',
        value: data[successCount + i]?.email
      });
    }

    const result: LoadResult = {
      entityType: options.entityType,
      totalRecords: data.length,
      successCount,
      failureCount,
      errors,
      summary: {
        created: successCount,
        updated: 0,
        skipped: 0
      }
    };

    this.log('info', `User loading completed: ${successCount}/${data.length} successful`);
    return result;
  }

  private async loadGroups(options: LoadOptions, data: any[]): Promise<LoadResult> {
    this.log('info', `Loading ${data.length} groups (PLACEHOLDER)`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 400 + (data.length * 20)));
    
    // Validate data
    const validationErrors = this.validateForLoad(options.entityType, data);
    if (validationErrors.length > 0) {
      this.log('warn', `Found ${validationErrors.length} validation errors in groups`);
    }
    
    // Simulate 99% success rate for groups
    const successCount = Math.floor(data.length * 0.99);
    const failureCount = data.length - successCount;
    
    const errors: LoadError[] = [];
    for (let i = 0; i < failureCount; i++) {
      errors.push({
        recordId: data[successCount + i]?.id?.toString(),
        externalId: data[successCount + i]?.external_id,
        error: 'Group name already exists',
        field: 'name'
      });
    }

    const result: LoadResult = {
      entityType: options.entityType,
      totalRecords: data.length,
      successCount,
      failureCount,
      errors,
      summary: {
        created: successCount,
        updated: 0,
        skipped: 0
      }
    };

    this.log('info', `Group loading completed: ${successCount}/${data.length} successful`);
    return result;
  }

  // NEW: Get entity definition
  public getEntityDefinition(entityType: EntityType): EntityDefinition {
    const definition = FRESHSERVICE_ENTITY_DEFINITIONS[entityType];
    if (!definition) {
      throw new Error(`No entity definition found for type: ${entityType}`);
    }
    return definition;
  }

  // NEW: Transform for loading (internal to external format)
  public transformForLoad(entityType: string, internalData: any[]): any[] {
    this.log('info', `Transforming ${internalData.length} ${entityType} records for loading`);

    switch (entityType) {
      case EntityType.TICKETS:
        return this.transformTicketsForLoad(internalData);
      case EntityType.ASSETS:
        return this.transformAssetsForLoad(internalData);
      case EntityType.USERS:
        return this.transformUsersForLoad(internalData);
      case EntityType.GROUPS:
        return this.transformGroupsForLoad(internalData);
      default:
        return internalData;
    }
  }

  private transformTicketsForLoad(tickets: any[]): any[] {
    return tickets.map(ticket => ({
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      source: ticket.source || 2, // Default to Portal
      requester_id: ticket.requester_id,
      responder_id: ticket.responder_id,
      group_id: ticket.group_id,
      department_id: ticket.department_id,
      category: ticket.category,
      sub_category: ticket.sub_category,
      due_by: ticket.due_by,
      custom_fields: ticket.custom_fields || {},
      tags: ticket.tags || []
    }));
  }

  private transformAssetsForLoad(assets: any[]): any[] {
    return assets.map(asset => ({
      name: asset.name,
      description: asset.description,
      asset_type_id: asset.asset_type_id,
      impact: asset.impact,
      usage_type: asset.usage_type,
      asset_tag: asset.asset_tag,
      user_id: asset.user_id,
      location_id: asset.location_id,
      department_id: asset.department_id,
      agent_id: asset.agent_id,
      group_id: asset.group_id,
      type_fields: asset.type_fields || {}
    }));
  }

  private transformUsersForLoad(users: any[]): any[] {
    return users.map(user => ({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      job_title: user.job_title,
      work_phone_number: user.work_phone_number,
      mobile_phone_number: user.mobile_phone_number,
      department_id: user.department_id,
      reporting_manager_id: user.reporting_manager_id,
      address: user.address,
      time_zone: user.time_zone,
      language: user.language,
      location_id: user.location_id,
      active: user.active !== false, // Default to true
      vip_user: user.vip_user || false,
      custom_fields: user.custom_fields || {}
    }));
  }

  private transformGroupsForLoad(groups: any[]): any[] {
    return groups.map(group => ({
      name: group.name,
      description: group.description,
      escalate_to: group.escalate_to,
      agent_ids: group.agent_ids || [],
      restricted: group.restricted || false,
      approval_required: group.approval_required || false,
      auto_ticket_assign: group.auto_ticket_assign || false
    }));
  }

  // NEW: Validate data for loading
  public validateForLoad(entityType: string, data: any[]): LoadError[] {
    const definition = this.getEntityDefinition(entityType as EntityType);
    const errors: LoadError[] = [];

    data.forEach((record, index) => {
      // Check required fields
      for (const field of definition.loading.requiredFields) {
        if (record[field] === undefined || record[field] === null || record[field] === '') {
          errors.push({
            recordId: record.id?.toString() || index.toString(),
            externalId: record.external_id,
            error: `Missing required field: ${field}`,
            field
          });
        }
      }

      // Check validation rules
      if (definition.loading.validation) {
        for (const [field, rule] of Object.entries(definition.loading.validation)) {
          if (record[field] !== undefined) {
            const value = record[field];
            switch (rule.type) {
              case 'enum':
                if (!rule.value.includes(value)) {
                  errors.push({
                    recordId: record.id?.toString() || index.toString(),
                    externalId: record.external_id,
                    error: rule.message,
                    field,
                    value
                  });
                }
                break;
              case 'regex':
                if (!rule.value.test(value)) {
                  errors.push({
                    recordId: record.id?.toString() || index.toString(),
                    externalId: record.external_id,
                    error: rule.message,
                    field,
                    value
                  });
                }
                break;
            }
          }
        }
      }
    });

    return errors;
  }
} 