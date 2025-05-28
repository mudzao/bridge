import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Database, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Server,
  Activity
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface DashboardStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  totalConnectors: number;
  activeConnectors: number;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const [jobsResponse, connectorsResponse] = await Promise.all([
        api.jobs.getStats(),
        api.connectors.getAll(),
      ]);

      const jobs = jobsResponse.data || {};
      const connectors = connectorsResponse.data || [];

      return {
        totalJobs: jobs.total || 0,
        completedJobs: jobs.completed || 0,
        failedJobs: jobs.failed || 0,
        runningJobs: jobs.running || 0,
        totalConnectors: connectors.length,
        activeConnectors: connectors.filter((c: any) => c.status === 'ACTIVE').length,
      };
    },
  });

  // Fetch recent jobs
  const { data: recentJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: async () => {
      const response = await api.jobs.getAll();
      return response.data?.slice(0, 5) || [];
    },
  });

  const statCards = [
    {
      name: 'Total Jobs',
      value: stats?.totalJobs || 0,
      icon: Activity,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      name: 'Completed',
      value: stats?.completedJobs || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      name: 'Running',
      value: stats?.runningJobs || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
    {
      name: 'Failed',
      value: stats?.failedJobs || 0,
      icon: XCircle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
    {
      name: 'Connectors',
      value: stats?.totalConnectors || 0,
      icon: Database,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      name: 'Active Connectors',
      value: stats?.activeConnectors || 0,
      icon: Server,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      RUNNING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Running' },
      EXTRACTING: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Extracting' },
      LOADING: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Loading' },
      FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
      QUEUED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Queued' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.QUEUED;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {user?.firstName || user?.email?.split('@')[0]}! Here's what's happening with your migrations.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 ${stat.bgColor} rounded-md flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${stat.textColor}`} />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {statsLoading ? (
                            <div className="animate-pulse h-6 bg-gray-200 rounded w-12"></div>
                          ) : (
                            stat.value
                          )}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Jobs */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Jobs</h3>
          
          {jobsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentJobs && recentJobs.length > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {recentJobs.map((job: any, jobIdx: number) => (
                  <li key={job.id}>
                    <div className="relative pb-8">
                      {jobIdx !== recentJobs.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                            job.status === 'COMPLETED' ? 'bg-green-500' :
                            job.status === 'FAILED' ? 'bg-red-500' :
                            job.status === 'RUNNING' ? 'bg-yellow-500' : 'bg-gray-500'
                          }`}>
                            <Activity className="h-4 w-4 text-white" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Migration job for{' '}
                              <span className="font-medium text-gray-900">
                                {job.entities?.join(', ') || 'Unknown entities'}
                              </span>
                            </p>
                            <div className="mt-1">
                              {getStatusBadge(job.status)}
                            </div>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            <time dateTime={job.createdAt}>
                              {formatDate(job.createdAt)}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-6">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first migration job.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => window.location.href = '/jobs/new'}
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                  <TrendingUp className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Start New Migration
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Create a new data migration job between your connected systems.
                </p>
              </div>
            </button>

            <button
              onClick={() => window.location.href = '/connectors'}
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-600 group-hover:bg-purple-100">
                  <Database className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Manage Connectors
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Configure and test connections to your helpdesk systems.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 