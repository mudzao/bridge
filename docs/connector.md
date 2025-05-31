# Project Bridge - Bidirectional Connector Architecture Guide

## 📋 Overview

This document provides a comprehensive guide for implementing **bidirectional connectors** in Project Bridge. The latest architecture supports both **data extraction FROM** and **data loading TO** external systems using a single connector configuration with separate extraction and loading entity definitions.

## 🔄 Bidirectional Connector Architecture

Project Bridge uses an **enhanced abstract base class pattern** with **bidirectional operations** for comprehensive data migration capabilities. This allows for extraction, transformation, validation, and loading operations through a unified connector interface.

### Core Components

- **BaseConnector**: Abstract base class with common functionality for both extraction and loading
- **ConnectorInterface**: Enhanced TypeScript interface supporting bidirectional operations
- **EntityDefinition**: Comprehensive entity specifications with separate extraction/loading configs
- **ConnectorFactory**: Factory pattern for dynamic connector creation
- **Connector Implementations**: System-specific implementations (Freshservice, ServiceNow, etc.)

### Bidirectional Operations

Each connector supports both:
- **🔽 Extraction Operations**: Extract data FROM external systems
- **🔼 Loading Operations**: Load data TO external systems
- **🔄 Migration Operations**: Complete end-to-end migration (extract → transform → load)

## 📁 Enhanced File Structure for Bidirectional Connectors

### Existing Implementation Example (Freshservice)

Here's the actual file structure for the **Freshservice** bidirectional connector:

```
backend/src/connectors/
├── freshservice/                        # ✅ IMPLEMENTED: Freshservice bidirectional connector
│   ├── FreshserviceConnector.ts        # ✅ Enhanced implementation (600+ lines)
│   ├── FreshserviceTypes.ts            # ✅ Types & schemas (300+ lines)
│   └── FreshserviceEntityDefinitions.ts # ✅ Bidirectional entity configs (400+ lines)
├── base/                                # ✅ EXISTS: Enhanced base classes
│   ├── ConnectorInterface.ts           # ✅ Bidirectional interface (150+ lines)
│   ├── BaseConnector.ts                # ✅ Enhanced abstract base (250+ lines)
│   └── ConnectorFactory.ts             # ✅ Factory with bidirectional support (80+ lines)
└── index.ts                             # ✅ Exports enhanced connectors (15+ lines)
```

### Required Files for New Bidirectional Connectors

For adding a new bidirectional connector (e.g., **ServiceNow**):

```
backend/src/connectors/
├── servicenow/                          # 🆕 CREATE: New bidirectional connector directory
│   ├── ServiceNowConnector.ts          # 🆕 CREATE: Enhanced implementation with loading
│   ├── ServiceNowTypes.ts              # 🆕 CREATE: Types & schemas
│   └── ServiceNowEntityDefinitions.ts  # 🆕 CREATE: Bidirectional entity configurations
├── base/                                # ✅ EXISTS: Enhanced base classes (no changes)
│   ├── ConnectorInterface.ts           
│   ├── BaseConnector.ts                
│   └── ConnectorFactory.ts             # 🔄 UPDATE: Add ServiceNow case
└── index.ts                             # 🔄 UPDATE: Export ServiceNow
```

### Summary of Changes for Bidirectional Connectors

**To onboard any new bidirectional connector:**

#### 🆕 **3 New Files:**
1. `{connector}/ConnectorName.ts` - Enhanced implementation with extraction AND loading
2. `{connector}/ConnectorNameTypes.ts` - Types & schemas
3. `{connector}/ConnectorNameEntityDefinitions.ts` - Bidirectional entity configurations

#### 🔄 **2 Updated Files:**
1. `base/ConnectorFactory.ts` - Add new connector case
2. `index.ts` - Add new connector export

**Total: 3 new files + 2 updates = 5 file changes**

## 🗂️ Enhanced Entity Definition Architecture

### Bidirectional Entity Definitions

