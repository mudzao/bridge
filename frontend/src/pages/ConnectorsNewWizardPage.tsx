import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NewConnectorWizard } from '@/components/NewConnectorWizard';

export const ConnectorsNewWizardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Connector</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set up a new system connector for data extraction and migration
          </p>
        </div>
        <Link
          to="/connectors"
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Connectors
        </Link>
      </div>

      {/* Wizard Content */}
      <NewConnectorWizard />
    </div>
  );
}; 