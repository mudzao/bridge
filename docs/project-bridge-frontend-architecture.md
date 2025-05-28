# Project Bridge - Frontend Architecture

## Overview

The Project Bridge frontend is a modern React Single Page Application (SPA) designed as a completely decoupled, vendor-neutral client that communicates with the backend exclusively through HTTP APIs and Server-Sent Events.

## Core Architecture

### Technology Stack

**Build & Runtime:**
- **React 18** with TypeScript for type safety and modern features
- **Vite** for lightning-fast builds and development experience
- **React Router v6** for client-side routing and navigation

**State Management:**
- **TanStack Query v5** for server state management and caching
- **Zustand** for lightweight local UI state management

**UI & Styling:**
- **Tailwind CSS** for utility-first styling
- **Headless UI** or **Radix UI** for accessible component primitives
- **Lucide React** for consistent iconography

**Development Tools:**
- **TypeScript** in strict mode for type safety
- **ESLint + Prettier** for code quality and formatting
- **Vitest** for unit testing

## Project Structure

```
frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Base components (Button, Input, Modal, Table)
│   │   ├── forms/           # Form components (ConnectorForm, MigrationForm)
│   │   ├── progress/        # Progress components (ProgressBar, JobStatus)
│   │   └── layout/          # Layout components (Header, Sidebar, PageShell)
│   ├── pages/               # Route-level page components
│   │   ├── Dashboard.tsx    # Main tenant dashboard
│   │   ├── Connectors.tsx   # Connector management
│   │   ├── Migrations.tsx   # Migration job management
│   │   ├── Progress.tsx     # Real-time job monitoring
│   │   └── Login.tsx        # Authentication pages
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts       # Authentication logic
│   │   ├── useSSE.ts        # Server-Sent Events management
│   │   ├── useConnectors.ts # Connector CRUD operations
│   │   └── useMigrations.ts # Migration job management
│   ├── services/            # API clients and external integrations
│   │   ├── api.ts           # Main API client configuration
│   │   ├── auth.ts          # Authentication service
│   │   ├── connectors.ts    # Connector API calls
│   │   └── migrations.ts    # Migration API calls
│   ├── stores/              # Zustand state stores
│   │   ├── authStore.ts     # User session and authentication state
│   │   ├── uiStore.ts       # UI state (modals, notifications, loading)
│   │   └── progressStore.ts # Real-time progress data from SSE
│   ├── types/               # TypeScript type definitions
│   │   ├── api.ts           # API request/response types
│   │   ├── connector.ts     # Connector configuration types
│   │   ├── migration.ts     # Migration job types
│   │   └── user.ts          # User and tenant types
│   ├── utils/               # Utility functions
│   │   ├── formatters.ts    # Date, number, status formatting
│   │   ├── validators.ts    # Form validation functions
│   │   └── constants.ts     # Application constants
│   ├── App.tsx              # Root application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles and Tailwind imports
├── public/                  # Static assets
├── index.html               # HTML template
├── vite.config.ts          # Vite build configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## Application Architecture

### Component Architecture

#### 1. Base UI Components (`/components/ui/`)
Reusable, design-system components:
- **Button**: Variants (primary, secondary, destructive), sizes, loading states
- **Input**: Text, email, password inputs with validation states
- **Modal**: Accessible dialog component with backdrop
- **Table**: Data table with sorting, pagination, loading states
- **Card**: Content container with consistent styling
- **Badge**: Status indicators and tags

#### 2. Feature Components (`/components/forms/`, `/components/progress/`)
Domain-specific, business logic components:
- **ConnectorForm**: Dynamic forms based on connector type
- **MigrationWizard**: Step-by-step migration creation flow
- **ProgressBar**: Real-time job progress visualization
- **JobStatus**: Current migration status with details
- **DataPreview**: CSV data preview and validation

#### 3. Layout Components (`/components/layout/`)
Application structure components:
- **AppShell**: Main application layout with navigation
- **Header**: Top navigation with user menu and tenant context
- **Sidebar**: Main navigation menu
- **PageHeader**: Consistent page titles and actions

### State Management Strategy

#### Server State (TanStack Query)
Manages all backend data with intelligent caching:

```typescript
// Example: Connector management
const useConnectors = () => {
  return useQuery({
    queryKey: ['connectors'],
    queryFn: () => api.connectors.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

const useCreateConnector = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.connectors.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
    },
  });
};
```

**Features:**
- **Automatic Caching**: Reduces API calls and improves performance
- **Background Refetching**: Keeps data fresh without user intervention
- **Optimistic Updates**: Immediate UI updates with rollback on failure
- **Error Handling**: Consistent error states and retry mechanisms
- **Offline Support**: Cache serves data when network is unavailable

#### Local State (Zustand)
Manages UI state and temporary data:

```typescript
// Authentication store
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// UI store
interface UIState {
  sidebarOpen: boolean;
  currentModal: string | null;
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
}
```

### Real-Time Features

#### Server-Sent Events (SSE)
Custom hook for real-time job progress:

```typescript
interface JobProgress {
  jobId: string;
  status: 'queued' | 'running' | 'extracting' | 'data_ready' | 'loading' | 'completed' | 'failed';
  currentEntity: string;
  recordsProcessed: number;
  totalRecords: number;
  estimatedCompletion?: string;
  error?: string;
}

