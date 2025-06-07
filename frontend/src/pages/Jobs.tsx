import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Play, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Pause,
  Download,
  Eye,
  Search,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { DataValidationModal } from '@/components/DataValidationModal';
import { useNavigate } from 'react-router-dom';

interface Job {
  id: string;
  tenantId: string;
  jobType?: string;
  sourceConnectorId: string;
  destinationConnectorId: string;
  status: 'QUEUED' | 'RUNNING' | 'EXTRACTING' | 'DATA_READY' | 'LOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  entities: string[];
  config: Record<string, any>;
  progress?: {
    currentEntity?: string;
    recordsProcessed?: number;
    totalRecords?: number;
    percentage?: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

interface Connector {
  id: string;
  name: string;
  connectorType: string;
  status: string;
}

// Updated job creation form schema
const createJobSchema = z.object({
  jobType: z.enum(['EXTRACTION', 'MIGRATION']),
  sourceConnectorId: z.string().min(1, 'Source connector is required'),
  destinationConnectorId: z.string().optional(),
  entities: z.array(z.string()).min(1, 'At least one entity must be selected'),
  config: z.object({
    batchSize: z.number().min(1).max(1000).default(100),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).default({}),
}).refine((data) => {
  // Destination connector is required for migration jobs
  if (data.jobType === 'MIGRATION' && !data.destinationConnectorId) {
    return false;
  }
  return true;
}, {
  message: 'Destination connector is required for migration jobs',
  path: ['destinationConnectorId'],
});

type CreateJobForm = z.infer<typeof createJobSchema>;

export const Jobs: React.FC = () => {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationJobId, setValidationJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch jobs
  const { data: jobsResponse, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.jobs.getAll,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  // Fetch connectors for job creation
  const { data: connectorsResponse } = useQuery({
    queryKey: ['connectors'],
    queryFn: api.connectors.getAll,
  });

  // Fetch job statistics
  const { data: statsResponse } = useQuery({
    queryKey: ['job-stats'],
    queryFn: api.jobs.getStats,
    refetchInterval: 10000,
  });

  const jobs = jobsResponse?.data || [];
  const connectors = connectorsResponse?.data || [];
  const jobCounts = statsResponse?.data?.jobCounts || {};
  
  // Calculate proper aggregated stats
  const stats = {
    total: jobCounts.total || 0,
    running: (jobCounts.running || 0) + (jobCounts.extracting || 0) + (jobCounts.loading || 0),
    completed: (jobCounts.completed || 0) + (jobCounts.dataReady || 0),
    failed: jobCounts.failed || 0,
  };

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: api.jobs.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-stats'] });
      setShowValidationModal(false);
    },
  });

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: api.jobs.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-stats'] });
    },
  });

  const getStatusIcon = (status: string) => {
    const iconClass = "w-4 h-4";
    switch (status) {
      case 'QUEUED':
        return <Clock className={`${iconClass} text-yellow-500`} />;
      case 'RUNNING':
      case 'EXTRACTING':
      case 'LOADING':
        return <RefreshCw className={`${iconClass} text-blue-500 animate-spin`} />;
      case 'DATA_READY':
        return <Download className={`${iconClass} text-green-500`} />;
      case 'COMPLETED':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'FAILED':
        return <XCircle className={`${iconClass} text-red-500`} />;
      case 'CANCELLED':
        return <Pause className={`${iconClass} text-gray-500`} />;
      default:
        return <AlertCircle className={`${iconClass} text-gray-500`} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      QUEUED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-600 dark:text-gray-300', 
        icon: Clock,
        iconColor: 'text-gray-500 dark:text-gray-400',
        label: 'Queued',
        animate: false
      },
      RUNNING: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        icon: RefreshCw,
        iconColor: 'text-blue-600 dark:text-blue-400',
        label: 'In Process',
        animate: true
      },
      EXTRACTING: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        icon: RefreshCw,
        iconColor: 'text-blue-600 dark:text-blue-400',
        label: 'In Process',
        animate: true
      },
      DATA_READY: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        icon: CheckCircle,
        iconColor: 'text-green-600 dark:text-green-400',
        label: 'Done',
        animate: false
      },
      LOADING: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        icon: RefreshCw,
        iconColor: 'text-blue-600 dark:text-blue-400',
        label: 'In Process',
        animate: true
      },
      COMPLETED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-900 dark:text-white', 
        icon: CheckCircle,
        iconColor: 'text-green-600 dark:text-green-400',
        label: 'Done',
        animate: false
      },
      FAILED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-red-600 dark:text-red-400', 
        icon: XCircle,
        iconColor: 'text-red-600 dark:text-red-400',
        label: 'Failed',
        animate: false
      },
      CANCELLED: { 
        bg: 'bg-gray-100 dark:bg-gray-800', 
        text: 'text-gray-500 dark:text-gray-400', 
        icon: Pause,
        iconColor: 'text-gray-500 dark:text-gray-400',
        label: 'Cancelled',
        animate: false
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.QUEUED;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className={`w-3 h-3 mr-2 ${config.iconColor} ${config.animate ? 'animate-spin' : ''}`} />
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

  const getConnectorName = (connectorId: string) => {
    const connector = connectors.find((c: Connector) => c.id === connectorId);
    return connector ? connector.name : 'Unknown Connector';
  };

  const getJobDisplayTitle = (job: Job) => {
    const sourceName = getConnectorName(job.sourceConnectorId);
    
    // For extraction jobs or jobs without destination connector
    if (job.jobType === 'EXTRACTION' || !job.destinationConnectorId) {
      return `${sourceName} → Extraction`;
    }
    
    // For migration jobs with destination
    const destinationName = getConnectorName(job.destinationConnectorId);
    return `${sourceName} → ${destinationName}`;
  };

  const handleCreateJob = async (formData: CreateJobForm) => {
    try {
      await createJobMutation.mutateAsync(formData);
      alert('Migration job created successfully!');
    } catch (error) {
      alert('Failed to create job: ' + (error as Error).message);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (window.confirm('Are you sure you want to cancel this job?')) {
      try {
        await cancelJobMutation.mutateAsync(jobId);
        alert('Job cancelled successfully');
      } catch (error) {
        alert('Failed to cancel job: ' + (error as Error).message);
      }
    }
  };

  const filteredJobs = jobs.filter((job: Job) => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      getJobDisplayTitle(job).toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.entities.some(entity => entity.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  if (jobsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Jobs</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage and monitor your data extraction and migration jobs
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

  if (jobsError) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Jobs</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage and monitor your data extraction and migration jobs
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-700 shadow rounded-lg p-6">
          <div className="text-center py-6">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Error loading jobs</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {(jobsError as Error).message}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Jobs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage and monitor your data extraction and migration jobs
          </p>
        </div>
        <button
          onClick={() => navigate('/jobs/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Job
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <span className="text-gray-500 text-sm mb-2 block">Total Jobs</span>
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl font-bold text-black dark:text-white">
                {stats.total || 0}
              </span>
              <Clock className="w-6 h-6 text-gray-400 ml-2" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <span className="text-gray-500 text-sm mb-2 block">Running</span>
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl font-bold text-black dark:text-white">
                {stats.running || 0}
              </span>
              <RefreshCw className="w-6 h-6 text-gray-400 ml-2" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <span className="text-gray-500 text-sm mb-2 block">Completed</span>
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl font-bold text-black dark:text-white">
                {stats.completed || 0}
              </span>
              <CheckCircle className="w-6 h-6 text-gray-400 ml-2" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <span className="text-gray-500 text-sm mb-2 block">Failed</span>
            <div className="flex w-full items-center justify-between">
              <span className="text-2xl font-bold text-black dark:text-white">
                {stats.failed || 0}
              </span>
              <XCircle className="w-6 h-6 text-gray-400 ml-2" />
            </div>
          </div>
        </div>
      )}

      {/* Jobs List with integrated filters */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
        <div className="px-3 py-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs..."
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
                <option value="QUEUED">Queued</option>
                <option value="RUNNING">Running</option>
                <option value="EXTRACTING">Extracting</option>
                <option value="DATA_READY">Data Ready</option>
                <option value="LOADING">Loading</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="text-center py-6">
              <Play className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No jobs yet</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating your first data extraction or migration job.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => navigate('/jobs/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Job
                </button>
              </div>
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
                          Job
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Entities
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Progress
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
                      {filteredJobs.map((job: Job) => (
                        <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {getJobDisplayTitle(job)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(job.status)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {job.entities.join(', ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {job.progress && job.progress.percentage !== undefined ? (
                              <div className="w-full">
                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                  <span>{job.progress.percentage}%</span>
                                  {job.progress.recordsProcessed && job.progress.totalRecords && (
                                    <span>{job.progress.recordsProcessed}/{job.progress.totalRecords}</span>
                                  )}
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                  <div 
                                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${job.progress.percentage}%` }}
                                  ></div>
                                </div>
                                {job.progress.currentEntity && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Processing {job.progress.currentEntity}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(job.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setSelectedJob(job)}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Details
                              </button>
                              
                              {job.status === 'DATA_READY' && (
                                <button
                                  onClick={() => {
                                    setValidationJobId(job.id);
                                    setShowValidationModal(true);
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-green-700 dark:text-green-400 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  CSV
                                </button>
                              )}
                              
                              {['QUEUED', 'RUNNING', 'EXTRACTING', 'LOADING'].includes(job.status) && (
                                <button
                                  onClick={() => handleCancelJob(job.id)}
                                  disabled={cancelJobMutation.isPending}
                                  className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 text-xs font-medium rounded-lg text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                >
                                  <Pause className="w-3 h-3 mr-1" />
                                  Cancel
                                </button>
                              )}
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
                {filteredJobs.map((job: Job) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-500 transition-colors dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {getStatusIcon(job.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                              {getJobDisplayTitle(job)}
                            </h3>
                            {getStatusBadge(job.status)}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Entities: {job.entities.join(', ')} • Created {formatDate(job.createdAt)}
                          </p>
                          {job.progress && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                  {job.progress.currentEntity && `Processing ${job.progress.currentEntity}`}
                                </span>
                                <span>
                                  {job.progress.recordsProcessed && job.progress.totalRecords && 
                                    `${job.progress.recordsProcessed}/${job.progress.totalRecords} records`
                                  }
                                </span>
                              </div>
                              {job.progress.percentage !== undefined && (
                                <div className="mt-1 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                  <div 
                                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${job.progress.percentage}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Details
                        </button>
                        
                        {job.status === 'DATA_READY' && (
                          <button
                            onClick={() => {
                              setValidationJobId(job.id);
                              setShowValidationModal(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-green-700 dark:text-green-400 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download CSV
                          </button>
                        )}
                        
                        {['QUEUED', 'RUNNING', 'EXTRACTING', 'LOADING'].includes(job.status) && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            disabled={cancelJobMutation.isPending}
                            className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 text-xs font-medium rounded-lg text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                          >
                            <Pause className="w-3 h-3 mr-1" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Job Details Modal (placeholder) */}
      {selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Job Details</h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job ID</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{selectedJob.id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Source</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">{getConnectorName(selectedJob.sourceConnectorId)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Destination</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedJob.jobType === 'EXTRACTION' || !selectedJob.destinationConnectorId 
                    ? 'Extraction (No destination)'
                    : getConnectorName(selectedJob.destinationConnectorId)
                  }
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entities</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.entities.join(', ')}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Created</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedJob.createdAt)}</p>
              </div>
              
              {selectedJob.completedAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Completed</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedJob.completedAt)}</p>
                </div>
              )}
              
              {selectedJob.status === 'FAILED' && selectedJob.error && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Error Description</label>
                  <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-700 dark:text-red-300">{selectedJob.error}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Validation Modal */}
      {showValidationModal && validationJobId && (
        <DataValidationModal
          jobId={validationJobId!}
          isOpen={showValidationModal}
          onClose={() => {
            setShowValidationModal(false);
            setValidationJobId(null);
          }}
        />
      )}
    </div>
  );
}; 