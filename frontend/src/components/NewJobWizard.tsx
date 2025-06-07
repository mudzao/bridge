import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, ChevronLeft, ChevronRight, Check, Plus, Database, Download } from 'lucide-react';
import { api } from '@/lib/api';

// Interface matching the Connectors page
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

// Entity mappings based on connector types
const entityMappings: Record<string, string[]> = {
  FRESHSERVICE: ['tickets', 'assets', 'users', 'groups'],
  SERVICENOW: ['Service Request', 'Incident', 'Asset'],
  ZENDESK: ['tickets', 'users', 'organizations'],
};

// Step definitions
const STEPS = [
  { id: 'source', label: 'Select Source' },
  { id: 'target', label: 'Select Target' },
  { id: 'entity', label: 'Select Entity' },
  { id: 'parameters', label: 'Set Parameters' },
];

// Form schema for job creation
const createJobSchema = z.object({
  jobType: z.enum(['EXTRACTION', 'MIGRATION']).optional(),
  sourceConnectorId: z.string().min(1, 'Source connector is required'),
  targetConnectorId: z.string().optional(),
  sourceEntities: z.array(z.string()).min(1, 'At least one source entity must be selected'),
  targetEntities: z.array(z.string()).default([]),
  options: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    maxRecords: z.string()
      .optional()
      .transform((val) => {
        if (!val || val.trim() === '') {
          return undefined; // Empty = extract all records
        }
        const num = parseInt(val, 10);
        if (isNaN(num)) {
          throw new Error('Must be a valid number');
        }
        return num;
      })
      .refine((val) => val === undefined || (val >= 1 && val <= 100000), {
        message: 'Must be between 1 and 100,000'
      }),
  }).default({}),
});

type CreateJobForm = z.infer<typeof createJobSchema>;

// Types for connectors - matching Prisma TenantConnector model
interface TenantConnector {
  id: string;
  name: string;
  connectorType: 'FRESHSERVICE' | 'SERVICENOW' | 'ZENDESK';
  status: 'ACTIVE' | 'DISABLED' | 'ERROR';
}

