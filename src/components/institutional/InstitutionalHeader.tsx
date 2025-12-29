/**
 * Institutional Header Component
 * Header for institutional backtester with celeste theme
 */

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  TrendingUp,
  Shield,
  Zap,
  Settings,
  Bell,
  User
} from 'lucide-react';

export function InstitutionalHeader() {
  const location = useLocation();

  return (
    <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Institutional Backtester
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Pro Plan Features
                </p>
              </div>
            </Link>

            <Badge
              variant="secondary"
              className="bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 border-cyan-200"
            >
              <Zap className="w-3 h-3 mr-1" />
              Pro
            </Badge>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/institutional-backtester"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === '/institutional-backtester'
                  ? 'bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 dark:from-cyan-900/20 dark:to-blue-900/20 dark:text-cyan-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
            >
              <Brain className="w-4 h-4" />
              <span>Backtester</span>
            </Link>

            <Link
              href="/copy-trading"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Copy Trading</span>
            </Link>

            <Link
              href="/risk-management"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>Risk Management</span>
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Status Indicator */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                System Online
              </span>
            </div>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                3
              </span>
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* User Menu */}
            <div className="flex items-center space-x-3 pl-4 border-l border-gray-200 dark:border-gray-700">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Pro User
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  $39.99/month
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 space-y-2">
          <Link
            href="/institutional-backtester"
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${router.pathname === '/institutional-backtester'
                ? 'bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 dark:from-cyan-900/20 dark:to-blue-900/20 dark:text-cyan-400'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
          >
            <Brain className="w-4 h-4" />
            <span>Backtester</span>
          </Link>

          <Link
            href="/copy-trading"
            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Copy Trading</span>
          </Link>

          <Link
            href="/risk-management"
            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span>Risk Management</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
