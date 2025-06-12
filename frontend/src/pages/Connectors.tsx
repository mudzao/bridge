import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  TrendingUp,
  Search
} from 'lucide-react';
import { api } from '@/lib/api';
// Removed unused useToast import since we only need Detail navigation now

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

export const Connectors: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  // Fetch connectors
  const { data: connectorsResponse, isLoading, error } = useQuery({
    queryKey: ['connectors'],
    queryFn: api.connectors.getAll,
  });

  const connectors = connectorsResponse?.data || [];

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
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            <XCircle className="w-3 h-3 mr-1" />
            Disabled
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Unknown
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-5/6"></div>
                  </div>
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
        
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading connectors
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{(error as Error).message}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => navigate('/connectors/new')}
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
              onClick={() => navigate('/jobs/new')}
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
        <div className="px-6 py-4">
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
                 className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white appearance-none bg-no-repeat bg-right"
                 style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><path fill=\"none\" stroke=\"%23666\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M4 6l4 4 4-4\"/></svg>')", backgroundPosition: "right 12px center", backgroundSize: "16px" }}
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
                    onClick={() => navigate('/connectors/new')}
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
                                <button
                                  onClick={() => navigate(`/connectors/${connector.id}`)}
                                  className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  {connector.name}
                                </button>
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
                            <button
                              onClick={() => navigate(`/connectors/${connector.id}`)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                              Detail
                            </button>
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
                            <button
                              onClick={() => navigate(`/connectors/${connector.id}`)}
                              className="text-lg font-medium text-gray-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              {connector.name}
                            </button>
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
                          onClick={() => navigate(`/connectors/${connector.id}`)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          Detail
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
    </div>
  );
}; 