const useJobProgress = (jobId: string | null) => {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // SSE connection management
  // Automatic reconnection on failure
  // Cleanup on component unmount
  
  return { progress, isConnected };
};
```

## Page Architecture

### Route Structure
```
/                           # Redirect to /dashboard (authenticated) or /login
/login                      # Authentication page
/dashboard                  # Main tenant overview
/connectors                 # Connector management
  /connectors/new           # Add new connector
  /connectors/:id/edit      # Edit connector configuration
/migrations                 # Migration job history
  /migrations/new           # Create new migration
  /migrations/:id           # Migration details and progress
  /migrations/:id/progress  # Real-time progress monitoring
/settings                   # Tenant settings and preferences
```

### Page Components

#### Dashboard (`/pages/Dashboard.tsx`)
Main tenant overview with:
- Recent migration jobs summary
- Active job progress widgets
- Quick actions (new migration, add connector)
- System status indicators

#### Connectors (`/pages/Connectors.tsx`)
Connector management interface:
- List of saved connectors with status
- Add new connector wizard
- Test connection functionality
- Edit/delete connector actions

#### Migrations (`/pages/Migrations.tsx`)
Migration job management:
- Job history table with filters
- Create new migration workflow
- Job status monitoring
- CSV download links
- Audit trail access

#### Progress (`/pages/Progress.tsx`)
Real-time migration monitoring:
- Live progress bars and status updates
- Current phase indicators
- Error messages and retry options
- Estimated completion times

## API Integration

### HTTP Client Configuration
```typescript
// Axios instance with authentication and tenant context
const apiClient = axios.create({
  baseURL: process.env.VITE_API_BASE_URL,
  timeout: 30000,
});

