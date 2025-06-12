import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Database,
  Server,
  Edit,
  TestTube,
  Key,
  Globe,
  User,
  CalendarDays,
  Clock,
  Activity,
  RefreshCw
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

type TabType = 'overview' | 'settings';

// Tab definitions - only 2 tabs
const TABS = [
  { id: 'overview' as TabType, label: 'Overview' },
  { id: 'settings' as TabType, label: 'Settings' },
];

export const ConnectorDetailPage: React.FC = () => {
  const { connectorId } = useParams<{ connectorId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch connector details
  const { data: connectorResponse, isLoading: connectorLoading, error: connectorError } = useQuery({
    queryKey: ['connector', connectorId],
    queryFn: () => api.connectors.getById(connectorId!),
    enabled: !!connectorId,
  });

  // Fetch jobs using this connector for metrics
  const { data: jobsResponse } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.jobs.getAll,
  });

  const connector = connectorResponse?.data as Connector;
  const allJobs = jobsResponse?.data || [];

  // Filter jobs that use this connector
  const connectorJobs = allJobs.filter((job: any) => 
    job.sourceConnectorId === connectorId || job.destinationConnectorId === connectorId
  );

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const testData = {
        connectorType: connector.connectorType,
        config: connector.config,
      };
      return await api.connectors.testConfig(testData);
    },
    onSuccess: (response) => {
      setTestResult({ success: true, message: response.data.message || 'Connection successful!' });
    },
    onError: (error: any) => {
      setTestResult({ 
        success: false, 
        message: error.response?.data?.error || 'Connection failed. Please check your configuration.' 
      });
    },
  });

  const getConnectorTitle = () => {
    if (!connector) return 'Loading...';
    return connector.name;
  };

  const getConnectorTypeInfo = (type: string) => {
    switch (type) {
      case 'FRESHSERVICE':
        return { name: 'FreshService', icon: Database, color: 'text-green-600' };
      case 'SERVICENOW':
        return { name: 'ServiceNow', icon: Database, color: 'text-blue-600' };
      case 'ZENDESK':
        return { name: 'Zendesk', icon: Database, color: 'text-orange-600' };
      default:
        return { name: type, icon: Server, color: 'text-gray-600' };
    }
  };

  const getStatusIcon = (status: string) => {
    const iconClass = "w-3 h-3";
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'DISABLED':
        return <AlertCircle className={`${iconClass} text-yellow-500`} />;
      case 'ERROR':
        return <XCircle className={`${iconClass} text-red-500`} />;
      default:
        return <AlertCircle className={`${iconClass} text-gray-500`} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'ACTIVE':
        return `${baseClasses} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200`;
      case 'DISABLED':
        return `${baseClasses} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200`;
      case 'ERROR':
        return `${baseClasses} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200`;
      default:
        return `${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getJobStats = () => {
    const totalJobs = connectorJobs.length;
    const completedJobs = connectorJobs.filter((job: any) => job.status === 'COMPLETED').length;
    const failedJobs = connectorJobs.filter((job: any) => job.status === 'FAILED').length;
    const activeJobs = connectorJobs.filter((job: any) => 
      ['QUEUED', 'RUNNING', 'EXTRACTING', 'LOADING'].includes(job.status)
    ).length;

    return { totalJobs, completedJobs, failedJobs, activeJobs };
  };

  // Smaller status badge for job table rows - matches Jobs page styling
  const getJobStatusBadge = (status: string) => {
    const statusConfig = {
      QUEUED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-600 dark:text-gray-300', 
        label: 'Queued'
      },
      RUNNING: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        label: 'In Process'
      },
      EXTRACTING: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        label: 'In Process'
      },
      DATA_READY: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        label: 'Done'
      },
      LOADING: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        label: 'In Process'
      },
      COMPLETED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        label: 'Done'
      },
      FAILED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-red-600 dark:text-red-400', 
        label: 'Failed'
      },
      CANCELLED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-500 dark:text-gray-400', 
        label: 'Cancelled'
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.QUEUED;

    return `inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`;
  };

  const renderTabContent = () => {
    const typeInfo = getConnectorTypeInfo(connector.connectorType);
    const IconComponent = typeInfo.icon;
    const jobStats = getJobStats();

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Job Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                <span className="text-gray-500 text-sm mb-2 block">Total Jobs</span>
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xl font-bold text-black dark:text-white">
                    {jobStats.totalJobs}
                  </span>
                  <Activity className="w-6 h-6 text-gray-400 ml-2" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                <span className="text-gray-500 text-sm mb-2 block">Running</span>
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xl font-bold text-black dark:text-white">
                    {jobStats.activeJobs}
                  </span>
                  <RefreshCw className="w-6 h-6 text-gray-400 ml-2" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                <span className="text-gray-500 text-sm mb-2 block">Completed</span>
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xl font-bold text-black dark:text-white">
                    {jobStats.completedJobs}
                  </span>
                  <CheckCircle className="w-6 h-6 text-gray-400 ml-2" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                <span className="text-gray-500 text-sm mb-2 block">Failed</span>
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xl font-bold text-black dark:text-white">
                    {jobStats.failedJobs}
                  </span>
                  <XCircle className="w-6 h-6 text-gray-400 ml-2" />
                </div>
              </div>
            </div>
            
            {/* Connector Information Card */}
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Connector Information</h3>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-2/5 flex-shrink-0">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Connector Type
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      System integration type
                    </p>
                  </div>
                  <div className="w-3/5 text-sm text-gray-900 dark:text-gray-100 flex items-center">
                    <IconComponent className={`w-4 h-4 mr-2 ${typeInfo.color}`} />
                    {typeInfo.name}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-2/5 flex-shrink-0">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Current connector status
                    </p>
                  </div>
                  <div className="w-3/5 text-sm text-gray-900 dark:text-gray-100">
                    <span className={getStatusBadge(connector.status)}>
                      {getStatusIcon(connector.status)}
                      {connector.status === 'ACTIVE' ? 'Active' : 
                       connector.status === 'DISABLED' ? 'Disabled' : 
                       connector.status === 'ERROR' ? 'Error' : connector.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-2/5 flex-shrink-0">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Domain/Instance
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Connection endpoint
                    </p>
                  </div>
                  <div className="w-3/5 text-sm text-gray-900 dark:text-gray-100">
                    {connector.config?.domain || connector.config?.instance || 'Not configured'}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-2/5 flex-shrink-0">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Created At
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      When connector was created
                    </p>
                  </div>
                  <div className="w-3/5 text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(connector.createdAt)}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-2/5 flex-shrink-0">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Updated
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      When connector was last modified
                    </p>
                  </div>
                  <div className="w-3/5 text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(connector.updatedAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Jobs Card */}
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Recent Jobs</h3>
              
              {connectorJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No jobs yet</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    This connector hasn't been used in any migration jobs.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Job ID</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Type</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connectorJobs.slice(0, 5).map((job: any) => (
                        <tr key={job.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-3 px-2 text-gray-900 dark:text-gray-100 font-medium">
                            <button
                              onClick={() => navigate(`/jobs/${job.id}`)}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {job.id.slice(0, 8)}...
                            </button>
                          </td>
                          <td className="py-3 px-2">
                            <span className={getJobStatusBadge(job.status)}>
                              {(() => {
                                const statusLabels = {
                                  QUEUED: 'Queued',
                                  RUNNING: 'In Process',
                                  EXTRACTING: 'In Process',
                                  DATA_READY: 'Done',
                                  LOADING: 'In Process',
                                  COMPLETED: 'Done',
                                  FAILED: 'Failed',
                                  CANCELLED: 'Cancelled'
                                };
                                return statusLabels[job.status as keyof typeof statusLabels] || job.status;
                              })()}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                            {job.jobType || 'EXTRACTION'}
                          </td>
                          <td className="py-3 px-2 text-gray-700 dark:text-gray-300">
                            {formatDate(job.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            {/* Configuration Card */}
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configuration</h3>
                <button
                  onClick={() => navigate('/connectors')}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit in Connector List
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Globe className="w-4 h-4 inline mr-2" />
                      Domain/Instance
                    </label>
                    <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100">
                      {connector.config?.domain || connector.config?.instance || 'Not configured'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Key className="w-4 h-4 inline mr-2" />
                      API Key
                    </label>
                    <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100">
                      {connector.config?.apiKey ? '••••••••••••••••' : 'Not configured'}
                    </div>
                  </div>
                  
                  {connector.config?.username && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <User className="w-4 h-4 inline mr-2" />
                        Username
                      </label>
                      <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100">
                        {connector.config.username}
                      </div>
                    </div>
                  )}
                  
                  {connector.config?.password && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Key className="w-4 h-4 inline mr-2" />
                        Password
                      </label>
                      <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100">
                        ••••••••••••••••
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Test Connection Card */}
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Connection Test</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Test the connection to verify your connector configuration is working properly.
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setTestResult(null);
                    testConnectionMutation.mutate();
                  }}
                  disabled={testConnectionMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testConnectionMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </button>

                {/* Test Result */}
                {testResult && (
                  <div className={`p-4 rounded-lg border ${
                    testResult.success 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center">
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 mr-2" />
                      )}
                      <div>
                        <h4 className={`text-sm font-medium ${
                          testResult.success 
                            ? 'text-green-800 dark:text-green-200' 
                            : 'text-red-800 dark:text-red-200'
                        }`}>
                          {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                        </h4>
                        <p className={`text-sm ${
                          testResult.success 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {testResult.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone Card */}
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 border border-red-200 dark:border-red-800">
              <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-4">Danger Zone</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                Deleting a connector will permanently remove it and prevent any future jobs from using it. 
                Active jobs will not be affected.
              </p>
              
              <button
                onClick={() => navigate('/connectors')}
                className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-600 text-sm font-medium rounded-lg text-red-700 dark:text-red-300 bg-white dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete Connector in Connector List
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (connectorLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (connectorError || !connector) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connector Not Found</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The connector you're looking for doesn't exist or you don't have permission to view it.
            </p>
          </div>
          <button
            onClick={() => navigate('/connectors')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Connectors
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Following JobDetailPage pattern */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{getConnectorTitle()}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connector ID: {connector.id}
          </p>
        </div>
        <button
          onClick={() => navigate('/connectors')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Connectors
        </button>
      </div>

      {/* Tab Navigation - Same style as JobDetailPage */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {renderTabContent()}
      </div>
    </div>
  );
}; 