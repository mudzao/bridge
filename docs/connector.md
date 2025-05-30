# Project Bridge - Connector Architecture Guide

## 📋 Overview

This document provides a comprehensive guide for adding new connectors to Project Bridge. It explains the file structure, entity organization, and step-by-step process for implementing connectors for different helpdesk systems.

## 🏗️ Connector Architecture

Project Bridge uses an **abstract base class pattern** with a **factory method** for creating connector instances. This allows for consistent behavior across all connectors while maintaining flexibility for system-specific implementations.

### Core Components

- **BaseConnector**: Abstract base class with common functionality
- **ConnectorInterface**: TypeScript interface defining the contract
- **ConnectorFactory**: Factory pattern for dynamic connector creation
- **Connector Implementations**: System-specific implementations (Freshservice, ServiceNow, etc.)

## 📁 File Structure for New Connectors

### Existing Implementation Example (Freshservice)

Here's the actual file structure for the **Freshservice** connector (already implemented):

```
backend/src/connectors/
├── freshservice/                        # ✅ IMPLEMENTED: Freshservice connector
│   ├── FreshserviceConnector.ts        # ✅ Main implementation (448 lines)
│   └── FreshserviceTypes.ts            # ✅ Types & schemas (214 lines)
├── base/                                # ✅ EXISTS: Base classes
│   ├── ConnectorInterface.ts           # ✅ Core interface (89 lines)
│   ├── BaseConnector.ts                # ✅ Abstract base (167 lines)
│   └── ConnectorFactory.ts             # ✅ Factory with Freshservice case (53 lines)
└── index.ts                             # ✅ Exports Freshservice (11 lines)
```

### Required Files for New Connectors

For adding a new connector (e.g., **ServiceNow**):

```
backend/src/connectors/
├── servicenow/                          # 🆕 CREATE: New connector directory
│   ├── ServiceNowConnector.ts          # 🆕 CREATE: Main implementation
│   └── ServiceNowTypes.ts              # 🆕 CREATE: Types & schemas
├── base/                                # ✅ EXISTS: Base classes (no changes)
│   ├── ConnectorInterface.ts           
│   ├── BaseConnector.ts                
│   └── ConnectorFactory.ts             # 🔄 UPDATE: Add ServiceNow case
└── index.ts                             # 🔄 UPDATE: Export ServiceNow
```

### Summary of Changes

**To onboard any new connector:**

#### 🆕 **2 New Files:**
1. `{connector}/ConnectorName.ts` - Main implementation
2. `{connector}/ConnectorNameTypes.ts` - Types & schemas

#### 🔄 **2 Updated Files:**
1. `base/ConnectorFactory.ts` - Add new connector case
2. `index.ts` - Add new connector export

**Total: 2 new files + 2 updates = 4 file changes**

## 🗂️ Entity Type Organization

### Entity Types in FreshserviceTypes.ts (Real Implementation)

The actual Freshservice `Types.ts` file organizes entities as follows:

```
backend/src/connectors/freshservice/FreshserviceTypes.ts
├── Configuration
│   └── FreshserviceConfig interface
├── Entity Interfaces  
│   ├── FreshserviceTicket (tickets)
│   ├── FreshserviceAsset (assets)  
│   ├── FreshserviceUser (users)
│   ├── FreshserviceGroup (groups)
│   └── FreshserviceAttachment (attachments)
├── Response Wrappers
│   ├── FreshserviceTicketsResponse
│   ├── FreshserviceAssetsResponse
│   ├── FreshserviceUsersResponse
│   └── FreshserviceGroupsResponse
├── Constants & Mappings
│   ├── FRESHSERVICE_TICKET_STATUS
│   ├── FRESHSERVICE_TICKET_PRIORITY
│   └── FRESHSERVICE_TICKET_SOURCE
└── Validation Schemas
    ├── tickets: { field validation }
    ├── assets: { field validation }
    ├── users: { field validation }
    └── groups: { field validation }
```

### Entity Processing in FreshserviceConnector.ts (Real Implementation)

The actual Freshservice connector implementation organizes entity processing as follows:

