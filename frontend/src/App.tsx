import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Project Bridge
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Data Migration Platform
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>✅ Frontend: React + TypeScript + Vite</p>
                <p>✅ Backend: Node.js + Fastify + TypeScript</p>
                <p>✅ Database: PostgreSQL + Redis</p>
                <p>🔄 Phase 1: Development Environment Setup</p>
              </div>
            </div>
          </div>
        } />
        <Route path="*" element={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                404 - Page Not Found
              </h1>
              <p className="text-gray-600">
                The page you're looking for doesn't exist.
              </p>
            </div>
          </div>
        } />
      </Routes>
    </div>
  );
}

export default App; 