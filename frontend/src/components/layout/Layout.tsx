import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, 
  RefreshCcw,
  LogOut, 
  User,
  Menu,
  X,
  LayoutDashboard,
  Waypoints,
  Bell,
  Sun,
  Moon,
  CreditCard,
  BookOpen
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useState } from 'react';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { useTheme } from '@/contexts/ThemeContext';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Connectors', href: '/connectors', icon: Waypoints },
  { name: 'Jobs', href: '/jobs', icon: RefreshCcw },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { toasts, removeToast } = useToast();
  const { theme, toggleTheme } = useTheme();

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
            <div className="flex-shrink-0 flex items-center px-4 pb-3 border-b border-gray-200 dark:border-gray-700">
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
            
            {/* Mobile Help section */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-2 py-4">
              <button
                onClick={() => {
                  // Add help navigation when implemented
                  setSidebarOpen(false);
                }}
                className="group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left text-gray-600 hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-gray-950 dark:hover:text-white"
              >
                <BookOpen className="mr-3 h-5 w-5" />
                Help
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex-1 flex flex-col pt-3 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4 pb-3 border-b border-gray-200 dark:border-gray-700">
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
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left`}
                    >
                      <Icon className="mr-4 h-6 w-6" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>
            
            {/* Desktop Help section */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-2 py-4">
              <button
                onClick={() => {
                  // Add help navigation when implemented
                }}
                className="group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left text-gray-600 hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-gray-950 dark:hover:text-white"
              >
                <BookOpen className="mr-3 h-5 w-5" />
                Help
              </button>
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

        {/* Desktop top bar - matches ServiceSync height */}
        <div className="hidden md:block bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="pt-3 pb-3">
            <div className="px-4 sm:px-6 md:px-8">
              <div className="flex items-center h-7">
                {/* Spacer */}
                <div className="flex-1"></div>

                {/* Right side - User info, Theme switcher and notifications */}
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {user?.email}
                  </span>
                  
                  {/* User Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                      title="User menu"
                    >
                      <User className="h-5 w-5" />
                    </button>

                    {/* User Dropdown Menu */}
                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              navigate('/settings');
                              setUserDropdownOpen(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Settings className="mr-3 h-4 w-4" />
                            Settings
                          </button>
                          <button
                            onClick={() => {
                              // Add billing navigation when implemented
                              setUserDropdownOpen(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <CreditCard className="mr-3 h-4 w-4" />
                            Billing
                          </button>
                          <div className="border-t border-gray-100 dark:border-gray-600"></div>
                          <button
                            onClick={() => {
                              handleLogout();
                              setUserDropdownOpen(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <LogOut className="mr-3 h-4 w-4" />
                            Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Theme Switcher Icon */}
                  <button
                    onClick={toggleTheme}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                  >
                    {theme === 'light' ? (
                      <Moon className="h-5 w-5" />
                    ) : (
                      <Sun className="h-5 w-5" />
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setNotificationOpen(!notificationOpen)}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                      title="Notifications"
                    >
                      <Bell className="h-5 w-5" />
                      {/* Notification badge */}
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full"></span>
                    </button>

                    {/* Dropdown */}
                    {notificationOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {/* Placeholder notifications */}
                          <div className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                                  <RefreshCcw className="h-4 w-4 text-white" />
                                </div>
                              </div>
                              <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  Job completed successfully
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Migration from Freshservice to ServiceNow finished
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">2 minutes ago</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center">
                                  <Waypoints className="h-4 w-4 text-white" />
                                </div>
                              </div>
                              <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  Connector sync warning
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Device42 connector showing connection issues
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">1 hour ago</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                                  <Settings className="h-4 w-4 text-white" />
                                </div>
                              </div>
                              <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  System update available
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  New features and security improvements ready
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">3 hours ago</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                          <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium">
                            View all notifications
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-gray-50 dark:bg-gray-950">
          <div className="pt-6 pb-6">
            <div className="px-4 sm:px-6 md:px-8">
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