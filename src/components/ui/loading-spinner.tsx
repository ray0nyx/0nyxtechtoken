import React from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ 
  message = "Loading...", 
  subMessage,
  size = 'md',
  className = ""
}: LoadingSpinnerProps) {
  const { theme } = useTheme();
  
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-16 w-16', 
    lg: 'h-20 w-20'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl'
  };

  return (
    <div className={`flex flex-col justify-center items-center py-12 md:py-16 space-y-6 ${className}`}>
      <div className="relative">
        <div className={`animate-spin rounded-full ${sizeClasses[size]} border-4 border-slate-700 border-t-blue-500`}></div>
        <div className={`absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin`} 
             style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      </div>
      <div className="text-center">
        <p 
          className={`${textSizeClasses[size]} font-medium animate-pulse`}
          style={{ color: theme === 'dark' ? 'rgb(148 163 184)' : 'rgb(107 114 128)' }}
        >
          {message}
        </p>
        {subMessage && (
          <p 
            className="text-sm mt-1"
            style={{ color: theme === 'dark' ? 'rgb(107 114 128)' : 'rgb(75 85 99)' }}
          >
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
}

// Simple loading spinner for inline use
export function SimpleLoadingSpinner({ size = 'sm', className = "" }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className={`animate-spin rounded-full ${sizeClasses[size]} border-2 border-slate-300 border-t-blue-600 ${className}`}></div>
  );
}