// Request interceptor for authentication
apiClient.interceptors.request.use((config) => {
  const token = authStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
```

### API Service Layer
Organized by domain with consistent patterns:

```typescript
// Connector service
export const connectorService = {
  getAll: () => apiClient.get<Connector[]>('/api/connectors'),
  getById: (id: string) => apiClient.get<Connector>(`/api/connectors/${id}`),
  create: (data: CreateConnectorRequest) => apiClient.post<Connector>('/api/connectors', data),
  update: (id: string, data: UpdateConnectorRequest) => apiClient.put<Connector>(`/api/connectors/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/connectors/${id}`),
  test: (id: string) => apiClient.post<TestResult>(`/api/connectors/${id}/test`),
};
```

## User Experience Features

### Form Management
- **Dynamic Forms**: Connector-specific configuration forms
- **Validation**: Real-time validation with helpful error messages
- **Auto-save**: Draft states for complex forms
- **Connection Testing**: Immediate feedback on connector configuration

### Progress Tracking
- **Real-time Updates**: SSE-powered live progress indicators
- **Visual Feedback**: Progress bars, phase indicators, status badges
- **Error Handling**: Clear error messages with retry options
- **Notifications**: Toast notifications for important events

### Data Validation
- **CSV Preview**: Preview extracted data before loading
- **Download Options**: Export data in various formats
- **Approval Workflow**: Customer approval before data loading
- **Audit Access**: Complete migration history and logs

## Performance Optimization

### Code Splitting
```typescript
// Lazy load pages for smaller initial bundle
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Connectors = lazy(() => import('./pages/Connectors'));
const Migrations = lazy(() => import('./pages/Migrations'));
```

### Caching Strategy
- **TanStack Query**: Intelligent server state caching
- **Service Worker**: Static asset caching (optional)
- **Memoization**: React.memo for expensive components

### Bundle Optimization
- **Tree Shaking**: Remove unused code
- **Code Splitting**: Route-based and component-based splitting
- **Asset Optimization**: Image optimization and lazy loading

## Development Experience

### Development Server
```bash
# Fast development with Vite
npm run dev

# Features:
# - Hot Module Replacement (HMR)
# - Instant server start
# - TypeScript checking
# - Proxy to backend API
```

### Environment Configuration
```typescript
// Environment variables
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  readonly VITE_SENTRY_DSN?: string;
}
```

### Type Safety
- **Strict TypeScript**: Catch errors at compile time
- **API Types**: Shared types between frontend and backend
- **Form Validation**: Type-safe form schemas

## Deployment Strategy

### Build Process
```bash
# Production build
npm run build

# Output:
# - Optimized, minified bundle
# - Static assets with cache headers
# - Source maps for debugging
```

### Static Deployment
**Supported Platforms:**
- Cloudflare Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Any static file hosting

**Deployment Features:**
- **Zero Server Requirements**: Pure static files
- **Global CDN**: Edge distribution for performance
- **Automatic HTTPS**: SSL/TLS termination
- **Custom Domains**: Professional branding

### Environment-Specific Configuration
```typescript
// Runtime configuration
const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  environment: import.meta.env.VITE_APP_ENV,
  features: {
    enableCSVExport: true,
    enableAuditTrail: true,
    enableRealTimeProgress: true,
  },
};
```

## Security Considerations

### Authentication
- **JWT Storage**: Secure token storage (httpOnly cookies preferred)
- **Automatic Logout**: Token expiration handling
- **Route Protection**: Authentication guards for protected pages

### Data Security
- **No Sensitive Data**: Never store passwords or sensitive connector configs
- **HTTPS Only**: All API communication over encrypted connections
- **CORS**: Proper cross-origin request handling

### Content Security
- **CSP Headers**: Content Security Policy for XSS protection
- **Input Sanitization**: Prevent injection attacks
- **Dependency Scanning**: Regular security audits of npm packages

## Benefits of This Architecture

### Developer Experience
- **Fast Development**: Vite's instant hot reloading
- **Type Safety**: Comprehensive TypeScript coverage
- **Modern Tooling**: Latest React patterns and best practices
- **Easy Testing**: Component isolation and mocking

### Performance
- **Fast Loading**: Code splitting and lazy loading
- **Efficient Updates**: Smart caching and state management
- **Real-time Features**: SSE for live updates without polling
- **Global Distribution**: CDN deployment for worldwide performance

### Maintainability
- **Clear Structure**: Organized by feature and responsibility
- **Reusable Components**: Design system approach
- **Consistent Patterns**: Standardized hooks and services
- **Type Safety**: Catch errors before production

### Scalability
- **Vendor Neutral**: Deploy anywhere static files are served
- **Performance**: CDN scaling handles any traffic volume
- **Feature Extensibility**: Easy to add new pages and functionality
- **Team Scalability**: Clear boundaries for parallel development

This frontend architecture provides a solid foundation for a modern, performant, and maintainable B2B SaaS application while maintaining complete vendor neutrality and deployment flexibility.