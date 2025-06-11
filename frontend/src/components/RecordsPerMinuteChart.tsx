import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Clock, Pause } from 'lucide-react';
import { api } from '@/lib/api';

interface MinuteProgress {
  minute: string;           // "14:32"
  recordsRetrieved: number; // 60
  status: 'normal' | 'paused' | 'rate_limited';
}

interface RecordsPerMinuteChartProps {
  jobId: string;
  jobStatus: string;
  job?: {
    createdAt: string;
    completedAt?: string;
  };
}

export const RecordsPerMinuteChart: React.FC<RecordsPerMinuteChartProps> = ({ 
  jobId, 
  jobStatus,
  job
}) => {
  const [chartData, setChartData] = useState<MinuteProgress[]>([]);

  // Fetch minute-by-minute progress data
  const { data: progressData, isLoading } = useQuery({
    queryKey: ['job-minute-progress', jobId],
    queryFn: () => api.jobs.getMinuteProgress?.(jobId) || Promise.resolve({ data: [] }),
    enabled: !!jobId,
    refetchInterval: jobStatus === 'EXTRACTING' ? 60000 : false, // Refresh every minute for active jobs
  });

  // Helper function to format date in the requested format
  const formatJobDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
    return `${month}-${day}, ${time}`;
  };

  // Helper function to format status text
  const formatStatusText = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'Queued';
      case 'RUNNING': return 'Running';
      case 'EXTRACTING': return 'Extracting Data';
      case 'DATA_READY': return 'Extraction Complete';
      case 'LOADING': return 'Loading Data';
      case 'COMPLETED': return 'Completed';
      case 'FAILED': return 'Failed';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'RUNNING':
      case 'EXTRACTING':
      case 'LOADING':
        return 'text-blue-600 dark:text-blue-400';
      case 'DATA_READY':
      case 'COMPLETED':
        return 'text-green-600 dark:text-green-400';
      case 'FAILED':
        return 'text-red-600 dark:text-red-400';
      case 'CANCELLED':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Helper function to get status badge classes
  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'QUEUED':
        return `${baseClasses} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200`;
      case 'RUNNING':
      case 'EXTRACTING':
      case 'LOADING':
        return `${baseClasses} bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200`;
      case 'DATA_READY':
      case 'COMPLETED':
        return `${baseClasses} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200`;
      case 'FAILED':
        return `${baseClasses} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200`;
      case 'CANCELLED':
        return `${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300`;
      default:
        return `${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300`;
    }
  };

  // Update chart data when new progress comes in
  useEffect(() => {
    if (progressData?.data) {
      setChartData(progressData.data);
    }
  }, [progressData]);

  // Generate mock data for demo purposes
  useEffect(() => {
    if (jobStatus === 'EXTRACTING') {
      const now = new Date();
      const startTime = new Date(now.getTime() - (5 * 60 * 1000)); // Start 5 minutes ago
      
      // Initialize with some mock historical data
      const mockData: MinuteProgress[] = [];
      for (let i = 0; i < 6; i++) {
        const time = new Date(startTime.getTime() + (i * 60 * 1000));
        const minute = time.toISOString().substring(11, 16);
        mockData.push({
          minute,
          recordsRetrieved: Math.floor(Math.random() * 40) + 20, // 20-60 records
          status: 'normal'
        });
      }
      
      setChartData(mockData);

      // Simulate adding a new minute every 60 seconds
      const interval = setInterval(() => {
        const newMinute = new Date().toISOString().substring(11, 16);
        setChartData(prev => {
          const exists = prev.find(p => p.minute === newMinute);
          if (!exists) {
            return [...prev, {
              minute: newMinute,
              recordsRetrieved: Math.floor(Math.random() * 40) + 20, // 20-60 records
              status: 'normal'
            }];
          }
          return prev;
        });
      }, 60000);

      return () => clearInterval(interval);
    } else if (jobStatus === 'COMPLETED' || jobStatus === 'DATA_READY') {
      // Show final timeline for completed jobs
      const mockFinalData: MinuteProgress[] = [];
      const baseTime = new Date('2024-01-15T14:30:00Z');
      
      for (let i = 0; i < 8; i++) {
        const time = new Date(baseTime.getTime() + (i * 60 * 1000));
        const minute = time.toISOString().substring(11, 16);
        mockFinalData.push({
          minute,
          recordsRetrieved: Math.floor(Math.random() * 50) + 30,
          status: 'normal'
        });
      }
      
      setChartData(mockFinalData);
    }
  }, [jobStatus]);

  // Pad chart data to ensure full width (minimum bars to span full width)
  const getPaddedChartData = (data: MinuteProgress[]) => {
    // Calculate bars needed for full width: container ~800px / (bar 16px + spacing 4px) = ~40 bars
    const minBars = 35; // Enough bars to span full width with normal spacing
    if (data.length >= minBars) {
      return data;
    }

    const paddedData = [...data];
    const lastElement = data.length > 0 ? data[data.length - 1] : null;
    const lastTime = lastElement ? new Date(`2024-01-01T${lastElement.minute}:00`) : new Date('2024-01-01T14:30:00');
    
    // Add empty slots to reach minimum bars for full width
    for (let i = data.length; i < minBars; i++) {
      const futureTime = new Date(lastTime.getTime() + ((i - data.length + 1) * 60 * 1000));
      const minute = futureTime.toISOString().substring(11, 16);
      paddedData.push({
        minute,
        recordsRetrieved: 0,
        status: 'normal'
      });
    }
    
    return paddedData;
  };

  if (isLoading && chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading progress data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Job Progress
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {jobStatus === 'EXTRACTING' 
                ? 'Chart will update as extraction progresses...' 
                : 'No progress data available'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  const paddedChartData = getPaddedChartData(chartData);
  const maxRecords = Math.max(...paddedChartData.map(d => d.recordsRetrieved));
  const chartHeight = 160;

  return (
    <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
      {/* Header with title on left and status on right */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Job Progress
        </h3>
        
        {/* Job Status - positioned on the right */}
        <div className="flex items-center text-sm">
          <span className={getStatusBadge(jobStatus)}>
            {formatStatusText(jobStatus)}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-6">
        {/* Legend - positioned on the left */}
        <div className="flex flex-col space-y-3 text-xs flex-shrink-0">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 dark:bg-blue-400 rounded mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">Normal Processing</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-amber-500 dark:bg-orange-500 rounded mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">Rate Limited / Paused</span>
          </div>
        </div>

        {/* Chart Container */}
        <div className="relative flex-1">
          {/* Chart Container - Full Width with Normal Spacing */}
          <div className="flex items-end justify-center space-x-1 w-full overflow-hidden" style={{ height: chartHeight }}>
            {paddedChartData.map((data, index) => {
              const barHeight = maxRecords > 0 ? (data.recordsRetrieved / maxRecords) * chartHeight : 0;
              
              // For paused/rate-limited bars with 0 records, use minimum height of 10 units
              const finalBarHeight = data.status === 'paused' || data.status === 'rate_limited' 
                ? data.recordsRetrieved === 0 ? 10 : Math.max(barHeight, 4)
                : data.recordsRetrieved > 0 ? Math.max(barHeight, 4) : 0;
              
              const barColor = data.status === 'paused' || data.status === 'rate_limited' 
                ? 'bg-amber-500 dark:bg-orange-500'
                : data.recordsRetrieved === 0 
                  ? 'bg-gray-200 dark:bg-gray-700' // Empty/future slots
                  : 'bg-blue-500 dark:bg-blue-400';

              const tooltipText = data.recordsRetrieved > 0 
                ? `${data.recordsRetrieved} records${data.status !== 'normal' ? ' (rate limited)' : ''}`
                : data.status === 'paused' || data.status === 'rate_limited' 
                  ? 'Paused/Rate Limited'
                  : 'No data';

              return (
                <div 
                  key={`${data.minute}-${index}`} 
                  className="flex flex-col items-center"
                >
                  {/* Bar */}
                  <div
                    className={`${barColor} rounded-t-sm transition-all duration-500 flex items-end justify-center relative group cursor-pointer`}
                    style={{ 
                      height: finalBarHeight,
                      width: '16px' // Fixed width
                    }}
                    title={tooltipText}
                  >
                    {/* Tooltip */}
                    {(data.recordsRetrieved > 0 || data.status === 'paused' || data.status === 'rate_limited') && (
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none z-10 transition-opacity whitespace-nowrap">
                        {data.recordsRetrieved > 0 ? `${data.recordsRetrieved} records` : 'Paused'}
                        {data.status !== 'normal' && data.recordsRetrieved > 0 && <br />}
                        {data.status === 'rate_limited' && data.recordsRetrieved > 0 && 'Rate Limited'}
                        {data.status === 'paused' && data.recordsRetrieved > 0 && 'Paused'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Full width horizontal baseline - positioned at bottom of bars */}
          <div className="w-full h-px bg-gray-300 dark:bg-gray-600"></div>
          
          {/* Date/Time Labels */}
          {job && paddedChartData.length > 0 && (
            <div className="relative mt-2">
              {(() => {
                // Find first bar with actual records extracted from the original chartData
                const firstDataIndex = chartData.findIndex(bar => bar.recordsRetrieved > 0);
                // Find last bar with actual records extracted from the original chartData
                const lastDataIndex = chartData.map((bar, index) => bar.recordsRetrieved > 0 ? index : -1).filter(index => index !== -1).pop() ?? -1;
                
                // Calculate chart positioning
                const barWidth = 16;
                const barSpacing = 4; // space-x-1
                const totalBarWidth = barWidth + barSpacing;
                const totalChartWidth = paddedChartData.length * totalBarWidth - barSpacing; // Remove last spacing
                
                // Since the chart uses justify-center, we need to account for the centering offset
                const containerWidth = 100; // Approximate percentage, will use CSS calc
                
                return (
                  <>
                    {/* Start Date - centered under first bar with records */}
                    {firstDataIndex !== -1 && (
                      <div 
                        className="absolute text-xs text-gray-500 dark:text-gray-400"
                        style={{ 
                          left: `calc(50% - ${totalChartWidth/2}px + ${firstDataIndex * totalBarWidth + barWidth/2}px)`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        {formatJobDate(job.createdAt)}
                      </div>
                    )}
                    
                    {/* End Date - centered under last bar with records */}
                    {lastDataIndex !== -1 && (
                      <div 
                        className="absolute text-xs text-gray-500 dark:text-gray-400"
                        style={{ 
                          left: `calc(50% - ${totalChartWidth/2}px + ${lastDataIndex * totalBarWidth + barWidth/2}px)`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        {job.completedAt ? formatJobDate(job.completedAt) : formatJobDate(new Date(new Date(job.createdAt).getTime() + (8 * 60 * 1000)).toISOString())}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 