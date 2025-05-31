import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Database, 
  TrendingUp,
  Activity,
  Waypoints,
  CheckCircle,
  Sparkles,
  Calendar,
  Zap,
  Bug,
  Plus
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

      const jobs = jobsResponse.data?.jobCounts || {};
      const connectors = connectorsResponse.data || [];

      return {
        totalJobs: jobs.total || 0,
        completedJobs: (jobs.completed || 0) + (jobs.dataReady || 0),
        failedJobs: jobs.failed || 0,
        runningJobs: jobs.running || 0,
        totalConnectors: connectors.length,
        activeConnectors: connectors.filter((c: any) => c.status === 'ACTIVE').length,
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back, {user?.firstName || user?.email?.split('@')[0]}! Here's what's happening with your migrations.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'Connectors', icon: Waypoints, value: stats?.totalConnectors },
          { title: 'All Jobs', icon: Activity, value: stats?.totalJobs },
          { title: 'All Successful Jobs', icon: CheckCircle, value: stats?.completedJobs },
        ].map(({ title, icon: Icon, value }, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 flex flex-col items-start">
            <span className="text-gray-500 text-sm mb-2">{title}</span>
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl font-bold text-black dark:text-white">
                {statsLoading ? (
                  <div className="animate-pulse h-6 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                ) : (
                  value ?? 0
                )}
              </span>
              <Icon className="w-6 h-6 text-gray-400 ml-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => window.location.href = '/jobs/new'}
              className="relative group bg-white dark:bg-gray-800 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
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

            <button
              onClick={() => window.location.href = '/connectors'}
              className="relative group bg-white dark:bg-gray-800 p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            >
              <div>
                <Database className="h-6 w-6 text-gray-400 mx-auto" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Manage Connectors
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Configure and test connections to your helpdesk systems.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* What's New */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">What's New</h3>
          
          <div className="space-y-4">
            {[
              {
                date: '2024-01-15',
                type: 'feature',
                title: 'Enhanced Job Monitoring',
                description: 'Real-time progress tracking and detailed logs for all migration jobs.',
                icon: Activity
              },
              {
                date: '2024-01-10',
                type: 'improvement',
                title: 'Faster Data Processing',
                description: 'Improved extraction speed by 40% with new optimization algorithms.',
                icon: Zap
              },
              {
                date: '2024-01-05',
                type: 'integration',
                title: 'New Connector Support',
                description: 'Added support for ServiceNow and Freshworks integrations.',
                icon: Plus
              },
              {
                date: '2024-01-01',
                type: 'fix',
                title: 'Reliability Improvements',
                description: 'Fixed connection timeout issues and improved error handling.',
                icon: Bug
              }
            ].slice(0, 3).map((update, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-center w-8 h-8">
                  <update.icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {update.title}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(update.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {update.description}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${
                    update.type === 'feature' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    update.type === 'improvement' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    update.type === 'integration' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                  }`}>
                    {update.type === 'feature' ? 'New Feature' :
                     update.type === 'improvement' ? 'Improvement' :
                     update.type === 'integration' ? 'Integration' : 'Bug Fix'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 text-center">
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium">
              View all updates →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 