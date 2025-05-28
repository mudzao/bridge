# Project Bridge Backend Architecture

## Technology Stack

### Core Technologies
- **Runtime**: Node.js (TypeScript)
- **API Framework**: Fastify
- **Job Queue**: BullMQ + Redis
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt

### Stack Architecture

#### Consistent Architecture Across Environments
**BullMQ + Redis used in all environments** (POC, Development, Production) for:
- **Job Persistence**: Survives server restarts
- **Error Handling**: Built-in retry logic and exponential backoff
- **Debugging**: Bull Board dashboard for job inspection
- **Reliability**: No job loss, consistent behavior
- **Scalability**: Same patterns from development to production

#### Production Infrastructure
```
Load Balancer
├── API Server Instances (Fastify)
│   ├── Authentication & Authorization
│   ├── Job Management APIs
│   ├── Real-time Progress (SSE)
│   └── Bull Board Dashboard
├── Worker Server Instances (Node.js)
│   ├── Migration Workers
│   ├── Discovery Workers
│   └── Validation Workers
├── Redis Cluster
│   ├── BullMQ Job Queues
│   ├── Progress Pub/Sub
│   └── Rate Limiting Counters
└── PostgreSQL Cluster
    ├── Primary (Read/Write)
    ├── Replica (Read-only)
    └── Backup Storage
```

#### Development Stack
```
Single Server Development:
├── API Server (Fastify) - Port 3000
├── Worker Processes (3-4 instances)
├── Redis (Single Instance) - Port 6379
├── PostgreSQL (Single Instance) - Port 5432
└── Bull Board Dashboard - /admin/queues
```

#### Container Architecture
```
Docker Compose Services:
├── api-server (Fastify + Bull Board)
├── worker (Same codebase, worker entry point)
├── redis (Redis 7 Alpine)
├── postgres (PostgreSQL 15)
└── nginx (Load Balancer + SSL Termination)
```

### Monitoring & Operations

#### Bull Board Dashboard
- **Queue Monitoring**: Real-time job status across all queues
- **Job Management**: Retry failed jobs, inspect payloads
- **Performance Metrics**: Processing rates, failure rates
- **Authentication**: Secured admin access
- **Multi-Queue Support**: Migration, progress, cleanup queues

#### Application Monitoring
- **Logs**: Structured JSON logging (Winston/Pino)
- **Metrics**: Prometheus metrics collection
- **Health Checks**: API and worker health endpoints
- **Alerts**: Job failure and queue backup notifications

## Architecture Layers

### 1. API Layer (Fastify)
- HTTP request handling
- Authentication & authorization
- Job creation and status endpoints
- Real-time progress via Server-Sent Events
- Multi-tenant routing

#### Frontend-Backend Communication
**REST APIs** for standard operations:
- Job management: `POST /api/migrations`, `GET /api/migrations/{id}`
- Connector management: `GET /api/connectors`, `POST /api/connectors/test`
- Authentication: `POST /api/login`, `GET /api/profile`
- All requests use JSON format with JWT authentication

**Server-Sent Events (SSE)** for real-time updates:
- Progress streaming: `GET /api/jobs/{id}/progress-stream`
- Long-lived connection for job progress updates
- Backend publishes BullMQ/Redis progress events to SSE stream
- Frontend receives real-time updates without polling
- Connection closes on job completion

### 2. Job Queue Layer (BullMQ + Redis)
- Job scheduling and distribution
- Worker coordination
- Progress state management
- Retry logic and error handling
- Job prioritization by tenant tier

### 3. Worker Layer (Separate Node.js Processes)
- Execute migration jobs
- Manage connector lifecycle
- Handle rate limiting per source/destination
- Progress reporting
- Error recovery

## Connector Architecture

### Hierarchy Structure

#### Source Level (Parent)
```
AbstractSource
├── SourceFreshService
├── SourceServiceNow  
├── SourceZendesk
└── [Additional Sources]
```

**Responsibilities:**
- Authentication management
- Base URL configuration
- Connection testing
- Stream registration
- Rate limiting coordination

