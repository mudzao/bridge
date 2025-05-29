import { useState, useEffect, useRef, useCallback } from 'react';

export interface JobProgressData {
  progress?: number;
  status?: string;
  message?: string;
  phase?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  currentEntity?: string;
  error?: string;
  estimatedCompletion?: string;
}

export interface JobProgressEvent {
  type: 'progress' | 'status' | 'error' | 'complete' | 'connection' | 'heartbeat';
  data: JobProgressData;
  timestamp: string;
}

export interface UseJobProgressReturn {
  progressData: JobProgressData | null;
  isConnected: boolean;
  error: string | null;
  connect: (jobId: string) => void;
  disconnect: () => void;
  retry: () => void;
}

export const useJobProgress = (): UseJobProgressReturn => {
  const [progressData, setProgressData] = useState<JobProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('Disconnecting from job progress stream');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    currentJobIdRef.current = null;
    retryCountRef.current = 0;
  }, []);

  const connect = useCallback((jobId: string) => {
    console.log(`Connecting to job progress stream for job ${jobId}`);
    
    // Disconnect existing connection
    disconnect();
    
    currentJobIdRef.current = jobId;
    setError(null);
    
    try {
      // Get auth token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Create EventSource with auth header (using custom approach)
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/jobs/${jobId}/stream`;
      const eventSource = new EventSource(url);
      
      // Note: EventSource doesn't support custom headers directly
      // We'll need to handle auth via URL params or use a different approach
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection established');
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const progressEvent: JobProgressEvent = JSON.parse(event.data);
          console.log('Received progress event:', progressEvent);
          
          if (progressEvent.type === 'heartbeat') {
            // Handle heartbeat - just update connection status
            return;
          }
          
          if (progressEvent.type === 'connection') {
            console.log('Connection established:', progressEvent.data.message);
            return;
          }
          
          // Update progress data
          setProgressData(progressEvent.data);
          
        } catch (error) {
          console.error('Error parsing SSE event:', error);
        }
      };

      eventSource.onerror = (event) => {
        console.error('SSE connection error:', event);
        setIsConnected(false);
        
        // Implement exponential backoff retry
        if (retryCountRef.current < 5) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          console.log(`Retrying SSE connection in ${retryDelay}ms (attempt ${retryCountRef.current + 1})`);
          
          retryTimeoutRef.current = setTimeout(() => {
            retryCountRef.current++;
            if (currentJobIdRef.current) {
              connect(currentJobIdRef.current);
            }
          }, retryDelay);
        } else {
          setError('Failed to establish connection after multiple attempts');
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      setError('Failed to connect to progress stream');
    }
  }, [disconnect]);

  const retry = useCallback(() => {
    if (currentJobIdRef.current) {
      retryCountRef.current = 0;
      connect(currentJobIdRef.current);
    }
  }, [connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    progressData,
    isConnected,
    error,
    connect,
    disconnect,
    retry,
  };
}; 