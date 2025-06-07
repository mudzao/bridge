import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Database, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Trash2,
  Edit,
  TestTube,
  X,
  Save,
  TrendingUp,
  Search
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Connector {
  id: string;
  tenantId: string;
  connectorType: 'FRESHSERVICE' | 'SERVICENOW' | 'ZENDESK';
  name: string;
  config: Record<string, any>;
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
  createdAt: string;
  updatedAt: string;
}

// Validation schemas for different connector types
const freshserviceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().min(1, 'Domain is required'),
  apiKey: z.string().min(1, 'API Key is required'),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

const servicenowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  instance: z.string().min(1, 'Instance is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

const zendeskSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subdomain: z.string().min(1, 'Subdomain is required'),
  email: z.string().email('Valid email is required'),
  apiToken: z.string().min(1, 'API Token is required'),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export const Connectors: React.FC = () => {
  const [testingConnector, setTestingConnector] = useState<string | null>(null);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  // Fetch connectors
  const { data: connectorsResponse, isLoading, error } = useQuery({
    queryKey: ['connectors'],
    queryFn: api.connectors.getAll,
  });

  const connectors = connectorsResponse?.data || [];

  // Get validation schema based on connector type
  const getValidationSchema = (type: string) => {
    switch (type) {
      case 'FRESHSERVICE':
        return freshserviceSchema;
      case 'SERVICENOW':
        return servicenowSchema;
      case 'ZENDESK':
        return zendeskSchema;
      default:
        return z.object({});
    }
  };

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<any>({
    ...(editingConnector && { 
      resolver: zodResolver(getValidationSchema(editingConnector.connectorType)) 
    }),
  });

  // Test connector mutation
  const testConnectorMutation = useMutation({
    mutationFn: api.connectors.test,
    onMutate: (connectorId) => {
      setTestingConnector(connectorId);
    },
    onSettled: () => {
      setTestingConnector(null);
    },
  });

  // Update connector mutation
  const updateConnectorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.connectors.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
      setEditingConnector(null);
      reset();
    },
  });

  // Delete connector mutation
  const deleteConnectorMutation = useMutation({
    mutationFn: api.connectors.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
    },
  });

  const getConnectorIcon = (type: string) => {
    const iconClass = "w-8 h-8";
    switch (type) {
      case 'FRESHSERVICE':
        return <Database className={`${iconClass} text-green-600`} />;
      case 'SERVICENOW':
        return <Database className={`${iconClass} text-blue-600`} />;
      case 'ZENDESK':
        return <Database className={`${iconClass} text-orange-600`} />;
      default:
        return <Database className={`${iconClass} text-gray-600`} />;
    }
  };

  const getConnectorTypeName = (type: string) => {
    switch (type) {
      case 'FRESHSERVICE':
        return 'FreshService';
      case 'SERVICENOW':
        return 'ServiceNow';
      case 'ZENDESK':
        return 'Zendesk';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        icon: CheckCircle,
        iconColor: 'text-green-600 dark:text-green-400',
        label: 'Active' 
      },
      DISABLED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-500 dark:text-gray-400', 
        icon: XCircle,
        iconColor: 'text-red-600 dark:text-red-400',
        label: 'Disabled' 
      },
      ERROR: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-red-600 dark:text-red-400', 
        icon: AlertCircle,
        iconColor: 'text-red-600 dark:text-red-400',
        label: 'Error' 
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DISABLED;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className={`w-3 h-3 mr-2 ${config.iconColor}`} />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleTestConnection = async (connectorId: string) => {
    try {
      const result = await testConnectorMutation.mutateAsync(connectorId);
      if (result.data && result.data.success) {
        showSuccess('Connection test successful!');
      } else {
        showError('Connection test failed: ' + (result.data?.message || result.message || 'Unknown error'));
      }
    } catch (error: any) {
      // Show backend error message if available
      if (error?.response?.data?.message) {
        showError('Connection test failed: ' + error.response.data.message);
      } else {
        showError('Connection test failed: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleEditConnector = (connector: Connector) => {
    setEditingConnector(connector);
    // Pre-populate form with current values
    setValue('name', connector.name);
    setValue('status', connector.status);
    
    // Set connector-specific fields
    if (connector.connectorType === 'FRESHSERVICE') {
      setValue('domain', connector.config.domain || '');
      setValue('apiKey', connector.config.apiKey || '');
    } else if (connector.connectorType === 'SERVICENOW') {
      setValue('instance', connector.config.instance || '');
      setValue('username', connector.config.username || '');
      setValue('password', connector.config.password || '');
    } else if (connector.connectorType === 'ZENDESK') {
      setValue('subdomain', connector.config.subdomain || '');
      setValue('email', connector.config.email || '');
      setValue('apiToken', connector.config.apiToken || '');
    }
  };

  const handleSaveConnector = async (formData: any) => {
    if (!editingConnector) return;

    try {
      const { name, status, ...configData } = formData;
      
      await updateConnectorMutation.mutateAsync({
        id: editingConnector.id,
        data: {
          name,
          status,
          config: configData,
        },
      });
      
      showSuccess('Connector updated successfully!');
    } catch (error) {
      showError('Failed to update connector: ' + (error as Error).message);
    }
  };

  const handleDeleteConnector = async (connectorId: string, connectorName: string) => {
    if (window.confirm(`Are you sure you want to delete the connector "${connectorName}"?`)) {
      try {
        await deleteConnectorMutation.mutateAsync(connectorId);
        showSuccess('Connector deleted successfully');
      } catch (error) {
        showError('Failed to delete connector: ' + (error as Error).message);
      }
    }
  };

  const filteredConnectors = connectors.filter((connector: Connector) => {
    const matchesStatus = statusFilter === 'all' || connector.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      connector.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      connector.connectorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (connector.config.domain && connector.config.domain.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (connector.config.instance && connector.config.instance.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (connector.config.subdomain && connector.config.subdomain.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  const getConfigPreview = (connector: Connector) => {
    if (connector.connectorType === 'FRESHSERVICE' && connector.config.domain) {
      return connector.config.domain;
    }
    if (connector.connectorType === 'SERVICENOW' && connector.config.instance) {
      return connector.config.instance;
    }
    if (connector.connectorType === 'ZENDESK' && connector.config.subdomain) {
      return connector.config.subdomain;
    }
    return 'Not configured';
  };

  const renderEditForm = () => {
    if (!editingConnector) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Edit Connector</h3>
            <button
              onClick={() => {
                setEditingConnector(null);
                reset();
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mb-4">{getStatusBadge(editingConnector.status)}</div>
          <form onSubmit={handleSubmit(handleSaveConnector)} className="space-y-4">
            {/* Common fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                {...register('name')}
                type="text"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select
                {...register('status')}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
                <option value="ERROR" disabled>Error</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.status.message as string}</p>
              )}
            </div>

            {/* Connector-specific fields */}
            {editingConnector.connectorType === 'FRESHSERVICE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain</label>
                  <input
                    {...register('domain')}
                    type="text"
                    placeholder="your-domain.freshservice.com"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.domain.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                  <input
                    {...register('apiKey')}
                    type="password"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.apiKey && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.apiKey.message as string}</p>
                  )}
                </div>
              </>
            )}

            {editingConnector.connectorType === 'SERVICENOW' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instance</label>
                  <input
                    {...register('instance')}
                    type="text"
                    placeholder="your-instance.service-now.com"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.instance && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.instance.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                  <input
                    {...register('username')}
                    type="text"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.username.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                  <input
                    {...register('password')}
                    type="password"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message as string}</p>
                  )}
                </div>
              </>
            )}

            {editingConnector.connectorType === 'ZENDESK' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subdomain</label>
                  <input
                    {...register('subdomain')}
                    type="text"
                    placeholder="your-subdomain.zendesk.com"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.subdomain && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.subdomain.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    {...register('email')}
                    type="email"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Token</label>
                  <input
                    {...register('apiToken')}
                    type="password"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.apiToken && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.apiToken.message as string}</p>
                  )}
                </div>
              </>
            )}

            {/* Form actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setEditingConnector(null);
                  reset();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || updateConnectorMutation.isPending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting || updateConnectorMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connectors</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage connections to your helpdesk systems
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-700 shadow rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="rounded-lg bg-gray-200 dark:bg-gray-600 h-16 w-16"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connectors</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage connections to your helpdesk systems
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-700 shadow rounded-lg p-6">
          <div className="text-center py-6">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Error loading connectors</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {(error as Error).message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connectors</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage connections to your helpdesk systems
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => alert('Add connector functionality coming soon!')}
              className="relative group bg-white dark:bg-gray-800 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            >
              <div>
                <Plus className="h-6 w-6 text-gray-400 mx-auto" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Add New Connector
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Configure and connect to a new helpdesk system.
                </p>
              </div>
            </button>

            <button
              onClick={() => window.location.href = '/jobs/new'}
              className="relative group bg-white dark:bg-gray-800 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            >
              <div>
                <TrendingUp className="h-6 w-6 text-gray-400 mx-auto" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Start New Migration
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Create a new data migration job between your connected systems.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Connectors List */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
        <div className="px-3 py-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search connectors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
                <option value="ERROR">Error</option>
              </select>
            </div>
          </div>

          {filteredConnectors.length === 0 ? (
            <div className="text-center py-6">
              <Database className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {connectors.length === 0 ? 'No connectors yet' : 'No connectors match your search'}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {connectors.length === 0 
                  ? 'Get started by adding your first connector.' 
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
              {connectors.length === 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => alert('Add connector functionality coming soon!')}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Connector
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Table for desktop */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Connector
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Domain
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-600">
                      {filteredConnectors.map((connector: Connector) => (
                        <tr key={connector.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {connector.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {getConnectorTypeName(connector.connectorType)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(connector.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {getConfigPreview(connector)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(connector.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleTestConnection(connector.id)}
                                disabled={testingConnector === connector.id}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                              >
                                <TestTube className="w-3 h-3 mr-1" />
                                {testingConnector === connector.id ? 'Testing...' : 'Test'}
                              </button>
                              
                              <button
                                onClick={() => handleEditConnector(connector)}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </button>
                              
                              <button
                                onClick={() => handleDeleteConnector(connector.id, connector.name)}
                                disabled={deleteConnectorMutation.isPending}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cards for mobile */}
              <div className="md:hidden space-y-4">
                {filteredConnectors.map((connector: Connector) => (
                  <div
                    key={connector.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-500 transition-colors dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                              {connector.name}
                            </h3>
                            {getStatusBadge(connector.status)}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {getConnectorTypeName(connector.connectorType)} • {getConfigPreview(connector)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Created {formatDate(connector.createdAt)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleTestConnection(connector.id)}
                          disabled={testingConnector === connector.id}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <TestTube className="w-3 h-3 mr-1" />
                          {testingConnector === connector.id ? 'Testing...' : 'Test'}
                        </button>
                        
                        <button
                          onClick={() => handleEditConnector(connector)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        
                        <button
                          onClick={() => handleDeleteConnector(connector.id, connector.name)}
                          disabled={deleteConnectorMutation.isPending}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {renderEditForm()}
    </div>
  );
}; 