#### Stream Level (Child)
```
HttpStream (Abstract)
├── TicketsStream (requires detail calls)
├── AssetsStream (single API call)
├── UsersStream (single API call)
├── IncidentsStream (requires detail calls)
└── [Additional Streams]
```

**Responsibilities:**
- API endpoint handling (single or multiple calls)
- Data schema validation
- Sync mode implementation (full/incremental)
- Pagination logic
- Field transformation
- Detail enrichment logic (when required)

#### Schema Level
- JSON Schema files per stream (defines expected output format)
- Runtime field discovery
- Dynamic schema evolution

### Stream Implementation Patterns

#### Pattern 1: Single API Call Streams
Streams where list endpoint provides complete data:
- **AssetsStream**: `/api/v2/assets` returns complete asset objects
- **UsersStream**: `/api/v2/requesters` returns complete user objects
- **GroupsStream**: `/api/v2/groups` returns complete group objects

#### Pattern 2: List + Detail Call Streams  
Streams requiring additional detail calls for complete data:
- **TicketsStream**: `/api/v2/tickets` (list) + `/api/v2/tickets/{id}` (details)
- **IncidentsStream**: `/api/v2/incidents` (list) + `/api/v2/incidents/{id}` (details)
- **ProblemsStream**: `/api/v2/problems` (list) + `/api/v2/problems/{id}` (details)

### Stream Class Implementation Examples

#### TicketsStream (List + Detail Pattern)
```typescript
class TicketsStream extends HttpStream {
  name = 'tickets';
  primary_key = ['id'];
  
  async *readRecords() {
    // Step 1: Get paginated ticket list
    for await (const page of this.getPaginatedData('/api/v2/tickets')) {
      // Step 2: For each basic ticket, get complete details
      for (const basicTicket of page.tickets) {
        const completeTicket = await this.makeDetailCall(`/api/v2/tickets/${basicTicket.id}`);
        
        // Step 3: Yield complete ticket matching tickets.json schema
        yield completeTicket;
        
        // Step 4: Rate limiting between detail calls
        await this.rateLimiter.wait();
      }
    }
  }
  
  private async makeDetailCall(endpoint: string) {
    const response = await this.httpClient.get(endpoint);
    return response.data.ticket; // Complete ticket object
  }
}
```

#### AssetsStream (Single Call Pattern)
```typescript
class AssetsStream extends HttpStream {
  name = 'assets';
  primary_key = ['id'];
  
  async *readRecords() {
    // Single API call provides complete asset data
    for await (const page of this.getPaginatedData('/api/v2/assets')) {
      for (const asset of page.assets) {
        yield asset; // Already complete, matches assets.json schema
      }
    }
  }
}
```

### JSON Schema Examples

