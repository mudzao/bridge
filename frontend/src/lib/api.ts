import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, LoginRequest, LoginResponse, User } from '@/types';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
class TokenManager {
  private static readonly TOKEN_KEY = 'project_bridge_token';
  private static readonly USER_KEY = 'project_bridge_user';

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  static setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }
}

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = TokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      TokenManager.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // Authentication
  auth: {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
      const response: AxiosResponse<ApiResponse<LoginResponse>> = await apiClient.post(
        '/api/auth/login',
        credentials
      );
      
      if (response.data.success && response.data.data) {
        TokenManager.setToken(response.data.data.token);
        TokenManager.setUser(response.data.data.user);
        return response.data.data;
      }
      
      throw new Error(response.data.message || 'Login failed');
    },

    logout: async (): Promise<void> => {
      try {
        await apiClient.post('/api/auth/logout');
      } catch (error) {
        // Continue with logout even if API call fails
        console.warn('Logout API call failed:', error);
      } finally {
        TokenManager.removeToken();
      }
    },

    getProfile: async (): Promise<User> => {
      const response: AxiosResponse<ApiResponse<User>> = await apiClient.get('/api/auth/profile');
      
      if (response.data.success && response.data.data) {
        TokenManager.setUser(response.data.data);
        return response.data.data;
      }
      
      throw new Error(response.data.message || 'Failed to get profile');
    },

    refreshToken: async (): Promise<{ token: string }> => {
      const response: AxiosResponse<ApiResponse<{ token: string }>> = await apiClient.post(
        '/api/auth/refresh'
      );
      
      if (response.data.success && response.data.data) {
        TokenManager.setToken(response.data.data.token);
        return response.data.data;
      }
      
      throw new Error(response.data.message || 'Failed to refresh token');
    },
  },

  // Jobs
  jobs: {
    getAll: async () => {
      const response = await apiClient.get('/api/jobs');
      return response.data;
    },

    getById: async (id: string) => {
      const response = await apiClient.get(`/api/jobs/${id}`);
      return response.data;
    },

    create: async (jobData: any) => {
      const response = await apiClient.post('/api/jobs', jobData);
      return response.data;
    },

    getProgress: async (id: string) => {
      const response = await apiClient.get(`/api/jobs/${id}/progress`);
      return response.data;
    },

    getMinuteProgress: async (id: string) => {
      const response = await apiClient.get(`/api/jobs/${id}/minute-progress`);
      return response.data;
    },

    getTimeline: async (id: string) => {
      const response = await apiClient.get(`/api/jobs/${id}/timeline`);
      return response.data;
    },

    cancel: async (id: string) => {
      const response = await apiClient.post(`/api/jobs/${id}/cancel`);
      return response.data;
    },

    getStats: async () => {
      const response = await apiClient.get('/api/jobs/stats');
      return response.data;
    },

    // Export functionality
    getExtractionSummary: async (id: string) => {
      const response = await apiClient.get(`/api/jobs/${id}/extraction-summary`);
      return response.data;
    },

    getDataPreview: async (id: string, entityType: string, limit?: number) => {
      const response = await apiClient.get(`/api/jobs/${id}/preview/${entityType}`, {
        params: { limit },
      });
      return response.data;
    },

    getAvailableEntities: async (id: string) => {
      const response = await apiClient.get(`/api/jobs/${id}/entities`);
      return response.data;
    },

    getStatistics: async (id: string) => {
      const response = await apiClient.get(`/api/jobs/${id}/statistics`);
      return response.data;
    },

    downloadCSV: async (id: string, entityType: string, options?: { includeRawData?: boolean }) => {
      const response = await apiClient.get(`/api/jobs/${id}/download/csv/${entityType}`, {
        params: options,
        responseType: 'blob',
      });
      return response;
    },

    downloadFullExport: async (id: string, options?: { includeRawData?: boolean }) => {
      const response = await apiClient.get(`/api/jobs/${id}/download/full`, {
        params: options,
        responseType: 'blob',
      });
      return response;
    },
  },

  // Connectors
  connectors: {
    getAll: async () => {
      const response = await apiClient.get('/api/connectors');
      return response.data;
    },

    getById: async (id: string) => {
      const response = await apiClient.get(`/api/connectors/${id}`);
      return response.data;
    },

    create: async (connectorData: any) => {
      const response = await apiClient.post('/api/connectors', connectorData);
      return response.data;
    },

    update: async (id: string, connectorData: any) => {
      const response = await apiClient.put(`/api/connectors/${id}`, connectorData);
      return response.data;
    },

    delete: async (id: string) => {
      const response = await apiClient.delete(`/api/connectors/${id}`);
      return response.data;
    },

    test: async (id: string) => {
      const response = await apiClient.post(`/api/connectors/${id}/test`);
      return response.data;
    },

    getTypes: async () => {
      const response = await apiClient.get('/api/connectors/types');
      return response.data;
    },

    testConfig: async (connectorData: { connectorType: string; config: any }) => {
      const response = await apiClient.post('/api/connectors/test-config', connectorData);
      return response.data;
    },
  },

  // System
  health: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

// Export token manager for use in components
export { TokenManager };

// Export axios instance for custom requests
export { apiClient }; 