Each entity now has separate configurations for extraction and loading operations:

```typescript
export interface EntityDefinition {
  name: string;
  type: EntityType;
  
  // 🔽 Extraction configuration
  extraction: {
    endpoint: string;        // GET /api/v2/tickets
    method: 'GET';
    fields: Record<string, FieldDefinition>;
    pagination?: PaginationConfig;
    include?: string[];      // Additional data to include
  };
  
  // 🔼 Loading configuration  
  loading: {
    endpoint: string;        // POST /api/v2/tickets
    method: 'POST' | 'PUT' | 'PATCH';
    fields: Record<string, FieldDefinition>;
    requiredFields: string[];
    validation?: Record<string, ValidationRule>;
    batchSize?: number;      // Maximum records per batch
    rateLimit?: number;      // Requests per minute
  };
}
```

### Field-Level Control

Enhanced field definitions with operation-specific controls:

```typescript
export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  readonly?: boolean;      // 🔒 Cannot be modified during loading
  createOnly?: boolean;    // ✏️ Only available during entity creation
  updateOnly?: boolean;    // 🔄 Only available during entity updates
  validation?: ValidationRule;
  mapping?: string;        // Field mapping for transformation
  defaultValue?: any;      // Default value for loading
}
```

### Field Access Patterns

| **Field Type** | **Extraction** | **Loading (Create)** | **Loading (Update)** | **Example Fields** |
|----------------|----------------|---------------------|---------------------|--------------------|
| **🔒 ReadOnly** | ✅ Extract | ❌ Skip | ❌ Skip | `id`, `created_at`, `updated_at` |
| **✏️ CreateOnly** | ✅ Extract | ✅ Include | ❌ Skip | `initial_status`, `creation_source` |
| **🔄 UpdateOnly** | ✅ Extract | ❌ Skip | ✅ Include | `resolution_notes`, `close_date` |
| **🔄 Bidirectional** | ✅ Extract | ✅ Include | ✅ Include | `subject`, `description`, `priority` |

## 🎯 Enhanced Entity Type Organization

### Entity Definitions in ConnectorNameEntityDefinitions.ts

The new architecture organizes entity definitions as follows:

```
backend/src/connectors/{connector}/ConnectorNameEntityDefinitions.ts
├── Entity Configurations
│   ├── TICKETS_ENTITY: EntityDefinition
│   ├── ASSETS_ENTITY: EntityDefinition
│   ├── USERS_ENTITY: EntityDefinition
│   └── GROUPS_ENTITY: EntityDefinition
├── Validation Rules
│   ├── ticketValidation: ValidationRule[]
│   ├── assetValidation: ValidationRule[]
│   └── userValidation: ValidationRule[]
└── Export
    └── CONNECTOR_ENTITY_DEFINITIONS: Record<string, EntityDefinition>
```

### Example Entity Definition (Tickets)

```typescript
export const TICKETS_ENTITY: EntityDefinition = {
  name: 'tickets',
  type: EntityType.TICKETS,
  
  // 🔽 Extraction Configuration
  extraction: {
    endpoint: '/api/v2/tickets',
    method: 'GET',
    fields: {
      id: { type: 'number', readonly: true },
      subject: { type: 'string', required: true },
      description: { type: 'string' },
      status: { type: 'number', required: true },
      priority: { type: 'number', required: true },
      type: { type: 'string', required: true },
      source: { type: 'number', createOnly: true },
      requester_id: { type: 'number', required: true },
      responder_id: { type: 'number' },
      group_id: { type: 'number' },
      created_at: { type: 'string', readonly: true },
      updated_at: { type: 'string', readonly: true },
      custom_fields: { type: 'object' }
    },
    pagination: {
      method: 'page',
      pageSize: 100,
      maxPages: 1000
    },
    include: ['requester', 'stats']
  },
  
  // 🔼 Loading Configuration
  loading: {
    endpoint: '/api/v2/tickets',
    method: 'POST',
    fields: {
      subject: { type: 'string', required: true },
      description: { type: 'string', defaultValue: '' },
      status: { type: 'number', required: true, defaultValue: 2 },
      priority: { type: 'number', required: true, defaultValue: 1 },
      type: { type: 'string', required: true, defaultValue: 'Incident' },
      source: { type: 'number', required: true, defaultValue: 2 },
      requester_id: { type: 'number', required: true },
      responder_id: { type: 'number' },
      group_id: { type: 'number' },
      custom_fields: { type: 'object', defaultValue: {} }
    },
    requiredFields: ['subject', 'status', 'priority', 'type', 'requester_id'],
    validation: {
      subject: { minLength: 1, maxLength: 255 },
      status: { enum: [1, 2, 3, 4, 5, 6] },
      priority: { enum: [1, 2, 3, 4] },
      email: { pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$' }
    },
    batchSize: 50,
    rateLimit: 100
  }
};
```

