# Project Bridge

A vendor-neutral, decoupled B2B SaaS platform for migrating data between helpdesk systems (ServiceNow, FreshService, Zendesk, etc.).

## Architecture

Project Bridge follows a completely decoupled architecture:
- **Frontend**: React SPA (static deployment)
- **Backend**: Node.js API + Worker processes
- **Database**: PostgreSQL + Redis
- **Communication**: REST APIs + Server-Sent Events

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **API Framework**: Fastify
- **Job Queue**: BullMQ + Redis
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + bcrypt

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **State Management**: TanStack Query + Zustand
- **Styling**: Tailwind CSS + Headless UI
- **Real-time**: Server-Sent Events

## Development Setup

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd project-bridge
   cp .env.example .env
   ```

2. **Start infrastructure**:
   ```bash
   docker-compose up -d
   ```

3. **Backend setup**:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   npm run dev
   ```

4. **Frontend setup** (new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Bull Board: http://localhost:3000/admin/queues

## Project Structure

```
├── backend/          # Node.js API server and workers
├── frontend/         # React SPA
├── docs/            # Architecture documentation
└── docker-compose.yml  # PostgreSQL + Redis services
```

## Development Workflow

1. **Phase-based Development**: Implement features in architectural phases
2. **Test Each Phase**: Verify functionality before proceeding
3. **Follow Architecture**: Strict adherence to documented patterns
4. **Type Safety**: TypeScript throughout with strict mode

## Documentation

- [Overall Architecture](docs/project-bridge-overall-architecture.md)
- [Frontend Architecture](docs/project-bridge-frontend-architecture.md)
- [Backend Architecture](docs/updated-backend-architecture.md)

## License

MIT License 