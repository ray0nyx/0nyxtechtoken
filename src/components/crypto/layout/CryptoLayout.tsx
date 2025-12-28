import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CryptoSidebar from './CryptoSidebar';
import CryptoBottomNav from './CryptoBottomNav';
import CryptoHeader from './CryptoHeader';
import { useTheme } from '@/components/ThemeProvider';
import '@/styles/crypto-theme.css';

const pageTitles: Record<string, string> = {
  '/crypto/dashboard': 'Dashboard',
  '/crypto/wallets': 'Wallets',
  '/crypto/copy-trading': 'Copy Trading',
  '/crypto/on-chain': 'On-Chain Analysis',
  '/crypto/tokens': 'Tokens',
  '/crypto/settings': 'Settings',
};

export default function CryptoLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0e17]' : 'bg-gray-50'}`}>
      {/* Desktop Sidebar */}
      <CryptoSidebar />

      {/* Main content area */}
      <div className="md:ml-[180px] min-h-screen flex flex-col">
        {/* Header */}
        <CryptoHeader title={title} />

        {/* Page content */}
        <main className={`flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto crypto-scrollbar ${isDark ? '' : 'bg-gray-50'}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <CryptoBottomNav />
    </div>
  );
}

