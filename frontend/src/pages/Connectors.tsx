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
  Save
} from 'lucide-react';
import { api } from '@/lib/api';

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
  const queryClient = useQueryClient();

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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { 
        bg: 'bg-green-100', 
        text: 'text-green-800', 
        icon: CheckCircle,
        label: 'Active' 
      },
      DISABLED: { 
        bg: 'bg-gray-100', 
        text: 'text-gray-800', 
        icon: XCircle,
        label: 'Disabled' 
      },
      ERROR: { 
        bg: 'bg-red-100', 
        text: 'text-red-800', 
        icon: AlertCircle,
        label: 'Error' 
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DISABLED;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3 mr-1" />
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
      if (result.success) {
        alert('Connection test successful!');
      } else {
        alert('Connection test failed: ' + result.message);
      }
    } catch (error) {
      alert('Connection test failed: ' + (error as Error).message);
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
      
      alert('Connector updated successfully!');
    } catch (error) {
      alert('Failed to update connector: ' + (error as Error).message);
    }
  };

  const handleDeleteConnector = async (connectorId: string, connectorName: string) => {
    if (window.confirm(`Are you sure you want to delete the connector "${connectorName}"?`)) {
      try {
        await deleteConnectorMutation.mutateAsync(connectorId);
        alert('Connector deleted successfully');
      } catch (error) {
        alert('Failed to delete connector: ' + (error as Error).message);
      }
    }
  };

  const renderEditForm = () => {
    if (!editingConnector) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Edit {editingConnector.connectorType} Connector
            </h3>
            <button
              onClick={() => {
                setEditingConnector(null);
                reset();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(handleSaveConnector)} className="space-y-4">
            {/* Common fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                {...register('name')}
                type="text"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                {...register('status')}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-sm text-red-600">{errors.status.message as string}</p>
              )}
            </div>

            {/* Connector-specific fields */}
            {editingConnector.connectorType === 'FRESHSERVICE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Domain</label>
                  <input
                    {...register('domain')}
                    type="text"
                    placeholder="your-domain.freshservice.com"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-600">{errors.domain.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">API Key</label>
                  <input
                    {...register('apiKey')}
                    type="password"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.apiKey && (
                    <p className="mt-1 text-sm text-red-600">{errors.apiKey.message as string}</p>
                  )}
                </div>
              </>
            )}

            {editingConnector.connectorType === 'SERVICENOW' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Instance</label>
                  <input
                    {...register('instance')}
                    type="text"
                    placeholder="your-instance.service-now.com"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.instance && (
                    <p className="mt-1 text-sm text-red-600">{errors.instance.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input
                    {...register('username')}
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600">{errors.username.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    {...register('password')}
                    type="password"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message as string}</p>
                  )}
                </div>
              </>
            )}

            {editingConnector.connectorType === 'ZENDESK' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subdomain</label>
                  <input
                    {...register('subdomain')}
                    type="text"
                    placeholder="your-subdomain.zendesk.com"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.subdomain && (
                    <p className="mt-1 text-sm text-red-600">{errors.subdomain.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    {...register('email')}
                    type="email"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">API Token</label>
                  <input
                    {...register('apiToken')}
                    type="password"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.apiToken && (
                    <p className="mt-1 text-sm text-red-600">{errors.apiToken.message as string}</p>
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || updateConnectorMutation.isPending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
            <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage connections to your helpdesk systems
            </p>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="rounded-lg bg-gray-200 h-16 w-16"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
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
            <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage connections to your helpdesk systems
            </p>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-6">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading connectors</h3>
            <p className="mt-1 text-sm text-gray-500">
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
          <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage connections to your helpdesk systems
          </p>
        </div>
        <button
          onClick={() => alert('Add connector functionality coming soon!')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Connector
        </button>
      </div>

      {/* Connectors List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {connectors.length === 0 ? (
            <div className="text-center py-6">
              <Database className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No connectors</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding your first connector.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => alert('Add connector functionality coming soon!')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Connector
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {connectors.map((connector: Connector) => (
                <div
                  key={connector.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {getConnectorIcon(connector.connectorType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {connector.name}
                          </h3>
                          {getStatusBadge(connector.status)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {connector.connectorType} • Created {formatDate(connector.createdAt)}
                        </p>
                        {connector.updatedAt !== connector.createdAt && (
                          <p className="text-xs text-gray-400">
                            Last updated {formatDate(connector.updatedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTestConnection(connector.id)}
                        disabled={testingConnector === connector.id}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <TestTube className="w-3 h-3 mr-1" />
                        {testingConnector === connector.id ? 'Testing...' : 'Test'}
                      </button>
                      
                      <button
                        onClick={() => handleEditConnector(connector)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </button>
                      
                      <button
                        onClick={() => handleDeleteConnector(connector.id, connector.name)}
                        disabled={deleteConnectorMutation.isPending}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  {/* Configuration Preview */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Configuration:</span>
                      {connector.connectorType === 'FRESHSERVICE' && connector.config.domain && (
                        <span className="ml-2">Domain: {connector.config.domain}</span>
                      )}
                      {connector.connectorType === 'SERVICENOW' && connector.config.instance && (
                        <span className="ml-2">Instance: {connector.config.instance}</span>
                      )}
                      {connector.connectorType === 'ZENDESK' && connector.config.subdomain && (
                        <span className="ml-2">Subdomain: {connector.config.subdomain}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {renderEditForm()}
    </div>
  );
}; 