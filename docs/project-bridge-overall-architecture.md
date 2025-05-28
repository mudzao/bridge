# Project Bridge - Overall System Architecture

## System Overview

Project Bridge is a vendor-neutral, decoupled B2B SaaS platform for migrating data between helpdesk systems (ServiceNow, FreshService, Zendesk, etc.). The platform extracts tickets, incidents, assets, and other entities from source systems, transforms/maps the data, and loads it into destination systems with real-time progress tracking, CSV export capabilities, and comprehensive audit trails.

## High-Level Architecture

### Decoupled Architecture Pattern
```
Frontend (React SPA)          Backend (Node.js API)         Database Layer
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│ Static Web App      │      │ API Server          │      │ PostgreSQL          │
│ - React + TypeScript│ ←→   │ - Fastify           │ ←→   │ - User data         │
│ - Served from CDN   │      │ - JWT Auth          │      │ - Job data          │
│ - No server runtime │      │ - SSE Streams       │      │ - Connector configs │
└─────────────────────┘      │                     │      │ - Extracted data    │
                             │ Worker Processes    │      └─────────────────────┘
                             │ - BullMQ Jobs       │      
                             │ - Migration Tasks   │      ┌─────────────────────┐
                             │ - Data Extraction   │      │ Redis               │
                             └─────────────────────┘ ←→   │ - Job Queues        │
                                                          │ - Progress Pub/Sub  │
                                                          │ - Rate Limiting     │
                                                          └─────────────────────┘
```

## Core Architecture Principles

### Vendor Neutrality
- **No Platform Lock-in**: All components use standard technologies
- **Deployment Flexibility**: Can run on any cloud provider or on-premises
- **Technology Independence**: Standard React, Node.js, PostgreSQL, Redis stack

### Complete Decoupling
- **Frontend**: Static React app, no server-side dependencies
- **Backend**: API-first Node.js service with separate worker processes
- **Database**: Backend-exclusive access, no direct frontend connections
- **Communication**: HTTP APIs + Server-Sent Events only

### Multi-Tenant Architecture
- **Tenant Isolation**: Complete data separation per customer
- **Shared Infrastructure**: Efficient resource utilization
- **Scalable Design**: Per-tenant rate limiting and prioritization

## Technology Stack Summary

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast builds, modern bundling)
- **Routing**: React Router v6
- **State Management**: TanStack Query (server state) + Zustand (local state)
- **Styling**: Tailwind CSS + Headless UI components
- **Real-time**: Server-Sent Events (SSE)

### Backend Stack
- **Runtime**: Node.js with TypeScript
- **API Framework**: Fastify (lightweight, performant)
- **Job Processing**: BullMQ + Redis
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + bcrypt
- **Real-time**: Server-Sent Events

### Infrastructure Stack
- **Database**: PostgreSQL (primary + replica)
- **Caching/Queues**: Redis cluster
- **Deployment**: Docker containers
- **Monitoring**: Bull Board dashboard + structured logging

## System Components

### 1. Frontend Application
**Purpose**: Customer-facing web interface for migration management

**Key Features:**
- Multi-tenant dashboard
- Connector configuration and management
- Migration job creation and monitoring
- Real-time progress tracking
- CSV data export and validation
- Audit trail viewing

**Deployment**: Static hosting (CDN, Cloudflare Pages, Netlify, etc.)

### 2. Backend API Server
**Purpose**: Business logic, authentication, and job orchestration

**Key Features:**
- RESTful API endpoints
- JWT-based authentication
- Multi-tenant data isolation
- Real-time progress streaming via SSE
- Job queue management
- Connector configuration validation

### 3. Worker Processes
**Purpose**: Execute migration jobs asynchronously

**Key Features:**
- Source system data extraction
- Data transformation and mapping
- Destination system data loading
- Progress reporting
- Error handling and retry logic
- Rate limiting compliance

### 4. Data Layer
**Purpose**: Persistent storage and caching

**Components:**
- **PostgreSQL**: Primary data storage (users, jobs, extracted data, audit trails)
- **Redis**: Job queues, progress pub/sub, rate limiting counters

## Data Flow Architecture

