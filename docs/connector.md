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

### Actual Implementation Example (Freshservice)

Here's the actual file structure for the **Freshservice** bidirectional connector:

```
backend/src/connectors/
├── freshservice/                        # ✅ IMPLEMENTED: Freshservice bidirectional connector
│   ├── FreshserviceConnector.ts        # ✅ Enhanced implementation (600+ lines)
│   └── FreshserviceTypes.ts            # ✅ Types, schemas & entity definitions (300+ lines)
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
│   └── ServiceNowTypes.ts              # 🆕 CREATE: Types, schemas & entity definitions
├── base/                                # ✅ EXISTS: Enhanced base classes (no changes)
│   ├── ConnectorInterface.ts           
│   ├── BaseConnector.ts                
│   └── ConnectorFactory.ts             # 🔄 UPDATE: Add ServiceNow case
└── index.ts                             # 🔄 UPDATE: Export ServiceNow
```

### Summary of Changes for Bidirectional Connectors

**To onboard any new bidirectional connector:**

#### 🆕 **2 New Files:**
1. `{connector}/ConnectorName.ts` - Enhanced implementation with extraction AND loading
2. `{connector}/ConnectorNameTypes.ts` - Types, schemas & entity definitions

#### 🔄 **2 Updated Files:**
1. `base/ConnectorFactory.ts` - Add new connector case
2. `index.ts` - Add new connector export

**Total: 2 new files + 2 updates = 4 file changes**

## 🗂️ Enhanced Entity Definition Architecture

### Entity Types in ConnectorInterface.ts

The actual implementation defines entity types in the base interface:

```typescript
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
```

### Entity Definitions in ConnectorNameTypes.ts

The actual implementation organizes entity definitions in the Types file:

```typescript
// Types & Interfaces
export interface ConnectorNameConfig {
  domain: string;
  apiKey: string;
  baseUrl?: string;
}

export interface ConnectorNameTicket {
  id: number;
  subject: string;
  description: string;
  status: number;
  priority: number;
  // ... other fields
}

// Entity Definitions
export const CONNECTOR_ENTITY_DEFINITIONS: Record<EntityType, EntityDefinition> = {
  [EntityType.TICKETS]: {
    name: 'Tickets',
  type: EntityType.TICKETS,
  
    // Extraction configuration
  extraction: {
    endpoint: '/api/v2/tickets',
    method: 'GET',
      detailEndpoint: '/api/v2/tickets/{id}',
      detailRequired: true,
    fields: {
        id: { type: 'number', required: true, readOnly: true },
      subject: { type: 'string', required: true },
        description: { type: 'string', required: false },
      status: { type: 'number', required: true },
      priority: { type: 'number', required: true },
        // ... other fields
    },
    pagination: {
        type: 'page',
        param: 'page'
    }
  },
  
    // Loading configuration
  loading: {
    endpoint: '/api/v2/tickets',
    method: 'POST',
    fields: {
      subject: { type: 'string', required: true },
        description: { type: 'string', required: false },
        status: { type: 'number', required: true },
        priority: { type: 'number', required: true },
        // ... other fields
      },
      requiredFields: ['subject', 'status', 'priority', 'requester_id'],
    validation: {
        status: {
          type: 'enum',
          value: [2, 3, 4, 5, 6],
          message: 'Invalid status value for ticket creation'
        },
        priority: {
          type: 'enum',
          value: [1, 2, 3, 4],
          message: 'Invalid priority value'
        }
      }
    }
  }
  // ... other entity definitions
  };
```

## 🔧 Enhanced Required Methods

Every bidirectional connector must implement these methods:

### Core Bidirectional Methods
- `extractData(options: ExtractionOptions): Promise<ExtractedData>` - Extract data FROM external system
- `loadData(options: LoadOptions, data: any[]): Promise<LoadResult>` - Load data TO external system
- `transformData(entityType: string, externalData: any[]): any[]` - Transform external data to internal format
- `transformForLoad(entityType: string, internalData: any[]): any[]` - Transform internal data for loading
- `getEntityDefinition(entityType: EntityType): EntityDefinition` - Get entity configuration

### Enhanced Utility Methods
- `getSupportedEntities(): string[]` - Return entities supporting extraction AND loading
- `getEntitySchema(entityType: string): Record<string, any>` - Return both extraction and loading schemas
- `getDataArrayKey(entityType: string): string` - Get the key for data array in API responses

### Connector Factory Implementation

The actual implementation in `ConnectorFactory.ts`:

```typescript
export class ConnectorFactory {
  static createConnector(type: string, config: ConnectorConfig): ConnectorInterface {
    switch (type.toUpperCase()) {
      case 'FRESHSERVICE':
        return new FreshserviceConnector(config);
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }

  static getSupportedTypes(): string[] {
    return ['FRESHSERVICE'];
  }

  static getConnectorMetadata(type: string): any {
    switch (type.toUpperCase()) {
      case 'FRESHSERVICE':
        return {
          name: 'Freshservice',
          type: 'FRESHSERVICE',
          authType: 'api_key',
          supportedEntities: ['tickets', 'assets', 'users', 'groups'],
          configSchema: {
            domain: { type: 'string', required: true, description: 'Freshservice domain' },
            apiKey: { type: 'string', required: true, description: 'Freshservice API key' }
          }
        };
      default:
        throw new Error(`Unsupported connector type: ${type}`);
    }
  }
}
```

## 🎯 Enhanced Data Flow

```
🔄 Bidirectional Data Flow:

📥 EXTRACTION:
1. External API → extractData() → Raw Data
2. Raw Data → transformData() → Standardized Data  
3. Standardized Data → Project Bridge Internal Format

📤 LOADING:
1. Project Bridge Internal Format → transformForLoad() → External Format
2. External Format → loadData() → External API
3. External API → LoadResult → Success/Failure Report

🔄 MIGRATION:
1. Source System → extractData() → transformData() → transformForLoad() → loadData() → Target System
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
Source Connector → extractData() → transformData() → Store

LOADING Job:
Retrieve → transformForLoad() → loadData() → Target Connector

MIGRATION Job:
Source Connector → extractData() → transformData() → transformForLoad() → loadData() → Target Connector
```

This enhanced bidirectional architecture provides **complete data migration capabilities** while maintaining **security**, **validation**, and **error handling** throughout the entire process. 