## 📋 Step-by-Step Bidirectional Connector Implementation

### Step 1: Create Enhanced Directory Structure

```bash
mkdir backend/src/connectors/{connector_name}
```

### Step 2: Define Types ({ConnectorName}Types.ts)

Enhanced types file with loading support:

```typescript
// 1. Enhanced Configuration Interface
export interface ConnectorNameConfig {
  domain: string;
  apiKey: string;
  baseUrl?: string;
  // Loading-specific config
  loadingEnabled?: boolean;
  batchSize?: number;
  rateLimit?: number;
}

// 2. Entity Interfaces (unchanged from extraction-only)
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
}

// 3. Loading-specific Interfaces
export interface LoadResult {
  success: boolean;
  entityType: string;
  processed: number;
  successful: number;
  failed: number;
  errors: LoadError[];
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
}

export interface LoadError {
  record: any;
  error: string;
  field?: string;
  code?: string;
}

// 4. Validation Rules
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: (string | number)[];
  min?: number;
  max?: number;
  custom?: (value: any) => boolean | string;
}

// 5. Response Wrappers (unchanged)
export interface ConnectorNameTicketsResponse {
  tickets: ConnectorNameTicket[];
  total?: number;
}

// 6. Constants & Mappings (unchanged)
export const CONNECTOR_TICKET_STATUS = {
  1: 'Open',
  2: 'Pending',
  3: 'Resolved',
  4: 'Closed',
  5: 'Waiting on Customer',
  6: 'Waiting on Third Party'
} as const;
```

### Step 3: Create Entity Definitions ({ConnectorName}EntityDefinitions.ts)

New file for bidirectional entity configurations:

