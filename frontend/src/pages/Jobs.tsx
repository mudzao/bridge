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

// Job Type enum (matching backend)
enum JobType {
  EXTRACTION = 'EXTRACTION',
  LOADING = 'LOADING',
  MIGRATION = 'MIGRATION'
}

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationJobId, setValidationJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
  const stats = statsResponse?.data || {};

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<CreateJobForm>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      jobType: 'EXTRACTION',
      entities: [],
      config: {
        batchSize: 100,
      },
    },
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: api.jobs.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-stats'] });
      setShowCreateModal(false);
      reset();
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
      QUEUED: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Queued' },
      RUNNING: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Running' },
      EXTRACTING: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Extracting' },
      DATA_READY: { bg: 'bg-green-100', text: 'text-green-800', label: 'Data Ready' },
      LOADING: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Loading' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.QUEUED;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {getStatusIcon(status)}
        <span className="ml-1">{config.label}</span>
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

  const renderCreateJobModal = () => {
    if (!showCreateModal) return null;

    const sourceConnectorId = watch('sourceConnectorId');
    const jobType = watch('jobType');

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Create {jobType === 'MIGRATION' ? 'Migration' : 'Extraction'} Job
            </h3>
            <button
              onClick={() => {
                setShowCreateModal(false);
                reset();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(handleCreateJob)} className="space-y-4">
            {/* Job Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Type</label>
              <select
                {...register('jobType')}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EXTRACTION">Data Extraction (Extract & Transform Only)</option>
                <option value="MIGRATION">Full Migration (Extract, Transform & Load)</option>
              </select>
              {errors.jobType && (
                <p className="mt-1 text-sm text-red-600">{errors.jobType.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {jobType === 'EXTRACTION' 
                  ? 'Extract and clean data for future migration. No destination system required.'
                  : 'Complete migration including loading data to target system.'}
              </p>
            </div>

            {/* Source Connector */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Source Connector</label>
              <select
                {...register('sourceConnectorId')}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select source connector...</option>
                {connectors.map((connector: Connector) => (
                  <option key={connector.id} value={connector.id}>
                    {connector.name} ({connector.connectorType})
                  </option>
                ))}
              </select>
              {errors.sourceConnectorId && (
                <p className="mt-1 text-sm text-red-600">{errors.sourceConnectorId.message}</p>
              )}
            </div>

            {/* Destination Connector - Conditional */}
            {jobType === 'MIGRATION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Destination Connector</label>
                <select
                  {...register('destinationConnectorId')}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select destination connector...</option>
                  {connectors
                    .filter((c: Connector) => c.id !== sourceConnectorId)
                    .map((connector: Connector) => (
                      <option key={connector.id} value={connector.id}>
                        {connector.name} ({connector.connectorType})
                      </option>
                    ))}
                </select>
                {errors.destinationConnectorId && (
                  <p className="mt-1 text-sm text-red-600">{errors.destinationConnectorId.message}</p>
                )}
              </div>
            )}

            {/* Entities */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Entities to {jobType === 'MIGRATION' ? 'Migrate' : 'Extract'}
              </label>
              <div className="mt-2 space-y-2">
                {['tickets', 'assets', 'users', 'groups', 'incidents'].map((entity) => (
                  <label key={entity} className="flex items-center">
                    <input
                      type="checkbox"
                      value={entity}
                      {...register('entities')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{entity}</span>
                  </label>
                ))}
              </div>
              {errors.entities && (
                <p className="mt-1 text-sm text-red-600">{errors.entities.message}</p>
              )}
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Batch Size</label>
                <input
                  type="number"
                  {...register('config.batchSize', { valueAsNumber: true })}
                  min="1"
                  max="1000"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date (Optional)</label>
                <input
                  type="date"
                  {...register('config.startDate')}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  reset();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || createJobMutation.isPending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Play className="w-4 h-4 mr-2" />
                {isSubmitting || createJobMutation.isPending ? 'Creating...' : `Create ${jobType === 'MIGRATION' ? 'Migration' : 'Extraction'}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (jobsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Jobs</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and monitor your data extraction and migration jobs
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

  if (jobsError) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Jobs</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and monitor your data extraction and migration jobs
            </p>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-6">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading jobs</h3>
            <p className="mt-1 text-sm text-gray-500">
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
          <h1 className="text-2xl font-bold text-gray-900">Data Jobs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor your data extraction and migration jobs
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Job
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Jobs</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <RefreshCw className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Running</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.running || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.completed || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Failed</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.failed || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
      </div>

      {/* Jobs List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-6">
              <Play className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first data extraction or migration job.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Job
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job: Job) => (
                <div
                  key={job.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {getStatusIcon(job.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {getJobDisplayTitle(job)}
                          </h3>
                          {getStatusBadge(job.status)}
                        </div>
                        <p className="text-sm text-gray-500">
                          Entities: {job.entities.join(', ')} • Created {formatDate(job.createdAt)}
                        </p>
                        {job.progress && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
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
                              <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${job.progress.percentage}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        )}
                        {job.error && (
                          <p className="mt-1 text-sm text-red-600">
                            Error: {job.error}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                          className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download CSV
                        </button>
                      )}
                      
                      {['QUEUED', 'RUNNING', 'EXTRACTING', 'LOADING'].includes(job.status) && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          disabled={cancelJobMutation.isPending}
                          className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      {renderCreateJobModal()}

      {/* Job Details Modal (placeholder) */}
      {selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Job Details</h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Job ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">{selectedJob.id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Source</label>
                <p className="mt-1 text-sm text-gray-900">{getConnectorName(selectedJob.sourceConnectorId)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Destination</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedJob.jobType === 'EXTRACTION' || !selectedJob.destinationConnectorId 
                    ? 'Extraction (No destination)'
                    : getConnectorName(selectedJob.destinationConnectorId)
                  }
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Entities</label>
                <p className="mt-1 text-sm text-gray-900">{selectedJob.entities.join(', ')}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(selectedJob.createdAt)}</p>
              </div>
              
              {selectedJob.completedAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Completed</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedJob.completedAt)}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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