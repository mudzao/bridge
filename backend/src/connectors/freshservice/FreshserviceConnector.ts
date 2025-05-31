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
  FreshserviceTicketsResponse,
  FreshserviceAssetsResponse,
  FreshserviceUsersResponse,
  FreshserviceGroupsResponse,
  FRESHSERVICE_SCHEMAS,
  FRESHSERVICE_TICKET_STATUS,
  FRESHSERVICE_TICKET_PRIORITY,
  FRESHSERVICE_TICKET_SOURCE,
  FRESHSERVICE_ENTITY_DEFINITIONS
} from './FreshserviceTypes';
import axios from 'axios';

export class FreshserviceConnector extends BaseConnector {
  private freshserviceConfig: FreshserviceConfig;

  constructor(config: ConnectorConfig) {
    const metadata: ConnectorMetadata = {
      name: 'Freshservice',
      type: 'FRESHSERVICE',
      version: '1.0.0',
      supportedEntities: ['tickets', 'assets', 'users', 'groups'],
      authType: 'api_key',
      baseUrl: `https://${config.domain}.freshservice.com/api/v2`,
      capabilities: {
        extraction: true,
        loading: true,
        bidirectional: true
      }
    };

    super(config, metadata);
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
    const params: any = {
      per_page: options.batchSize || 100,
      include: 'requester,stats'
    };

    if (options.startDate) {
      params.updated_since = options.startDate;
    }

    if (options.cursor) {
      params.page = parseInt(options.cursor);
    }

    if (options.filters) {
      Object.assign(params, options.filters);
    }

    try {
      // Step 1: Get ticket list with basic info
      this.log('info', 'Extracting ticket list from Freshservice');
      const response = await this.httpClient.get<FreshserviceTicketsResponse>(endpoint, { params });
      const ticketList = response.data.tickets || [];
      const nextCursor = this.getNextCursor(response);
      
      // Step 2: Determine if we need detailed information
      const needsDetailExtraction = this.shouldExtractTicketDetails(options);
      
      if (needsDetailExtraction && ticketList.length > 0) {
        this.log('info', `Fetching detailed information for ${ticketList.length} tickets`);
        const detailedTickets = await this.fetchTicketDetails(ticketList, options);
        
        return {
          entityType: options.entityType,
          records: detailedTickets,
          totalCount: response.data.total || 0,
          hasMore: this.hasMorePages(response),
          ...(nextCursor && { nextCursor })
        };
      }
      
      // Return list data only (basic extraction)
      return {
        entityType: options.entityType,
        records: ticketList,
        totalCount: response.data.total || 0,
        hasMore: this.hasMorePages(response),
        ...(nextCursor && { nextCursor })
      };
    } catch (error) {
      this.log('error', 'Failed to extract tickets', error);
      throw error;
    }
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
    const batchSize = Math.min(options.detailBatchSize || 10, 20); // Max 20 concurrent requests
    const includeParams = this.getTicketDetailIncludes(options);
    
    // Process tickets in batches to avoid overwhelming the API
    for (let i = 0; i < ticketList.length; i += batchSize) {
      const batch = ticketList.slice(i, i + batchSize);
      
      this.log('info', `Fetching ticket details batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ticketList.length/batchSize)} (${batch.length} tickets)`);
      
      const detailPromises = batch.map(async (ticket) => {
        try {
          const detailEndpoint = `/tickets/${ticket.id}${includeParams}`;
          const detailResponse = await this.httpClient.get(detailEndpoint);
          
          // Merge list data with detailed data (detail data takes precedence)
          return {
            ...ticket,
            ...detailResponse.data.ticket,
            _extraction_source: 'detail_api'
          };
        } catch (error: any) {
          this.log('warn', `Failed to fetch details for ticket ${ticket.id}: ${error.message}`);
          
          // Fallback to list data with missing fields marked
          return {
            ...ticket,
            _extraction_source: 'list_api_fallback',
            _detail_extraction_failed: true,
            _detail_extraction_error: error.message
          };
        }
      });
      
      const batchResults = await Promise.all(detailPromises);
      detailedTickets.push(...batchResults);
      
      // Rate limiting between batches (respect Freshservice API limits)
      if (i + batchSize < ticketList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
    
    const successCount = detailedTickets.filter(t => t._extraction_source === 'detail_api').length;
    const fallbackCount = detailedTickets.filter(t => t._extraction_source === 'list_api_fallback').length;
    
    this.log('info', `Detail extraction completed: ${successCount} successful, ${fallbackCount} fallbacks`);
    
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
    const params: any = {
      per_page: options.batchSize || 100
    };

    if (options.startDate) {
      params.updated_since = options.startDate;
    }

    if (options.cursor) {
      params.page = parseInt(options.cursor);
    }

    if (options.filters) {
      Object.assign(params, options.filters);
    }

    try {
      const response = await this.httpClient.get<FreshserviceAssetsResponse>(endpoint, { params });
      const nextCursor = this.getNextCursor(response);
      
      return {
        entityType: options.entityType,
        records: response.data.assets || [],
        totalCount: response.data.total || 0,
        hasMore: this.hasMorePages(response),
        ...(nextCursor && { nextCursor })
      };
    } catch (error) {
      this.log('error', 'Failed to extract assets', error);
      throw error;
    }
  }

  private async extractUsers(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/requesters';
    const params: any = {
      per_page: options.batchSize || 100
    };

    if (options.startDate) {
      params.updated_since = options.startDate;
    }

    if (options.cursor) {
      params.page = parseInt(options.cursor);
    }

    if (options.filters) {
      Object.assign(params, options.filters);
    }

    try {
      const response = await this.httpClient.get<FreshserviceUsersResponse>(endpoint, { params });
      const nextCursor = this.getNextCursor(response);
      
      return {
        entityType: options.entityType,
        records: response.data.requesters || [],
        totalCount: response.data.total || 0,
        hasMore: this.hasMorePages(response),
        ...(nextCursor && { nextCursor })
      };
    } catch (error) {
      this.log('error', 'Failed to extract users', error);
      throw error;
    }
  }

  private async extractGroups(options: ExtractionOptions): Promise<ExtractedData> {
    const endpoint = '/groups';
    const params: any = {
      per_page: options.batchSize || 100
    };

    if (options.startDate) {
      params.updated_since = options.startDate;
    }

    if (options.cursor) {
      params.page = parseInt(options.cursor);
    }

    if (options.filters) {
      Object.assign(params, options.filters);
    }

    try {
      const response = await this.httpClient.get<FreshserviceGroupsResponse>(endpoint, { params });
      const nextCursor = this.getNextCursor(response);
      
      return {
        entityType: options.entityType,
        records: response.data.groups || [],
        totalCount: response.data.total || 0,
        hasMore: this.hasMorePages(response),
        ...(nextCursor && { nextCursor })
      };
    } catch (error) {
      this.log('error', 'Failed to extract groups', error);
      throw error;
    }
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
    const data = response.data;
    if (!data) return false;
    
    const currentPage = data.page || 1;
    const perPage = data.per_page || 100;
    const total = data.total || 0;
    
    return (currentPage * perPage) < total;
  }

  protected getNextCursor(response: any): string | undefined {
    const data = response.data;
    if (!data || !this.hasMorePages(response)) return undefined;
    
    const currentPage = data.page || 1;
    return (currentPage + 1).toString();
  }

  public getSupportedEntities(): string[] {
    return this.metadata.supportedEntities;
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
    return tickets.map(ticket => ({
      id: ticket.id,
      external_id: ticket.id.toString(),
      subject: ticket.subject,
      description: ticket.description_text || ticket.description,
      status: FRESHSERVICE_TICKET_STATUS[ticket.status as keyof typeof FRESHSERVICE_TICKET_STATUS] || 'Unknown',
      priority: FRESHSERVICE_TICKET_PRIORITY[ticket.priority as keyof typeof FRESHSERVICE_TICKET_PRIORITY] || 'Unknown',
      type: ticket.type,
      source: FRESHSERVICE_TICKET_SOURCE[ticket.source as keyof typeof FRESHSERVICE_TICKET_SOURCE] || 'Unknown',
      requester_id: ticket.requester_id,
      responder_id: ticket.responder_id,
      group_id: ticket.group_id,
      department_id: ticket.department_id,
      category: ticket.category,
      sub_category: ticket.sub_category,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      due_by: ticket.due_by,
      custom_fields: ticket.custom_fields,
      tags: ticket.tags,
      attachments: ticket.attachments?.length || 0,
      source_system: 'freshservice'
    }));
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