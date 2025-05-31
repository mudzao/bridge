import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, 
  Activity, 
  LogOut, 
  User,
  Menu,
  X,
  LayoutDashboard,
  Waypoints
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useState } from 'react';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Connectors', href: '/connectors', icon: Waypoints },
  { name: 'Jobs', href: '/jobs', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { toasts, removeToast } = useToast();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isCurrentPath = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-800 dark:bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-900">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4 pb-5 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-xl text-gray-900 dark:text-white">
                Service<span className="font-bold">Sync</span>
              </h1>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      navigate(item.href);
                      setSidebarOpen(false);
                    }}
                    className={`${
                      isCurrentPath(item.href)
                        ? 'bg-gray-100 text-black dark:bg-gray-950 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-gray-950 dark:hover:text-white'
                    } group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left`}
                  >
                    <Icon className="mr-4 h-6 w-6" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Mobile User section */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-2 py-4">
            <div className="group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left text-gray-600 dark:text-gray-300">
              <User className="mr-4 h-6 w-6" />
              <span className="truncate flex-1">
                {user?.email}
              </span>
              <button
                onClick={() => {
                  handleLogout();
                  setSidebarOpen(false);
                }}
                className="ml-2 flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Mobile Theme Switcher */}
          <div className="flex-shrink-0 px-2 pb-4">
            <ThemeSwitcher />
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4 pb-5 border-b border-gray-200 dark:border-gray-700">
                <h1 className="text-xl text-gray-900 dark:text-white">
                  Service<span className="font-bold">Sync</span>
                </h1>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1 bg-transparent">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => navigate(item.href)}
                      className={`${
                        isCurrentPath(item.href)
                          ? 'bg-gray-100 text-black dark:bg-gray-950 dark:text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-gray-950 dark:hover:text-white'
                      } group flex items-center px-2 py-2 text-xs font-medium rounded-md w-full text-left`}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>
            
            {/* Theme Switcher */}
            <div className="flex-shrink-0 px-2 pb-4">
              <ThemeSwitcher />
            </div>
            
            {/* User section */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-2 py-4">
              <div className="group flex items-center px-2 py-2 text-xs font-medium rounded-md w-full text-left text-gray-600 dark:text-gray-300">
                <User className="mr-3 h-5 w-5" />
                <span className="truncate flex-1">
                  {user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="ml-2 flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white dark:bg-gray-800">
          <button
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-gray-50 dark:bg-gray-950">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      
      {/* Global Toast Container - Fixed positioned */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}; 