import { useState, useCallback, useEffect } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// Custom event types
declare global {
  interface WindowEventMap {
    'toast-add': CustomEvent<{ message: string; type: 'success' | 'error' }>;
    'toast-remove': CustomEvent<{ id: string }>;
  }
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Listen for toast events
  useEffect(() => {
    const handleAddToast = (event: CustomEvent<{ message: string; type: 'success' | 'error' }>) => {
      const { message, type } = event.detail;
      const id = Math.random().toString(36).substr(2, 9);
      const newToast = { id, message, type };
      
      setToasts(prev => [...prev, newToast]);
    };

    const handleRemoveToast = (event: CustomEvent<{ id: string }>) => {
      const { id } = event.detail;
      setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    window.addEventListener('toast-add', handleAddToast);
    window.addEventListener('toast-remove', handleRemoveToast);

    return () => {
      window.removeEventListener('toast-add', handleAddToast);
      window.removeEventListener('toast-remove', handleRemoveToast);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    const event = new CustomEvent('toast-remove', { detail: { id } });
    window.dispatchEvent(event);
  }, []);

  const showSuccess = useCallback((message: string) => {
    const event = new CustomEvent('toast-add', { detail: { message, type: 'success' } });
    window.dispatchEvent(event);
  }, []);

  const showError = useCallback((message: string) => {
    const event = new CustomEvent('toast-add', { detail: { message, type: 'error' } });
    window.dispatchEvent(event);
  }, []);

  return {
    toasts,
    showSuccess,
    showError,
    removeToast,
  };
}; 