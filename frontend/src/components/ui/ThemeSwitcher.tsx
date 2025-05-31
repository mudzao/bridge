import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export const ThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="group flex items-center px-2 py-2 text-sm md:text-xs font-medium rounded-md w-full text-left text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-950 dark:hover:text-white transition-colors"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="mr-3 h-5 w-5" />
      ) : (
        <Sun className="mr-3 h-5 w-5" />
      )}
      <span>
        {theme === 'light' ? 'Dark mode' : 'Light mode'}
      </span>
    </button>
  );
}; 