```
backend/src/connectors/freshservice/FreshserviceConnector.ts
├── Configuration & Setup
│   ├── constructor() → Sets up metadata and HTTP client
│   ├── validateConfig() → Validates domain and apiKey
│   └── setupHttpClient() → Configures SSL/TLS and Basic auth
├── Connection Management
│   ├── testConnection() → Tests /agents/me endpoint
│   └── authenticate() → Verifies API credentials
├── Data Extraction (one method per entity)
│   ├── extractTickets() → /api/v2/tickets
│   ├── extractAssets() → /api/v2/assets
│   ├── extractUsers() → /api/v2/requesters
│   └── extractGroups() → /api/v2/groups
└── Data Transformation (one method per entity)
    ├── transformTickets() → Maps to internal ticket format
    ├── transformAssets() → Maps to internal asset format
    ├── transformUsers() → Maps to internal user format
    └── transformGroups() → Maps to internal group format
```

## 🎯 Entity Type Mapping

### Standard Entity Types

| **Entity Type** | **Extract Method** | **Transform Method** | **Types Interface** | **Common API Endpoint** |
|-----------------|-------------------|---------------------|--------------------|-----------------------|
| 🎫 **Tickets/Incidents** | `extractTickets()` | `transformTickets()` | `ConnectorNameTicket` | `/tickets` or `/incidents` |
| 🏢 **Assets** | `extractAssets()` | `transformAssets()` | `ConnectorNameAsset` | `/assets` |
| 👥 **Users** | `extractUsers()` | `transformUsers()` | `ConnectorNameUser` | `/users` or `/requesters` |
| 👥 **Groups** | `extractGroups()` | `transformGroups()` | `ConnectorNameGroup` | `/groups` |
| 🔧 **Change Requests** | `extractChangeRequests()` | `transformChangeRequests()` | `ConnectorNameChangeRequest` | `/change_requests` |
| 🐛 **Problems** | `extractProblems()` | `transformProblems()` | `ConnectorNameProblem` | `/problems` |

### System-Specific Examples

#### Freshservice (✅ Implemented)
| **Entity Type** | **Freshservice Endpoint** | **Extract Method** | **Transform Method** | **Interface** |
|-----------------|---------------------------|-------------------|---------------------|---------------|
| 🎫 **Tickets** | `/api/v2/tickets` | `extractTickets()` | `transformTickets()` | `FreshserviceTicket` |
| 🏢 **Assets** | `/api/v2/assets` | `extractAssets()` | `transformAssets()` | `FreshserviceAsset` |
| 👥 **Users** | `/api/v2/requesters` | `extractUsers()` | `transformUsers()` | `FreshserviceUser` |
| 👥 **Groups** | `/api/v2/groups` | `extractGroups()` | `transformGroups()` | `FreshserviceGroup` |

#### ServiceNow (Example)
| **Entity Type** | **ServiceNow Table** | **Extract Method** | **Transform Method** |
|-----------------|---------------------|-------------------|---------------------|
| 🎫 **Tickets** | `/table/incident` | `extractIncidents()` | `transformIncidents()` |
| 🏢 **Assets** | `/table/alm_asset` | `extractAssets()` | `transformAssets()` |
| 👥 **Users** | `/table/sys_user` | `extractUsers()` | `transformUsers()` |
| 🔧 **Change Requests** | `/table/change_request` | `extractChangeRequests()` | `transformChangeRequests()` |

#### Zendesk (Example)
| **Entity Type** | **Zendesk Endpoint** | **Extract Method** | **Transform Method** |
|-----------------|---------------------|-------------------|---------------------|
| 🎫 **Tickets** | `/api/v2/tickets` | `extractTickets()` | `transformTickets()` |
| 👥 **Users** | `/api/v2/users` | `extractUsers()` | `transformUsers()` |
| 👥 **Groups** | `/api/v2/groups` | `extractGroups()` | `transformGroups()` |

## 📋 Step-by-Step Connector Implementation

### Step 1: Create Directory Structure

```bash
mkdir backend/src/connectors/{connector_name}
```

### Step 2: Define Types ({ConnectorName}Types.ts)

**Reference**: `backend/src/connectors/freshservice/FreshserviceTypes.ts`

Create the types file with the following sections:

