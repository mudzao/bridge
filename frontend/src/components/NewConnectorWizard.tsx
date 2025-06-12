import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Check, Plus, Database, Server, TestTube, CheckCircle, XCircle, Settings } from 'lucide-react';
import { api } from '@/lib/api';

// Icon mapping for connector types
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Server: Server,
  Database: Database,
  Plus: Plus,
  Settings: Settings,
};

// Step definitions
const STEPS = [
  { id: 'system', label: 'Select System' },
  { id: 'parameters', label: 'Set Parameters' },
  { id: 'test', label: 'Save & Test' },
];

// Dynamic form schema - will be built based on selected connector
const createBaseConnectorSchema = z.object({
  connectorType: z.string().min(1, 'Connector type is required'),
  name: z.string().min(1, 'Connector name is required'),
  config: z.record(z.any()).optional(),
});

type CreateConnectorForm = z.infer<typeof createBaseConnectorSchema>;

// Helper function to render form field based on schema definition
const renderFormField = (
  fieldName: string, 
  fieldSchema: any, 
  register: any, 
  errors: any, 
  defaultValue?: string
) => {
  const fieldKey = `config.${fieldName}`;
  const error = errors.config?.[fieldName];
  const isRequired = fieldSchema.required;
  const isSensitive = fieldSchema.sensitive;
  
  const baseClasses = "block w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white";

  return (
    <div key={fieldName}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {fieldSchema.description || fieldName} {isRequired && '*'}
      </label>
      
      {fieldSchema.enum ? (
        // Dropdown for enum fields
        <select
          {...register(fieldKey)}
          className={baseClasses}
          defaultValue={defaultValue || fieldSchema.default}
        >
          {fieldSchema.enum.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : fieldSchema.type === 'boolean' ? (
        // Checkbox for boolean fields
        <div className="flex items-center">
          <input
            {...register(fieldKey)}
            type="checkbox"
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            defaultChecked={defaultValue === 'true' || fieldSchema.default === true}
          />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {fieldSchema.description || 'Enable this option'}
          </span>
        </div>
      ) : (
        // Text input for other fields
        <input
          {...register(fieldKey)}
          type={isSensitive ? 'password' : 'text'}
          placeholder={fieldSchema.placeholder || `Enter ${fieldSchema.description || fieldName}`}
          className={baseClasses}
          defaultValue={defaultValue || fieldSchema.default}
        />
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error.message}</p>
      )}
      
      {fieldSchema.help && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {fieldSchema.help}
        </p>
      )}
    </div>
  );
};

