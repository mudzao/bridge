import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Download, 
  Eye, 
  Package, 
  Calendar,
  Database,
  AlertCircle,
  CheckCircle,
  FileText,
  Table,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';

interface DataValidationModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ExtractionSummary {
  jobId: string;
  extractedEntities: {
    entityType: string;
    recordCount: number;
    extractionTimestamp: Date;
    sourceSystem: string;
  }[];
  totalRecords: number;
  entityTypes: string[];
}

interface DataPreview {
  entityType: string;
  recordCount: number;
  extractionTimestamp: Date;
  sourceSystem: string;
  preview: any[];
}

export const DataValidationModal: React.FC<DataValidationModalProps> = ({
  jobId,
  isOpen,
  onClose,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [downloadingEntity, setDownloadingEntity] = useState<string | null>(null);
  const [downloadingFull, setDownloadingFull] = useState(false);

  // Get extraction summary
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['extraction-summary', jobId],
    queryFn: () => api.jobs.getExtractionSummary(jobId),
    enabled: isOpen,
  });

  // Get data preview for selected entity
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['data-preview', jobId, selectedEntity],
    queryFn: () => selectedEntity ? api.jobs.getDataPreview(jobId, selectedEntity, 10) : Promise.resolve(null),
    enabled: isOpen && !!selectedEntity,
  });

  const summary: ExtractionSummary | null = summaryData?.data || null;
  const preview: DataPreview | null = previewData?.data || null;

  // Auto-select first entity type
  useEffect(() => {
    if (summary && summary.entityTypes.length > 0 && !selectedEntity) {
      const firstEntityType = summary.entityTypes[0];
      if (firstEntityType) {
        setSelectedEntity(firstEntityType);
      }
    }
  }, [summary, selectedEntity]);

  const handleDownloadCSV = async (entityType: string) => {
    try {
      setDownloadingEntity(entityType);
      
      const response = await api.jobs.downloadCSV(jobId, entityType);
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or create default
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `${entityType}_export.csv`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
      alert('Failed to download CSV. Please try again.');
    } finally {
      setDownloadingEntity(null);
    }
  };

  const handleDownloadFullExport = async () => {
    try {
      setDownloadingFull(true);
      
      const response = await api.jobs.downloadFullExport(jobId);
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or create default
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `full_export_${new Date().toISOString().slice(0, 10)}.zip`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download full export:', error);
      alert('Failed to download full export. Please try again.');
    } finally {
      setDownloadingFull(false);
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value.toString();
    return String(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50" onClick={onClose}></div>
      <div className="relative min-h-screen flex items-start justify-center p-4">
        <div className="relative w-[95%] max-w-6xl bg-white dark:bg-gray-900 dark:border-gray-600 border shadow-lg rounded-md my-4">
          <div className="p-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Data Validation & Export</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Review extracted data and download CSV files for validation
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Error State */}
            {summaryError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Data</h4>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                      {summaryError.message || 'Failed to load extraction summary'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {summaryLoading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">Loading extraction summary...</span>
              </div>
            )}

            {/* Main Content */}
            {summary && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel - Data Preview */}
                <div className="lg:col-span-2">
                  {selectedEntity && (
                    <div className="space-y-4">
                      {/* Entity Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                            {selectedEntity} Data
                          </h4>
                          {preview && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Showing preview of {preview.recordCount.toLocaleString()} records from {preview.sourceSystem}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDownloadCSV(selectedEntity)}
                          disabled={downloadingEntity === selectedEntity}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {downloadingEntity === selectedEntity ? (
                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Download CSV
                        </button>
                      </div>

                      {/* Data Preview */}
                      {previewLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                          <span className="text-gray-600 dark:text-gray-400">Loading data preview...</span>
                        </div>
                      ) : preview && preview.preview.length > 0 ? (
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                            <div className="flex items-center">
                              <Table className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Data Preview (showing first 10 records)
                              </span>
                            </div>
                          </div>
                          <div className="overflow-x-auto max-h-96">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                  {Object.keys(preview.preview[0]).map((key) => (
                                    <th
                                      key={key}
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                                    >
                                      {key.replace(/_/g, ' ')}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-600">
                                {preview.preview.map((record, index) => (
                                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                                    {Object.values(record).map((value, cellIndex) => (
                                      <td
                                        key={cellIndex}
                                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"
                                      >
                                        <div className="max-w-xs truncate" title={formatValue(value)}>
                                          {formatValue(value)}
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                          <div className="flex">
                            <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
                            <div>
                              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">No Preview Data</h4>
                              <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                                No preview data available for {selectedEntity}. You can still download the CSV file.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Panel - Summary & Entity List */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Summary Stats */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-3">Extraction Summary</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">Total Records:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-200">{summary.totalRecords.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">Entity Types:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-200">{summary.entityTypes.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">Job ID:</span>
                        <span className="font-mono text-xs text-blue-900 dark:text-blue-200">{summary.jobId.slice(-8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Download All Button */}
                  <button
                    onClick={handleDownloadFullExport}
                    disabled={downloadingFull}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {downloadingFull ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Package className="w-4 h-4 mr-2" />
                    )}
                    Download Full Export (ZIP)
                  </button>

                  {/* Entity List */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Entity Types</h4>
                    {summary.extractedEntities.map((entity) => (
                      <div
                        key={entity.entityType}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedEntity === entity.entityType
                            ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        onClick={() => setSelectedEntity(entity.entityType)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Database className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {entity.entityType}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {entity.recordCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatTimestamp(entity.extractionTimestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Data extraction completed successfully
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 