```typescript
// 1. Configuration Interface
export interface ConnectorNameConfig {
  domain: string;        // Required: connector domain
  apiKey: string;        // Required: API authentication key
  baseUrl?: string;      // Optional: computed base URL
}

// 2. Entity Interfaces (one per supported entity)
export interface ConnectorNameTicket {
  id: number;
  subject: string;
  description: string;
  status: number;
  priority: number;
  type: string;
  source: number;
  requester_id: number;
  responder_id: number | null;
  group_id: number | null;
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, any>;
  // ... other ticket fields
}

export interface ConnectorNameAsset {
  id: number;
  display_id: number;
  name: string;
  asset_type_id: number;
  impact: string;
  usage_type: string;
  user_id: number | null;
  created_at: string;
  updated_at: string;
  // ... other asset fields
}

export interface ConnectorNameUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  // ... other user fields
}

// 3. Response Wrappers
export interface ConnectorNameTicketsResponse {
  tickets: ConnectorNameTicket[];
  total?: number;
}

export interface ConnectorNameAssetsResponse {
  assets: ConnectorNameAsset[];
  total?: number;
}

export interface ConnectorNameUsersResponse {
  requesters: ConnectorNameUser[];
  total?: number;
}

// 4. Constants & Mappings
export const CONNECTOR_TICKET_STATUS = {
  1: 'Open',
  2: 'Pending',
  3: 'Resolved',
  4: 'Closed',
  5: 'Waiting on Customer',
  6: 'Waiting on Third Party'
} as const;

export const CONNECTOR_TICKET_PRIORITY = {
  1: 'Low',
  2: 'Medium', 
  3: 'High',
  4: 'Urgent'
} as const;

export const CONNECTOR_TICKET_SOURCE = {
  1: 'Email',
  2: 'Portal',
  3: 'Phone',
  4: 'Chat'
} as const;

// 5. Validation Schemas
export const CONNECTOR_SCHEMAS = {
  tickets: {
    id: 'number',
    subject: 'string',
    description: 'string',
    status: 'number',
    priority: 'number',
    type: 'string',
    created_at: 'string',
    updated_at: 'string'
  },
  assets: {
    id: 'number',
    display_id: 'number',
    name: 'string',
    asset_type_id: 'number',
    created_at: 'string',
    updated_at: 'string'
  },
  users: {
    id: 'number',
    first_name: 'string',
    last_name: 'string',
    email: 'string',
    active: 'boolean',
    created_at: 'string',
    updated_at: 'string'
  }
} as const;
```

### Step 3: Implement Connector ({ConnectorName}Connector.ts)

**Reference**: `backend/src/connectors/freshservice/FreshserviceConnector.ts`

Create the main connector implementation following the Freshservice pattern:

```typescript
import { InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import { BaseConnector } from '../base/BaseConnector';
import {
  ConnectorConfig,
  ConnectionTestResult,
  ExtractedData,
  ExtractionOptions,
  ConnectorMetadata,
  EntityType
} from '../base/ConnectorInterface';
import {
  ConnectorNameConfig,
  ConnectorNameTicket,
  ConnectorNameAsset,
  ConnectorNameUser,
  ConnectorNameTicketsResponse,
  ConnectorNameAssetsResponse,
  ConnectorNameUsersResponse,
  CONNECTOR_SCHEMAS,
  CONNECTOR_TICKET_STATUS,
  CONNECTOR_TICKET_PRIORITY,
  CONNECTOR_TICKET_SOURCE
} from './ConnectorNameTypes';
import axios from 'axios';

export class ConnectorNameConnector extends BaseConnector {
  private connectorConfig: ConnectorNameConfig;

  constructor(config: ConnectorConfig) {
    // 1. Define metadata (following Freshservice pattern)
    const metadata: ConnectorMetadata = {
      name: 'ConnectorName',
      type: 'CONNECTOR_NAME',
      version: '1.0.0',
      supportedEntities: ['tickets', 'assets', 'users', 'groups'],
      authType: 'api_key',
      baseUrl: `https://${config.domain}/api/v2`
    };

    super(config, metadata);
    this.connectorConfig = config as ConnectorNameConfig;
    this.validateConfig();
    this.setupHttpClient();
  }

  // 2. Configuration validation (following Freshservice pattern)
  protected override validateConfig(): void {
    super.validateConfig();
    
    if (!this.connectorConfig.domain) {
      throw new Error('Connector domain is required');
    }
    
    if (!this.connectorConfig.apiKey) {
      throw new Error('Connector API key is required');
    }
  }

  // 3. HTTP client setup (following Freshservice pattern)
  protected setupHttpClient(): void {
    this.httpClient = axios.create({
      baseURL: `https://${this.config.domain}/api/v2`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Project-Bridge/1.0',
      },
      // Add SSL configuration if needed
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: true,
        secureProtocol: 'TLSv1_2_method',
      }),
    });

    // Add auth headers (modify based on your auth method)
    this.httpClient.interceptors.request.use((config) => {
      const auth = Buffer.from(`${this.config.apiKey}:X`).toString('base64');
      config.headers.Authorization = `Basic ${auth}`;
      return config;
    });
  }

  // 4. Connection testing (following Freshservice pattern)
  public async testConnection(): Promise<ConnectionTestResult> {
    try {
      this.log('info', 'Testing connector connection');
      
      // Test connection with a simple endpoint
      const response = await this.httpClient.get('/agents/me');
      
      if (response.status === 200 && response.data) {
        this.isAuthenticated = true;
        this.log('info', 'Connector connection test successful');
        
        return {
          success: true,
          message: 'Successfully connected to connector',
          details: {
            domain: this.connectorConfig.domain,
            user: response.data.agent?.email || 'Unknown',
            apiVersion: 'v2'
          }
        };
      } else {
        throw new Error('Invalid response from connector API');
      }
    } catch (error: any) {
      this.log('error', 'Connector connection test failed', error);
      
      return {
        success: false,
        message: error.message || 'Failed to connect to connector',
        details: {
          domain: this.connectorConfig.domain,
          error: error.response?.data || error.message
        }
      };
    }
  }

  public async authenticate(): Promise<boolean> {
    const result = await this.testConnection();
    return result.success;
  }

  // 5. Data extraction methods (following Freshservice pattern)
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

    try {
      const response = await this.httpClient.get<ConnectorNameTicketsResponse>(endpoint, { params });
      const nextCursor = this.getNextCursor(response);
      
      return {
        entityType: options.entityType,
        records: response.data.tickets || [],
        totalCount: response.data.total || 0,
        hasMore: this.hasMorePages(response),
        ...(nextCursor && { nextCursor })
      };
    } catch (error) {
      this.log('error', 'Failed to extract tickets', error);
      throw error;
    }
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

    try {
      const response = await this.httpClient.get<ConnectorNameAssetsResponse>(endpoint, { params });
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

    try {
      const response = await this.httpClient.get<ConnectorNameUsersResponse>(endpoint, { params });
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

  // 6. Data transformation methods (following Freshservice pattern)
  public transformData(entityType: string, externalData: any[]): any[] {
    this.log('info', `Transforming ${externalData.length} ${entityType} records`);

    switch (entityType) {
      case EntityType.TICKETS:
        return this.transformTickets(externalData as ConnectorNameTicket[]);
      case EntityType.ASSETS:
        return this.transformAssets(externalData as ConnectorNameAsset[]);
      case EntityType.USERS:
        return this.transformUsers(externalData as ConnectorNameUser[]);
      default:
        return externalData;
    }
  }

  private transformTickets(tickets: ConnectorNameTicket[]): any[] {
    return tickets.map(ticket => ({
      id: ticket.id,
      external_id: ticket.id.toString(),
      subject: ticket.subject,
      description: ticket.description || '',
      status: CONNECTOR_TICKET_STATUS[ticket.status as keyof typeof CONNECTOR_TICKET_STATUS] || 'Unknown',
      priority: CONNECTOR_TICKET_PRIORITY[ticket.priority as keyof typeof CONNECTOR_TICKET_PRIORITY] || 'Unknown',
      type: ticket.type,
      source: CONNECTOR_TICKET_SOURCE[ticket.source as keyof typeof CONNECTOR_TICKET_SOURCE] || 'Unknown',
      requester_id: ticket.requester_id,
      responder_id: ticket.responder_id,
      group_id: ticket.group_id,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      custom_fields: ticket.custom_fields,
      source_system: 'connector_name'
    }));
  }

  private transformAssets(assets: ConnectorNameAsset[]): any[] {
    return assets.map(asset => ({
      id: asset.id,
      external_id: asset.id.toString(),
      display_id: asset.display_id,
      name: asset.name,
      asset_type_id: asset.asset_type_id,
      impact: asset.impact,
      usage_type: asset.usage_type,
      user_id: asset.user_id,
      created_at: asset.created_at,
      updated_at: asset.updated_at,
      source_system: 'connector_name'
    }));
  }

  private transformUsers(users: ConnectorNameUser[]): any[] {
    return users.map(user => ({
      id: user.id,
      external_id: user.id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      active: user.active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      source_system: 'connector_name'
    }));
  }

  // 7. Required abstract method implementations
  protected getDataArrayKey(entityType: string): string {
    const keyMap: Record<string, string> = {
      tickets: 'tickets',
      assets: 'assets',
      users: 'requesters',
      groups: 'groups'
    };
    return keyMap[entityType] || entityType;
  }

  public getSupportedEntities(): string[] {
    return this.metadata.supportedEntities;
  }

  public getEntitySchema(entityType: string): Record<string, any> {
    return CONNECTOR_SCHEMAS[entityType as keyof typeof CONNECTOR_SCHEMAS] || {};
  }
}
```

### Step 4: Update ConnectorFactory.ts

**Reference**: `backend/src/connectors/base/ConnectorFactory.ts` (lines 7-8, 21-22, 36-45)

Add the new connector to the factory following the Freshservice pattern:

```typescript
// Add import
import { ConnectorNameConnector } from '../connector_name/ConnectorNameConnector';

// Add to createConnector switch (after FRESHSERVICE case)
case 'CONNECTOR_NAME':
  return new ConnectorNameConnector(config);

// Add to getSupportedTypes
static getSupportedTypes(): string[] {
  return ['FRESHSERVICE', 'CONNECTOR_NAME']; // Add new connector
}

// Add to getConnectorMetadata (following Freshservice pattern)
case 'CONNECTOR_NAME':
  return {
    name: 'ConnectorName',
    type: 'CONNECTOR_NAME',
    authType: 'api_key',
    supportedEntities: ['tickets', 'assets', 'users'],
    configSchema: {
      domain: { type: 'string', required: true, description: 'Connector domain (e.g., company.connectorname.com)' },
      apiKey: { type: 'string', required: true, description: 'Connector API key' }
    }
  };
```

### Step 5: Update index.ts

**Reference**: `backend/src/connectors/index.ts` (line 7)

Add the export for the new connector:

```typescript
// Add export (following Freshservice pattern)
export * from './connector_name/ConnectorNameConnector';
```

## 🔧 Required Methods

Every connector must implement these key methods:

### Core Methods
- `validateConfig()` - Validate connector configuration
- `setupHttpClient()` - Configure HTTP client with authentication
- `testConnection()` - Test API connectivity
- `authenticate()` - Authenticate with the external system
- `extractData()` - Main data extraction router
- `transformData()` - Main data transformation router

### Entity-Specific Methods
- `extract{EntityType}()` - Extract specific entity type data
- `transform{EntityType}()` - Transform specific entity type data

### Utility Methods
- `getDataArrayKey()` - Return data array key for API responses
- `getSupportedEntities()` - Return list of supported entities
- `getEntitySchema()` - Return validation schema for entity type

## 🎯 Simple Rules

### 1 Entity Type = 1 Extract Method + 1 Transform Method + 1 Interface

- **Interface**: Define in `{ConnectorName}Types.ts`
- **Extract Method**: Implement in `{ConnectorName}Connector.ts`
- **Transform Method**: Implement in `{ConnectorName}Connector.ts`

### All Entity Info Goes in 2 Files

- **Types**: `{ConnectorName}Types.ts`
- **Implementation**: `{ConnectorName}Connector.ts`

### Each Entity Gets Its Own Section

- Organized by entity type within each file
- Consistent naming pattern across all connectors
- Clear separation of concerns

## 📊 Data Flow

```
1. External API → Extract Method → Raw Data
2. Raw Data → Transform Method → Standardized Data
3. Standardized Data → Project Bridge Internal Format
```

## 🛡️ Security Considerations

- **Credential Storage**: Use encrypted configuration storage
- **Authentication**: Implement proper authentication for each system
- **Rate Limiting**: Respect API rate limits for external systems
- **Error Handling**: Implement comprehensive error handling and logging

## 🔍 Testing

Each connector should include:

- **Connection Testing**: Verify API connectivity and authentication
- **Data Extraction Testing**: Test all supported entity types
- **Data Transformation Testing**: Verify data mapping accuracy
- **Error Handling Testing**: Test failure scenarios

## 📚 Examples

See existing implementations for reference:

- **Freshservice**: `backend/src/connectors/freshservice/` ✅ **IMPLEMENTED**
  - Full implementation with tickets, assets, users, and groups
  - API key authentication with SSL/TLS configuration
  - Comprehensive error handling and logging
  - Working connection testing with real API calls
  - Complete data extraction and transformation
  - **Reference files:**
    - `FreshserviceConnector.ts` (448 lines) - Main implementation
    - `FreshserviceTypes.ts` (214 lines) - Types and schemas

This architecture ensures **consistency**, **maintainability**, and **scalability** across all connector implementations in Project Bridge. 