export const NewJobWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSourceConnector, setSelectedSourceConnector] = useState<string>('');
  const [selectedTargetConnector, setSelectedTargetConnector] = useState<string>('');
  const [sourceSelectionType, setSourceSelectionType] = useState<'existing' | 'new'>('existing');
  const [targetSelectionType, setTargetSelectionType] = useState<'existing' | 'new' | 'extraction-only'>('existing');
  const [extractionOnly, setExtractionOnly] = useState(false);
  const navigate = useNavigate();

  // Fetch connectors using React Query (same as Connectors page)
  const { data: connectorsResponse, isLoading, error } = useQuery({
    queryKey: ['connectors'],
    queryFn: api.connectors.getAll,
  });

  const connectors: TenantConnector[] = connectorsResponse?.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<CreateJobForm>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      sourceEntities: [],
      targetEntities: [],
      options: {},
    },
  });

  const formData = watch();

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSourceConnectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const connectorId = e.target.value;
    setSelectedSourceConnector(connectors.find(c => c.id === connectorId)?.connectorType || '');
    setValue('sourceConnectorId', connectorId);
    setValue('sourceEntities', []);
  };

  const handleTargetConnectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const connectorId = e.target.value;
    setSelectedTargetConnector(connectors.find(c => c.id === connectorId)?.connectorType || '');
    setValue('targetConnectorId', connectorId);
    setValue('targetEntities', []);
  };

  const handleFormSubmit = async (data: CreateJobForm) => {
    try {
      // Create job data with proper job type
      const jobData: any = {
        jobType: extractionOnly ? 'EXTRACTION' : 'MIGRATION',
        sourceConnectorId: data.sourceConnectorId,
        entities: data.sourceEntities,
        options: data.options,
      };
      
      // Only include destinationConnectorId for migration jobs
      if (!extractionOnly && data.targetConnectorId) {
        jobData.destinationConnectorId = data.targetConnectorId;
      }
      
      const response = await api.jobs.create(jobData);
      console.log('Job created successfully:', response);
      navigate('/jobs');
    } catch (error) {
      console.error('Error creating job:', error);
      // Handle error - you might want to show a toast notification
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.sourceConnectorId;
      case 1:
        // For extraction-only jobs, we don't need a target connector
        if (extractionOnly) {
          return true;
        }
        return formData.targetConnectorId;
      case 2:
        return formData.sourceEntities && Array.isArray(formData.sourceEntities) && formData.sourceEntities.length > 0;
      case 3:
        return true; // Parameters are optional
      default:
        return false;
    }
  };

  const getConnectorName = (connectorId: string) => {
    return connectors.find(c => c.id === connectorId)?.name || '';
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 -mx-4 sm:-mx-6 md:-mx-8"></div>
        <div className="py-4">
          <div className="flex items-center">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium mr-2 ${
                    index < currentStep
                      ? 'bg-green-600 text-white'
                      : index === currentStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`text-sm font-medium ${
                    index === currentStep
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="mx-3 w-4 h-4 text-gray-400 dark:text-gray-500" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 border-b border-gray-200 dark:border-gray-700 -mx-4 sm:-mx-6 md:-mx-8"></div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Step 1: Select Source */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Choose Source Connector</h3>
              
              {/* CTA Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSourceSelectionType('existing')}
                  className={`relative group p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border transition-all ${
                    sourceSelectionType === 'existing'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div>
                    <Database className="h-6 w-6 text-gray-400 mx-auto" />
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-lg font-medium ${
                      sourceSelectionType === 'existing'
                        ? 'text-primary-900 dark:text-primary-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      Use Existing Source
                    </h3>
                    <p className={`mt-2 text-sm ${
                      sourceSelectionType === 'existing'
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Select from your configured connector systems.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceSelectionType('new')}
                  className={`relative group p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border transition-all ${
                    sourceSelectionType === 'new'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div>
                    <Plus className="h-6 w-6 text-gray-400 mx-auto" />
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-lg font-medium ${
                      sourceSelectionType === 'new'
                        ? 'text-primary-900 dark:text-primary-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      Add New Source
                    </h3>
                    <p className={`mt-2 text-sm ${
                      sourceSelectionType === 'new'
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Configure and connect to a new helpdesk system.
                    </p>
                  </div>
                </button>
              </div>

              {/* Source Configuration Card */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                {/* Existing Source Dropdown */}
                {sourceSelectionType === 'existing' && (
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">Select Existing Connector</h4>
                    <select
                      {...register('sourceConnectorId')}
                      onChange={handleSourceConnectorChange}
                      disabled={isLoading}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isLoading ? 'Loading connectors...' : 'Select source system...'}
                      </option>
                      {!isLoading && connectors.filter(c => c.status === 'ACTIVE').map((connector) => (
                        <option key={connector.id} value={connector.id}>
                          {connector.name} ({connector.connectorType})
                        </option>
                      ))}
                    </select>
                    {error && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {error instanceof Error ? error.message : error}
                      </p>
                    )}
                    {errors.sourceConnectorId && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.sourceConnectorId.message}</p>
                    )}
                  </div>
                )}

                {/* Add New Source Form */}
                {sourceSelectionType === 'new' && (
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">Add New Connector</h4>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Adding new connectors will be available soon. For now, please use the existing configured connectors.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSourceSelectionType('existing')}
                        className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
                      >
                        Switch to existing sources
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Select Target */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Choose Target Destination</h3>
              
              {/* CTA Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setTargetSelectionType('existing');
                    setExtractionOnly(false);
                  }}
                  className={`relative group p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border transition-all ${
                    targetSelectionType === 'existing'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div>
                    <Database className="h-6 w-6 text-gray-400 mx-auto" />
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-lg font-medium ${
                      targetSelectionType === 'existing'
                        ? 'text-primary-900 dark:text-primary-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      Use Existing Target
                    </h3>
                    <p className={`mt-2 text-sm ${
                      targetSelectionType === 'existing'
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Migrate data to an existing configured system.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetSelectionType('new');
                    setExtractionOnly(false);
                  }}
                  className={`relative group p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border transition-all ${
                    targetSelectionType === 'new'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div>
                    <Plus className="h-6 w-6 text-gray-400 mx-auto" />
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-lg font-medium ${
                      targetSelectionType === 'new'
                        ? 'text-primary-900 dark:text-primary-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      Add New Target
                    </h3>
                    <p className={`mt-2 text-sm ${
                      targetSelectionType === 'new'
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Configure and connect to a new target system.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetSelectionType('extraction-only');
                    setExtractionOnly(true);
                  }}
                  className={`relative group p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border transition-all ${
                    targetSelectionType === 'extraction-only'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div>
                    <Download className="h-6 w-6 text-gray-400 mx-auto" />
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-lg font-medium ${
                      targetSelectionType === 'extraction-only'
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      Data Extraction Only
                    </h3>
                    <p className={`mt-2 text-sm ${
                      targetSelectionType === 'extraction-only'
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Extract data for analysis and export as CSV.
                    </p>
                  </div>
                </button>
              </div>

              {/* Target Configuration Card */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                {/* Existing Target Dropdown */}
                {targetSelectionType === 'existing' && (
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">Select Existing Connector</h4>
                    <select
                      {...register('targetConnectorId')}
                      onChange={handleTargetConnectorChange}
                      disabled={isLoading}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isLoading ? 'Loading connectors...' : 'Select target connector...'}
                      </option>
                      {!isLoading && connectors.filter((c: TenantConnector) => c.status === 'ACTIVE').map((connector: TenantConnector) => (
                        <option key={connector.id} value={connector.id}>
                          {connector.name} ({connector.connectorType})
                        </option>
                      ))}
                    </select>
                    {error && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {error instanceof Error ? error.message : error}
                      </p>
                    )}
                    {errors.targetConnectorId && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.targetConnectorId.message}</p>
                    )}
                  </div>
                )}

                {/* Add New Target Form */}
                {targetSelectionType === 'new' && (
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">Add New Connector</h4>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Adding new connectors will be available soon. For now, please use the existing configured connectors.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTargetSelectionType('existing')}
                        className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
                      >
                        Switch to existing targets
                      </button>
                    </div>
                  </div>
                )}

                {/* Data Extraction Only Information */}
                {targetSelectionType === 'extraction-only' && (
                  <div>
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">Data Extraction Mode</h4>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-start">
                        <Download className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                            Extract Data for Analysis
                          </h5>
                          <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                            This mode will extract data from your source system and make it available for download as CSV files. 
                            No target system is required.
                          </p>
                          <div className="text-xs text-green-700 dark:text-green-300">
                            <p className="mb-1">✓ Extract data from source system</p>
                            <p className="mb-1">✓ Transform and validate data</p>
                            <p className="mb-1">✓ Export as CSV files for analysis</p>
                            <p>✓ No target system integration needed</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Select Entity */}
          {currentStep === 2 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Available entities from {getConnectorName(formData.sourceConnectorId)}
              </label>
              <div className="grid grid-cols-1 gap-3">
                {selectedSourceConnector && entityMappings[selectedSourceConnector] ? (
                  entityMappings[selectedSourceConnector].map((entity: string) => (
                    <label key={entity} className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        value={entity}
                        {...register('sourceEntities')}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700 dark:text-gray-300 capitalize font-medium">{entity}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No entities available for this connector.</p>
                )}
              </div>
              {errors.sourceEntities && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.sourceEntities.message}</p>
              )}
            </div>
          )}

          {/* Step 4: Set Parameters */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    {...register('options.startDate')}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Extract records updated since this date
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    {...register('options.endDate')}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Extract records updated before this date
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Records (Optional)
                  </label>
                  <input
                    type="number"
                    {...register('options.maxRecords')}
                    placeholder="Leave empty for all records"
                    min="1"
                    max="100000"
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Limit total records extracted per entity (useful for testing)
                  </p>
                  {errors.options?.maxRecords && (
                    <p className="text-red-500 text-xs mt-1">{errors.options.maxRecords.message}</p>
                  )}
                </div>
              </div>

              {/* Job Configuration Summary */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Job Summary</h3>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                  <p className="text-gray-600 dark:text-gray-300">
                    <strong>Source:</strong> {getConnectorName(formData.sourceConnectorId)}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    <strong>Target:</strong> {formData.targetConnectorId ? getConnectorName(formData.targetConnectorId) : extractionOnly ? 'Data Extraction Only' : 'Not selected'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    <strong>Entities:</strong> {formData.sourceEntities.join(', ')}
                  </p>
                  {formData.options?.startDate && (
                    <p className="text-gray-600 dark:text-gray-300">
                      <strong>Start Date:</strong> {formData.options.startDate}
                    </p>
                  )}
                  {formData.options?.endDate && (
                    <p className="text-gray-600 dark:text-gray-300">
                      <strong>End Date:</strong> {formData.options.endDate}
                    </p>
                  )}
                  {formData.options?.maxRecords && (
                    <p className="text-gray-600 dark:text-gray-300">
                      <strong>Max Records:</strong> {formData.options.maxRecords.toLocaleString()} per entity
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                currentStep === 0
                  ? 'border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                  canProceed()
                    ? 'text-white bg-primary-600 hover:bg-primary-700'
                    : 'text-gray-300 dark:text-gray-600 bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting || !canProceed()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Creating Job...' : 'Create Job'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}; 