### Migration Process Flow
```
1. Customer Login
   Frontend → Backend API → PostgreSQL (user authentication)

2. Connector Setup
   Frontend → Backend API → PostgreSQL (encrypted connector configs)

3. Migration Creation
   Frontend → Backend API → BullMQ (job queuing)

4. Job Processing
   Worker → Source API → PostgreSQL (data extraction & storage)

5. Real-time Updates
   Worker → Redis Pub/Sub → Backend SSE → Frontend

6. Data Validation
   Frontend → Backend API → PostgreSQL (CSV generation)

7. Loading Process
   Worker → Destination API → PostgreSQL (audit trail)
```

## Authentication & Security

### Authentication Architecture
- **Storage**: User credentials in backend PostgreSQL database
- **Method**: JWT tokens for stateless authentication
- **Multi-tenant**: Automatic tenant context in all requests
- **Frontend**: Stores only JWT token, no sensitive data

### Security Measures
- **Data Encryption**: Sensitive connector credentials encrypted at rest
- **Tenant Isolation**: All database queries filtered by tenant_id
- **API Security**: All endpoints require valid JWT authentication
- **Rate Limiting**: Per-tenant API quota enforcement
- **Audit Logging**: Complete migration history for compliance

## Scalability Design

### Horizontal Scaling
- **Frontend**: Infinite scaling via CDN distribution
- **Backend API**: Multiple server instances behind load balancer
- **Workers**: Scale based on job queue depth
- **Database**: Primary/replica setup with connection pooling

### Performance Optimization
- **Frontend**: Code splitting, lazy loading, aggressive caching
- **Backend**: Async job processing, efficient database queries
- **Real-time**: SSE for efficient progress updates (no polling)
- **Caching**: Redis for frequently accessed data

## Deployment Architecture

### Development Environment
```
Local Development:
├── Frontend: Vite dev server (port 5173)
├── Backend: Fastify server (port 3000)
├── Workers: 3-4 local processes
├── PostgreSQL: Local instance (port 5432)
└── Redis: Local instance (port 6379)
```

### Production Environment
```
Production Deployment:
├── Frontend: CDN/Static hosting
├── Backend: Container service (Railway, Render, DigitalOcean Apps)
├── Workers: Dedicated container instances
├── PostgreSQL: Managed database service
└── Redis: Managed Redis service
```

### Container Strategy
```
Docker Services:
├── api-server: Fastify + Bull Board dashboard
├── worker: Same codebase, worker entry point
├── postgres: PostgreSQL 15
├── redis: Redis 7 Alpine
└── nginx: Load balancer + SSL termination
```

## Key Benefits

### For Business
- **Vendor Independence**: No platform lock-in, deploy anywhere
- **Cost Efficiency**: Optimized hosting per service type
- **Scalability**: Handle enterprise workloads efficiently
- **Compliance**: Complete audit trails and data control

### For Development
- **Maintainability**: Clear separation of concerns
- **Developer Experience**: Modern tooling and hot reloading
- **Testing**: Each component testable in isolation
- **Deployment**: Independent deployment cycles

### For Customers
- **Performance**: Global CDN distribution, real-time updates
- **Reliability**: Job persistence, automatic retry logic
- **Transparency**: Real-time progress, detailed audit trails
- **Flexibility**: CSV export, data validation capabilities

## Integration Points

### Frontend ↔ Backend Communication
- **REST APIs**: Standard CRUD operations with JSON payloads
- **Server-Sent Events**: Real-time progress streaming
- **Authentication**: JWT tokens in Authorization headers
- **Error Handling**: Consistent error response format

### Backend ↔ External APIs
- **Connector Pattern**: Standardized interface for all helpdesk systems
- **Rate Limiting**: Respect external API quotas and limits
- **Error Recovery**: Exponential backoff and retry logic
- **Data Validation**: Schema-based validation of extracted data

## Future Extensibility

### Adding New Connectors
- Implement standard Source/Stream interface
- Add JSON schema definitions
- Configure authentication methods
- Deploy with zero frontend changes

### Adding New Features
- **Mobile Apps**: Same backend APIs, different frontend
- **Webhook Support**: Extend backend with webhook endpoints
- **Advanced Analytics**: Add reporting services using existing data
- **Enterprise Features**: SSO, advanced audit trails, custom transformations

This architecture provides a solid foundation for a scalable, maintainable, and vendor-neutral B2B SaaS platform while maintaining the flexibility to evolve with business needs.