#### tickets.json (Complete Ticket Schema)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": true,
  "properties": {
    "id": { "type": ["null", "integer"] },
    "subject": { "type": ["null", "string"] },
    "description": { "type": ["null", "string"] },
    "description_text": { "type": ["null", "string"] },
    "status": { "type": ["null", "integer"] },
    "priority": { "type": ["null", "integer"] },
    "urgency": { "type": ["null", "integer"] },
    "impact": { "type": ["null", "integer"] },
    "requester_id": { "type": ["null", "integer"] },
    "responder_id": { "type": ["null", "integer"] },
    "group_id": { "type": ["null", "integer"] },
    "source": { "type": ["null", "integer"] },
    "category": { "type": ["null", "string"] },
    "sub_category": { "type": ["null", "string"] },
    "item_category": { "type": ["null", "string"] },
    "created_at": { "type": ["null", "string"], "format": "date-time" },
    "updated_at": { "type": ["null", "string"], "format": "date-time" },
    "due_by": { "type": ["null", "string"], "format": "date-time" },
    "fr_due_by": { "type": ["null", "string"], "format": "date-time" },
    "custom_fields": { "type": ["null", "object"], "additionalProperties": true },
    "tags": { "type": ["null", "array"], "items": { "type": "string" } },
    "attachments": { 
      "type": ["null", "array"],
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string" },
          "content_type": { "type": "string" },
          "size": { "type": "integer" },
          "attachment_url": { "type": "string" }
        }
      }
    },
    "conversations": {
      "type": ["null", "array"],
      "items": {
        "type": "object", 
        "properties": {
          "id": { "type": "integer" },
          "body": { "type": "string" },
          "body_text": { "type": "string" },
          "incoming": { "type": "boolean" },
          "private": { "type": "boolean" },
          "user_id": { "type": ["null", "integer"] },
          "created_at": { "type": "string", "format": "date-time" },
          "updated_at": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

#### assets.json (Single Call Schema)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": true,
  "properties": {
    "id": { "type": ["null", "integer"] },
    "display_id": { "type": ["null", "integer"] },
    "name": { "type": ["null", "string"] },
    "asset_type_id": { "type": ["null", "integer"] },
    "asset_tag": { "type": ["null", "string"] },
    "serial_number": { "type": ["null", "string"] },
    "user_id": { "type": ["null", "integer"] },
    "location_id": { "type": ["null", "integer"] },
    "department_id": { "type": ["null", "integer"] },
    "agent_id": { "type": ["null", "integer"] },
    "group_id": { "type": ["null", "integer"] },
    "assigned_on": { "type": ["null", "string"], "format": "date-time" },
    "created_at": { "type": ["null", "string"], "format": "date-time" },
    "updated_at": { "type": ["null", "string"], "format": "date-time" }
  }
}
```

### Multi-Tenant Connector Management

#### Database Schema
```sql
tenant_connectors:
- id (UUID)
- tenant_id (UUID) 
- connector_type (VARCHAR) -- freshservice, servicenow, zendesk
- name (VARCHAR) -- customer label: "Production FreshService"
- config (JSONB) -- connector-specific encrypted configuration
- status (VARCHAR) -- active, disabled, error
- created_at, updated_at (TIMESTAMP)
```

#### Configuration Examples

**FreshService Config:**
```json
{
  "domain": "company.freshservice.com",
  "api_key": "encrypted_api_key",
  "start_date": "2024-01-01T00:00:00Z"
}
```

**ServiceNow Config:**
```json
{
  "instance_url": "company.service-now.com",
  "username": "integration_user", 
  "password": "encrypted_password",
  "oauth_client_id": "client_123",
  "oauth_client_secret": "encrypted_secret"
}
```

#### Connector Instantiation Flow
1. Customer selects saved connector (e.g., "Production FreshService")
2. Backend retrieves tenant-specific config from database
3. Decrypts credentials
4. Instantiates connector class with customer's configuration
5. Executes migration with customer-specific instance

## Core Services

### ConnectorFactory
- Creates source/destination instances based on type
- Handles configuration validation per connector schema
- Manages connector lifecycle

### ProgressTracker  
- Real-time progress updates via Redis pub/sub
- Progress persistence in PostgreSQL
- SSE event emission to frontend

### RateLimiter
- Per-tenant API quota management
- Redis-based rate limiting counters
- Connector-specific rate limit enforcement

### DataTransformer
- Field mapping between source and destination systems
- Schema validation and type conversion
- Custom transformation rules per migration
- **Data storage**: Extracted and transformed data persistence for validation

### CSVExportService
- **CSV Generation**: Create downloadable CSV files from extracted data
- **Streaming Export**: Handle large datasets efficiently
- **Entity-Specific Downloads**: Separate CSV files per entity type (tickets, assets, users)
- **Audit Reports**: Generate comprehensive migration audit trails

### AuditTracker
- **Complete Migration History**: Track extraction, transformation, and loading phases
- **Error Documentation**: Detailed failure analysis and resolution tracking
- **Compliance Support**: Maintain audit trails for regulatory requirements
- **Data Retention**: Automatic cleanup of expired audit data

## Data Layer

### PostgreSQL Tables
- **jobs**: Migration job tracking and metadata
- **job_progress**: Real-time progress updates
- **job_extracted_data**: Temporary storage of extracted data for CSV export and validation
- **job_load_results**: Detailed loading results and audit trail per batch
- **tenant_connectors**: Customer connector configurations
- **tenants**: Multi-tenant isolation and settings
- **migration_results**: Summary data and statistics

### Extended Database Schema

#### Extracted Data Storage
```sql
job_extracted_data:
- id (UUID)
- job_id (UUID FK to jobs table)
- tenant_id (UUID FK) -- multi-tenant isolation
- entity_type (VARCHAR) -- tickets, assets, users, incidents
- batch_number (INTEGER) -- for large dataset processing
- source_system (VARCHAR) -- freshservice, servicenow, zendesk
- raw_data (JSONB) -- original API response data
- transformed_data (JSONB) -- processed data ready for destination
- record_count (INTEGER) -- number of records in this batch
- extraction_timestamp (TIMESTAMP)
- expires_at (TIMESTAMP) -- automatic cleanup date
- created_at, updated_at (TIMESTAMP)

job_load_results:
- id (UUID)
- job_extracted_data_id (UUID FK)
- destination_system (VARCHAR) -- target system where data was loaded
- success_count (INTEGER) -- successfully loaded records
- failed_count (INTEGER) -- failed record loads
- error_details (JSONB) -- specific error information per failed record
- retry_count (INTEGER) -- number of retry attempts
- loaded_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

#### Data Lifecycle Management
- **Extraction Phase**: Raw and transformed data stored in job_extracted_data
- **Validation Phase**: CSV exports generated from stored data for customer review
- **Loading Phase**: Results tracked in job_load_results for complete audit trail
- **Retention Policy**: Configurable data retention (30-90 days default)
- **Auto-Cleanup**: Background jobs remove expired extracted data
- **Audit Preservation**: Critical audit information retained longer for compliance

### Redis Usage
- BullMQ job queues and scheduling
- Progress pub/sub channels
- Rate limiting counters
- Temporary job state and caching

## API Extensions

### CSV Export Endpoints
```
GET  /api/jobs/{id}/download/csv/{entity_type}    -- Download extracted data as CSV
GET  /api/jobs/{id}/download/audit-report         -- Complete migration audit report
GET  /api/jobs/{id}/extraction-summary           -- Preview extracted data counts
POST /api/jobs/{id}/approve-loading              -- Customer approval to proceed with loading
GET  /api/jobs/{id}/loading-results              -- Detailed loading success/failure results
```

### Enhanced Job Status Flow
```
Job Status Progression:
queued → running → extracting → data_ready → loading → completed/failed

Additional Status Details:
- data_ready: Extraction complete, CSV available for download
- validation_pending: Awaiting customer approval (optional workflow)
- loading: Data being written to destination system
- audit_complete: Full audit trail available
```

## Deployment Architecture

### Single Server (Initial)
- API Server (Fastify process)
- Worker Processes (3-4 instances)
- Redis (single instance)
- PostgreSQL (single instance)

### Multi-Server (Growth)
- Load Balancer → Multiple API Servers
- Dedicated Worker Servers
- Redis Cluster
- PostgreSQL Primary/Replica

### Containerization
- API Server container
- Worker container (same codebase, different entry point)
- Redis container
- PostgreSQL container

## Job Execution Flow

1. **Job Creation**: Customer creates migration via API
2. **Queue Assignment**: BullMQ queues job with tenant priority
3. **Worker Assignment**: Available worker picks up job
4. **Connector Loading**: Worker loads customer-specific connector configs
5. **Data Extraction**: Source extraction with storage of raw and transformed data
6. **CSV Export**: Customer can download extracted data for validation
7. **Data Loading**: Destination loading with detailed success/failure tracking
8. **Progress Updates**: Real-time progress via Redis → SSE to frontend
9. **Audit Trail**: Complete migration history stored for compliance
10. **Completion & Cleanup**: Job status update, data retention management

## Multi-Tenant Isolation

- Database queries filtered by tenant_id
- Job queue prioritization by tenant tier
- Rate limiting per tenant
- Encrypted credential storage per tenant
- Worker processes handle one tenant per job

## Operational Flow

### Phase 1: Customer Onboarding & Connector Setup

#### 1.1 Connector Selection
- Customer logs into Project Bridge dashboard
- Navigates to "Add Connector" section
- Selects connector type from available options (FreshService, ServiceNow, Zendesk)

#### 1.2 Configuration Input
- System presents connector-specific configuration form
- **FreshService**: Domain, API Key, Start Date (optional)
- **ServiceNow**: Instance URL, Username/Password OR OAuth credentials
- **Zendesk**: Subdomain, Email, API Token OR OAuth token

#### 1.3 Configuration Validation & Storage
- Backend validates config against connector's JSON schema
- Tests connection using provided credentials
- **Success Path**: 
  - Encrypts sensitive fields (API keys, passwords)
  - Stores in `tenant_connectors` table with status='active'
  - Returns success confirmation to customer
- **Failure Path**:
  - Returns specific error message
  - Does not store invalid configuration

#### 1.4 Database Record Created
```sql
INSERT INTO tenant_connectors (
  tenant_id: customer's UUID,
  connector_type: 'freshservice',
  name: 'Production FreshService', -- customer's label
  config: encrypted JSON config,
  status: 'active'
)
```

### Phase 2: Job Creation & Extraction

#### 2.1 Migration Job Setup
- Customer navigates to "Create Migration" 
- Selects source connector from their saved connectors
- Selects destination connector from their saved connectors
- Chooses entities to migrate (tickets, assets, users, etc.)
- Sets migration options (batch size, date ranges, filters)

#### 2.2 Job Queuing
- API creates job record in `jobs` table with status='queued'
- BullMQ adds migration job to queue with payload:
  ```json
  {
    "jobId": "job_123",
    "tenantId": "tenant_456",
    "sourceConnectorId": "conn_source_789", 
    "destConnectorId": "conn_dest_101",
    "entities": ["tickets", "assets"],
    "options": { "batchSize": 100, "startDate": "2024-01-01" }
  }
  ```

#### 2.3 Worker Job Processing
- Available worker picks up job from BullMQ queue
- Worker queries `tenant_connectors` table for both source and destination configs
- Decrypts credential fields from stored configs
- Instantiates source connector (e.g., FreshService) with customer's credentials
- Instantiates destination connector with customer's credentials

#### 2.4 Extraction Phase
- **Discovery**: Source connector discovers available streams and schemas
- **Stream Processing**: For each selected entity (tickets, assets):
  - Source connector calls appropriate API endpoints
  - Applies rate limiting per customer's API quotas
  - Transforms API responses according to stream schema
  - **Stores extracted data**: Raw and transformed data stored in `job_extracted_data` table
  - Updates progress in Redis and database
- **Data Preparation**: Extracted data prepared for destination format
- **CSV Generation**: Customer can download extracted data for validation
- **Progress Updates**: Real-time progress sent to frontend via SSE

#### 2.5 Validation & Loading Phase
- **Data Validation**: Customer can download CSV of extracted data for verification
- **Loading Phase**: Approved data loaded to destination system with detailed tracking
- **Audit Trail**: Complete record of extraction, transformation, and loading results
- **Job State Management**: queued → running → extracting → data_ready → loading → completed/failed
- **Progress Updates**: Include current entity, records processed, estimated completion
- **Error Handling**: Failed jobs marked with detailed error information and retry logic
- **Results Storage**: Loading outcomes stored in `job_load_results` for audit purposes

### Key Architecture Points

#### Tenant Isolation
- Each customer's connectors completely isolated by tenant_id
- Worker processes one tenant's job at a time
- Rate limiting applied per customer's API credentials

#### Configuration Reusability  
- Customer saves connector once, reuses for multiple migrations
- Same connector definition serves all customers
- Customer-specific credentials and settings per connector instance

#### Security
- All sensitive data encrypted at rest
- Credentials only decrypted during job execution
- No cross-tenant data access possible

## Benefits

- **Vendor Neutral**: All components run anywhere
- **Horizontally Scalable**: Each layer scales independently
- **Multi-Tenant Ready**: Built-in isolation and prioritization
- **Maintainable**: Clear separation of concerns
- **Extensible**: New connectors follow established pattern
- **Audit Complete**: Full migration history and compliance support
- **Data Validation**: Customer verification capabilities with CSV export
- **Error Transparency**: Detailed failure tracking and resolution support