```typescript
import { EntityDefinition, EntityType, FieldDefinition, ValidationRule } from '../base/ConnectorInterface';

// Tickets Entity Definition
export const TICKETS_ENTITY: EntityDefinition = {
  name: 'tickets',
  type: EntityType.TICKETS,
  
  extraction: {
    endpoint: '/api/v2/tickets',
    method: 'GET',
    fields: {
      id: { type: 'number', readonly: true },
      subject: { type: 'string', required: true },
      description: { type: 'string' },
      status: { type: 'number', required: true },
      priority: { type: 'number', required: true },
      type: { type: 'string', required: true },
      source: { type: 'number', createOnly: true },
      requester_id: { type: 'number', required: true },
      responder_id: { type: 'number' },
      group_id: { type: 'number' },
      created_at: { type: 'string', readonly: true },
      updated_at: { type: 'string', readonly: true },
      custom_fields: { type: 'object' }
    },
    pagination: {
      method: 'page',
      pageSize: 100
    }
  },
  
  loading: {
    endpoint: '/api/v2/tickets',
    method: 'POST',
    fields: {
      subject: { type: 'string', required: true },
      description: { type: 'string', defaultValue: '' },
      status: { type: 'number', required: true, defaultValue: 2 },
      priority: { type: 'number', required: true, defaultValue: 1 },
      type: { type: 'string', required: true, defaultValue: 'Incident' },
      source: { type: 'number', required: true, defaultValue: 2 },
      requester_id: { type: 'number', required: true },
      responder_id: { type: 'number' },
      group_id: { type: 'number' },
      custom_fields: { type: 'object', defaultValue: {} }
    },
    requiredFields: ['subject', 'status', 'priority', 'type', 'requester_id'],
    validation: {
      subject: { minLength: 1, maxLength: 255 },
      status: { enum: [1, 2, 3, 4, 5, 6] },
      priority: { enum: [1, 2, 3, 4] }
    },
    batchSize: 50,
    rateLimit: 100
  }
};

// Assets Entity Definition
export const ASSETS_ENTITY: EntityDefinition = {
  name: 'assets',
  type: EntityType.ASSETS,
  
  extraction: {
    endpoint: '/api/v2/assets',
    method: 'GET',
    fields: {
      id: { type: 'number', readonly: true },
      display_id: { type: 'number', readonly: true },
      name: { type: 'string', required: true },
      asset_type_id: { type: 'number', required: true },
      impact: { type: 'string' },
      usage_type: { type: 'string' },
      user_id: { type: 'number' },
      created_at: { type: 'string', readonly: true },
      updated_at: { type: 'string', readonly: true }
    }
  },
  
  loading: {
    endpoint: '/api/v2/assets',
    method: 'POST',
    fields: {
      name: { type: 'string', required: true },
      asset_type_id: { type: 'number', required: true },
      impact: { type: 'string', defaultValue: 'Low' },
      usage_type: { type: 'string', defaultValue: 'Loaner' },
      user_id: { type: 'number' }
    },
    requiredFields: ['name', 'asset_type_id'],
    validation: {
      name: { minLength: 1, maxLength: 255 },
      impact: { enum: ['Low', 'Medium', 'High'] }
    },
    batchSize: 100,
    rateLimit: 200
  }
};

// Users Entity Definition
export const USERS_ENTITY: EntityDefinition = {
  name: 'users',
  type: EntityType.USERS,
  
  extraction: {
    endpoint: '/api/v2/requesters',
    method: 'GET',
    fields: {
      id: { type: 'number', readonly: true },
      first_name: { type: 'string', required: true },
      last_name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      active: { type: 'boolean', required: true },
      created_at: { type: 'string', readonly: true },
      updated_at: { type: 'string', readonly: true }
    }
  },
  
  loading: {
    endpoint: '/api/v2/requesters',
    method: 'POST',
    fields: {
      first_name: { type: 'string', required: true },
      last_name: { type: 'string', required: true },
      email: { type: 'string', required: true },
      active: { type: 'boolean', defaultValue: true }
    },
    requiredFields: ['first_name', 'last_name', 'email'],
    validation: {
      first_name: { minLength: 1, maxLength: 100 },
      last_name: { minLength: 1, maxLength: 100 },
      email: { pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$' }
    },
    batchSize: 25,
    rateLimit: 50
  }
};

// Export all entity definitions
export const CONNECTOR_ENTITY_DEFINITIONS: Record<string, EntityDefinition> = {
  tickets: TICKETS_ENTITY,
  assets: ASSETS_ENTITY,
  users: USERS_ENTITY
};
```

### Step 4: Implement Enhanced Connector ({ConnectorName}Connector.ts)

Enhanced connector implementation with bidirectional support:

