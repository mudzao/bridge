import React, { useEffect } from 'react';
import { useJobProgress, JobProgressData } from '@/hooks/useJobProgress';

interface JobProgressMonitorProps {
  jobId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export const JobProgressMonitor: React.FC<JobProgressMonitorProps> = ({
  jobId,
  onComplete,
  onError,
}) => {
  const { progressData, isConnected, error, connect, disconnect, retry } = useJobProgress();

  useEffect(() => {
    if (jobId) {
      connect(jobId);
    }
    
    return () => {
      disconnect();
    };
  }, [jobId, connect, disconnect]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  useEffect(() => {
    if (progressData?.status === 'COMPLETED' || progressData?.status === 'DATA_READY') {
      if (onComplete) {
        onComplete();
      }
    }
  }, [progressData?.status, onComplete]);

  if (!progressData && !isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">Connecting to progress stream...</span>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600">{error}</span>
              <button
                onClick={retry}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center space-x-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-gray-600">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Progress Information */}
      {progressData && (
        <div className="space-y-3">
          {/* Status and Message */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <StatusIcon {...(progressData.status ? { status: progressData.status } : {})} />
              <span className="font-medium text-gray-900">
                {progressData.status || 'Processing'}
              </span>
            </div>
            {progressData.progress !== undefined && (
              <span className="text-sm text-gray-500">
                {Math.round(progressData.progress)}%
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {progressData.progress !== undefined && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  progressData.status === 'FAILED' 
                    ? 'bg-red-500' 
                    : progressData.status === 'COMPLETED' || progressData.status === 'DATA_READY'
                    ? 'bg-green-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${progressData.progress}%` }}
              ></div>
            </div>
          )}

          {/* Current Message */}
          {progressData.message && (
            <p className="text-sm text-gray-600">{progressData.message}</p>
          )}

          {/* Phase and Entity Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {progressData.phase && (
              <div>
                <span className="text-gray-500">Phase:</span>
                <span className="ml-1 font-medium text-gray-900 capitalize">
                  {progressData.phase}
                </span>
              </div>
            )}
            {progressData.currentEntity && (
              <div>
                <span className="text-gray-500">Processing:</span>
                <span className="ml-1 font-medium text-gray-900 capitalize">
                  {progressData.currentEntity}
                </span>
              </div>
            )}
          </div>

          {/* Record Counts */}
          {(progressData.recordsProcessed !== undefined || progressData.totalRecords !== undefined) && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-500">Records:</span>
              <span className="ml-1 font-medium">
                {progressData.recordsProcessed || 0}
                {progressData.totalRecords && ` / ${progressData.totalRecords}`}
              </span>
            </div>
          )}

          {/* Error Message */}
          {progressData.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{progressData.error}</p>
            </div>
          )}

          {/* Estimated Completion */}
          {progressData.estimatedCompletion && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-500">Estimated completion:</span>
              <span className="ml-1 font-medium">{progressData.estimatedCompletion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatusIcon: React.FC<{ status?: string }> = ({ status }) => {
  switch (status) {
    case 'COMPLETED':
    case 'DATA_READY':
      return <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>;
    case 'FAILED':
      return <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>;
    case 'EXTRACTING':
    case 'RUNNING':
    case 'LOADING':
      return <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>;
    default:
      return <div className="w-4 h-4 bg-gray-400 rounded-full"></div>;
  }
}; 