export const NewConnectorWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedConnectorType, setSelectedConnectorType] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const navigate = useNavigate();

  // Fetch available connector types from API
  const { data: connectorTypesResponse, isLoading: typesLoading, error: typesError } = useQuery({
    queryKey: ['connector-types'],
    queryFn: api.connectors.getTypes,
  });

  const connectorTypes = connectorTypesResponse?.data || [];

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: api.connectors.testConfig,
    onSuccess: (result) => {
      setTestResult(result.data);
    },
    onError: (error: any) => {
      setTestResult({
        success: false,
        message: error?.response?.data?.message || error.message || 'Connection test failed',
        details: error?.response?.data?.details || error
      });
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<CreateConnectorForm>({
    resolver: zodResolver(createBaseConnectorSchema),
    defaultValues: {
      config: {},
    },
  });

  const formData = watch();

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleConnectorTypeChange = (connectorType: string) => {
    setSelectedConnectorType(connectorType);
    setValue('connectorType', connectorType);
  };

  const handleFormSubmit = async (data: CreateConnectorForm) => {
    try {
      const response = await api.connectors.create(data);
      console.log('Connector created successfully:', response);
      
      // Redirect to connectors list
      navigate('/connectors');
    } catch (error) {
      console.error('Error creating connector:', error);
      // Handle error - you might want to show a toast notification
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.connectorType;
      case 1:
        return formData.name;
      case 2:
        return true; // Test step is optional
      default:
        return false;
    }
  };

  const getConnectorTypeInfo = (type: string) => {
    return connectorTypes.find((t: any) => t.id === type);
  };

  const handleTestConnection = async () => {
    if (!formData.connectorType || !formData.config) {
      return;
    }

    setTestResult(null); // Clear previous results
    
    await testConnectionMutation.mutateAsync({
      connectorType: formData.connectorType,
      config: formData.config
    });
  };

  // Get the selected connector's metadata
  const selectedConnectorInfo = getConnectorTypeInfo(selectedConnectorType);
  const configSchema = selectedConnectorInfo?.configSchema || {};

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="border-b border-gray-200 dark:border-gray-700">
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
                    {index < currentStep ? <Check className="w-3 h-3" /> : index + 1}
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
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Step 1: Select System */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Choose System Type</h3>
              
              {/* System Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {typesLoading ? (
                  <div className="col-span-3 text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">Loading connector types...</div>
                  </div>
                ) : typesError ? (
                  <div className="col-span-3 text-center py-8">
                    <div className="text-red-600 dark:text-red-400">Failed to load connector types</div>
                  </div>
                ) : connectorTypes.length === 0 ? (
                  <div className="col-span-3 text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">No connector types available</div>
                  </div>
                ) : (
                  connectorTypes.map((type: any) => {
                    const IconComponent = ICON_MAP[type.icon] || Server;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleConnectorTypeChange(type.id)}
                        className={`relative group p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border transition-all ${
                          selectedConnectorType === type.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <div>
                          <IconComponent className="h-6 w-6 text-gray-400 mx-auto" />
                        </div>
                        <div className="mt-4">
                          <h3 className={`text-lg font-medium ${
                            selectedConnectorType === type.id
                              ? 'text-primary-900 dark:text-primary-100'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {type.name}
                          </h3>
                          <p className={`mt-2 text-sm ${
                            selectedConnectorType === type.id
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {type.description}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 2: Set Parameters - Now Dynamic! */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configure Connection Parameters</h3>
              
              {/* Connection Configuration Card */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                  {selectedConnectorInfo?.name} Configuration
                </h4>
                
                <div className="space-y-4">
                  {/* Connector Name - Always present */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Connector Name *
                    </label>
                    <input
                      {...register('name')}
                      type="text"
                      placeholder={`e.g., Production ${selectedConnectorInfo?.name || 'System'}`}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                    />
                    {errors.name && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Dynamic Configuration Fields */}
                  {Object.entries(configSchema).map(([fieldName, fieldSchema]: [string, any]) => 
                    renderFormField(fieldName, fieldSchema, register, errors)
                  )}

                  {/* Show message if no config fields */}
                  {Object.keys(configSchema).length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-gray-500 dark:text-gray-400">
                        No additional configuration required for this connector.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Save & Test */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Review and Save Connector</h3>
              
              {/* Review Configuration Card */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">Configuration Summary</h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">System Type:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedConnectorInfo?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formData.name || 'Not specified'}
                    </span>
                  </div>
                  {/* Dynamic configuration summary */}
                  {formData.config && Object.entries(formData.config).map(([key, value]) => {
                    if (!value || typeof value !== 'string') return null;
                    const fieldSchema = configSchema[key];
                    const isSensitive = fieldSchema?.sensitive;
                    
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {fieldSchema?.description || key}:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {isSensitive ? '••••••••' : value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Test Connection Card */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">Test Connection</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Test your configuration before saving the connector.
                </p>
                
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testConnectionMutation.isPending || !formData.connectorType || !formData.config}
                    className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                      testConnectionMutation.isPending
                        ? 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                  </button>

                  {/* Test Results */}
                  {testResult && (
                    <div className={`p-4 rounded-lg border ${
                      testResult.success
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    }`}>
                      <div className="flex items-start">
                        {testResult.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-3 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <h5 className={`text-sm font-medium ${
                            testResult.success
                              ? 'text-green-800 dark:text-green-200'
                              : 'text-red-800 dark:text-red-200'
                          }`}>
                            {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                          </h5>
                          <p className={`text-sm mt-1 ${
                            testResult.success
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}>
                            {testResult.message}
                          </p>
                          {testResult.details && testResult.success && (
                            <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                              {testResult.details.domain && <div>Domain: {testResult.details.domain}</div>}
                              {testResult.details.user && <div>User: {testResult.details.user}</div>}
                              {testResult.details.apiVersion && <div>API Version: {testResult.details.apiVersion}</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg ${
                currentStep === 0
                  ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                  : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                  canProceed()
                    ? 'text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
                    : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                } focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit(handleFormSubmit)}
                disabled={isSubmitting || !canProceed()}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                  canProceed() && !isSubmitting
                    ? 'text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
                    : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                } focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                {isSubmitting ? 'Creating...' : 'Create Connector'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}; 