```typescript
import { BaseConnector } from '../base/BaseConnector';
import {
  ConnectorConfig,
  ConnectionTestResult,
  ExtractedData,
  ExtractionOptions,
  ConnectorMetadata,
  EntityType,
  EntityDefinition,
  LoadResult,
  LoadOptions
} from '../base/ConnectorInterface';
import {
  ConnectorNameConfig,
  ConnectorNameTicket,
  LoadError,
  CONNECTOR_TICKET_STATUS
} from './ConnectorNameTypes';
import { CONNECTOR_ENTITY_DEFINITIONS } from './ConnectorNameEntityDefinitions';

export class ConnectorNameConnector extends BaseConnector {
  private connectorConfig: ConnectorNameConfig;

  constructor(config: ConnectorConfig) {
    const metadata: ConnectorMetadata = {
      name: 'ConnectorName',
      type: 'CONNECTOR_NAME',
      version: '2.0.0', // Updated for bidirectional support
      supportedEntities: ['tickets', 'assets', 'users'],
      authType: 'api_key',
      baseUrl: `https://${config.domain}/api/v2`,
      capabilities: ['extraction', 'loading', 'bidirectional'] // New capabilities
    };

    super(config, metadata);
    this.connectorConfig = config as ConnectorNameConfig;
    this.validateConfig();
    this.setupHttpClient();
  }

  // Enhanced validation with loading support
  protected override validateConfig(): void {
    super.validateConfig();
    
    if (!this.connectorConfig.domain) {
      throw new Error('Connector domain is required');
    }
    
    if (!this.connectorConfig.apiKey) {
      throw new Error('Connector API key is required');
    }

    // Validate loading-specific config
    if (this.connectorConfig.loadingEnabled) {
      if (this.connectorConfig.batchSize && this.connectorConfig.batchSize > 100) {
        throw new Error('Maximum batch size is 100 for loading operations');
      }
      
      if (this.connectorConfig.rateLimit && this.connectorConfig.rateLimit > 500) {
        throw new Error('Maximum rate limit is 500 requests per minute');
      }
    }
  }

  // Existing extraction methods (unchanged)
  public async extractData(options: ExtractionOptions): Promise<ExtractedData> {
    // Implementation same as before
    // ... existing extraction logic
  }

  // 🆕 NEW: Loading Operations
  public async loadData(entityType: string, data: any[], options?: LoadOptions): Promise<LoadResult> {
    if (!this.isAuthenticated) {
      const authResult = await this.authenticate();
      if (!authResult) {
        throw new Error('Authentication failed for loading operation');
      }
    }

    this.log('info', `Loading ${data.length} ${entityType} records`, { entityType, count: data.length });

    // Get entity definition for loading configuration
    const entityDef = this.getEntityDefinition(entityType);
    if (!entityDef) {
      throw new Error(`Entity definition not found for ${entityType}`);
    }

    // Validate data before loading
    const validationResult = await this.validateForLoad(entityType, data);
    if (!validationResult.valid) {
      throw new Error(`Data validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Transform data for loading
    const transformedData = await this.transformForLoad(entityType, data);

    // Perform actual loading
    return await this.performLoad(entityType, transformedData, entityDef, options);
  }

  // 🆕 NEW: Data validation for loading
  public async validateForLoad(entityType: string, data: any[]): Promise<{ valid: boolean; errors: string[] }> {
    const entityDef = this.getEntityDefinition(entityType);
    if (!entityDef) {
      return { valid: false, errors: [`Entity definition not found for ${entityType}`] };
    }

    const errors: string[] = [];
    const loadingConfig = entityDef.loading;

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      // Check required fields
      for (const field of loadingConfig.requiredFields) {
        if (!record[field] && record[field] !== 0 && record[field] !== false) {
          errors.push(`Record ${i}: Missing required field '${field}'`);
        }
      }

      // Validate field rules
      if (loadingConfig.validation) {
        for (const [field, rule] of Object.entries(loadingConfig.validation)) {
          const value = record[field];
          
          if (value !== undefined && value !== null) {
            if (rule.pattern && typeof value === 'string') {
              const regex = new RegExp(rule.pattern);
              if (!regex.test(value)) {
                errors.push(`Record ${i}: Field '${field}' does not match required pattern`);
              }
            }
            
            if (rule.enum && !rule.enum.includes(value)) {
              errors.push(`Record ${i}: Field '${field}' must be one of: ${rule.enum.join(', ')}`);
            }
            
            if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
              errors.push(`Record ${i}: Field '${field}' must be at least ${rule.minLength} characters`);
            }
            
            if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
              errors.push(`Record ${i}: Field '${field}' must be no more than ${rule.maxLength} characters`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // 🆕 NEW: Transform data for loading
  public async transformForLoad(entityType: string, data: any[]): Promise<any[]> {
    const entityDef = this.getEntityDefinition(entityType);
    if (!entityDef) {
      throw new Error(`Entity definition not found for ${entityType}`);
    }

    return data.map(record => {
      const transformed: any = {};
      const loadingFields = entityDef.loading.fields;

      // Process each field according to loading configuration
      for (const [fieldName, fieldDef] of Object.entries(loadingFields)) {
        // Skip readonly fields for loading
        if (fieldDef.readonly) {
          continue;
        }

        // Use provided value or default value
        if (record[fieldName] !== undefined) {
          transformed[fieldName] = record[fieldName];
        } else if (fieldDef.defaultValue !== undefined) {
          transformed[fieldName] = fieldDef.defaultValue;
        }
      }

      return transformed;
    });
  }

  // 🆕 NEW: Perform actual loading operation
  private async performLoad(
    entityType: string, 
    data: any[], 
    entityDef: EntityDefinition, 
    options?: LoadOptions
  ): Promise<LoadResult> {
    const result: LoadResult = {
      success: true,
      entityType,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      summary: { created: 0, updated: 0, skipped: 0 }
    };

    const batchSize = entityDef.loading.batchSize || 50;
    const endpoint = entityDef.loading.endpoint;

    // Process in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        // Simulate loading operation (replace with actual API calls in real implementation)
        await this.simulateLoading(entityType, batch, result);
        
        result.processed += batch.length;
        
        // Apply rate limiting if configured
        if (entityDef.loading.rateLimit) {
          const delay = (60 * 1000) / entityDef.loading.rateLimit;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error: any) {
        this.log('error', `Failed to load batch for ${entityType}`, error);
        
        // Mark entire batch as failed
        for (const record of batch) {
          result.errors.push({
            record,
            error: error.message || 'Batch loading failed'
          });
          result.failed++;
        }
        result.processed += batch.length;
      }
    }

    result.success = result.failed === 0;
    this.log('info', `Loading completed for ${entityType}`, {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed
    });

    return result;
  }

  // 🆕 NEW: Simulate loading (replace with real API calls)
  private async simulateLoading(entityType: string, batch: any[], result: LoadResult): Promise<void> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100 * batch.length));

    // Simulate success rates based on entity type
    const successRates = {
      tickets: 0.95,
      assets: 0.98,
      users: 0.92,
      groups: 0.99
    };

    const successRate = successRates[entityType as keyof typeof successRates] || 0.95;

    for (const record of batch) {
      if (Math.random() < successRate) {
        result.successful++;
        result.summary.created++; // In real implementation, determine if created or updated
      } else {
        result.failed++;
        result.errors.push({
          record,
          error: `Simulated ${entityType} loading failure`,
          code: 'SIMULATION_ERROR'
        });
      }
    }
  }

  // 🆕 NEW: Get entity definition
  public getEntityDefinition(entityType: string): EntityDefinition | null {
    return CONNECTOR_ENTITY_DEFINITIONS[entityType] || null;
  }

  // Enhanced supported entities with loading info
  public getSupportedEntities(): string[] {
    return Object.keys(CONNECTOR_ENTITY_DEFINITIONS);
  }

  // Enhanced entity schema including loading fields
  public getEntitySchema(entityType: string): Record<string, any> {
    const entityDef = this.getEntityDefinition(entityType);
    if (!entityDef) return {};

    return {
      extraction: entityDef.extraction.fields,
      loading: entityDef.loading.fields,
      requiredForLoading: entityDef.loading.requiredFields,
      validation: entityDef.loading.validation || {}
    };
  }

  // Existing methods (unchanged)
  public async testConnection(): Promise<ConnectionTestResult> {
    // Implementation same as before
  }

  protected getDataArrayKey(entityType: string): string {
    // Implementation same as before
  }
}
```

### Step 5: Update Enhanced ConnectorFactory.ts

```typescript
// Add import for entity definitions
import { CONNECTOR_ENTITY_DEFINITIONS } from '../connector_name/ConnectorNameEntityDefinitions';

// Add to createConnector switch
case 'CONNECTOR_NAME':
  return new ConnectorNameConnector(config);

// Enhanced metadata with bidirectional support
case 'CONNECTOR_NAME':
  return {
    name: 'ConnectorName',
    type: 'CONNECTOR_NAME',
    authType: 'api_key',
    supportedEntities: Object.keys(CONNECTOR_ENTITY_DEFINITIONS),
    capabilities: ['extraction', 'loading', 'bidirectional'],
    configSchema: {
      domain: { type: 'string', required: true, description: 'Connector domain' },
      apiKey: { type: 'string', required: true, description: 'Connector API key' },
      loadingEnabled: { type: 'boolean', required: false, description: 'Enable loading operations' },
      batchSize: { type: 'number', required: false, description: 'Batch size for loading (max 100)' },
      rateLimit: { type: 'number', required: false, description: 'Rate limit for loading (max 500/min)' }
    }
  };
```

## 🔧 Enhanced Required Methods

Every bidirectional connector must implement these methods:

### Core Bidirectional Methods
- `extractData()` - Extract data FROM external system (existing)
- `loadData()` - **🆕 NEW** Load data TO external system
- `validateForLoad()` - **🆕 NEW** Validate data before loading
- `transformForLoad()` - **🆕 NEW** Transform data for loading operation
- `getEntityDefinition()` - **🆕 NEW** Get entity configuration

### Enhanced Utility Methods
- `getSupportedEntities()` - Return entities supporting extraction AND loading
- `getEntitySchema()` - Return both extraction and loading schemas

## 🎯 Enhanced Data Flow

```
🔄 Bidirectional Data Flow:

📥 EXTRACTION:
1. External API → Extract Method → Raw Data
2. Raw Data → Transform Method → Standardized Data  
3. Standardized Data → Project Bridge Internal Format

📤 LOADING:
1. Project Bridge Internal Format → Transform for Load → External Format
2. External Format → Validate for Load → Validated Data
3. Validated Data → Load Method → External API
4. External API → Load Result → Success/Failure Report

🔄 MIGRATION:
1. Source System → Extract → Transform → Validate → Load → Target System
```

## 🛡️ Enhanced Security & Validation

### Loading Operation Security
- **Credential Validation**: Verify write permissions before loading
- **Data Validation**: Comprehensive field-level validation
- **Rate Limiting**: Respect API rate limits for loading operations
- **Batch Processing**: Controlled batch sizes to prevent system overload
- **Error Recovery**: Graceful handling of partial failures

### Field-Level Security
- **ReadOnly Protection**: Prevent modification of system-managed fields
- **Required Field Validation**: Ensure all required fields are present
- **Data Type Validation**: Enforce proper data types for all fields
- **Business Rule Validation**: Apply business-specific validation rules

## 📊 Job Type Integration

### Enhanced Job Types
- **EXTRACTION**: Extract data only (source system → internal storage)
- **LOADING**: Load data only (internal storage → target system)  
- **MIGRATION**: Complete bidirectional migration (source → transform → target)

### Job Processing Flow
```
EXTRACTION Job:
Source Connector → Extract → Transform → Store

LOADING Job:
Retrieve → Validate → Transform for Load → Target Connector → Load

MIGRATION Job:
Source Connector → Extract → Transform → Validate → Target Connector → Load
```

This enhanced bidirectional architecture provides **complete data migration capabilities** while maintaining **security**, **validation**, and **error handling** throughout the entire process. 