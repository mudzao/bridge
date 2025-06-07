import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Theme
import { ThemeProvider } from '@/contexts/ThemeContext';

// Components
import { Layout } from '@/components/layout/Layout';
import { LoginForm } from '@/components/auth/LoginForm';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Pages
import { Dashboard } from '@/pages/Dashboard';
import { Connectors } from '@/pages/Connectors';
import { Jobs } from '@/pages/Jobs';
import { Settings } from '@/pages/Settings';
import { NewJobWizardPage } from '@/pages/NewJobWizardPage';

// Stores
import { useAuthStore } from '@/stores/auth.store';

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Check authentication status on app load
    checkAuth();
  }, [checkAuth]);

  return (
    <ThemeProvider>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginForm />
            } 
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Jobs */}
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/new" element={<NewJobWizardPage />} />
            
            {/* Connectors */}
            <Route path="connectors" element={<Connectors />} />
            
            {/* Settings */}
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        
        {/* React Query Devtools */}
        <ReactQueryDevtools initialIsOpen={false} />
      </div>
    </ThemeProvider>
  );
}

export default App; 