import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import {
  LayoutDashboard,
  Wallet,
  Users,
  Activity,
  BarChart3,
  Settings,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/crypto/dashboard', icon: LayoutDashboard },
  { name: 'Wallets', href: '/crypto/wallets', icon: Wallet },
  { name: 'Copy Trading', href: '/crypto/copy-trading', icon: Users },
  { name: 'On-Chain Analysis', href: '/crypto/on-chain', icon: Activity },
  { name: 'Tokens', href: '/crypto/tokens', icon: BarChart3 },
];

export default function CryptoSidebar() {
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <aside className={cn(
      "hidden md:flex md:flex-col md:w-[180px] h-screen border-r fixed left-0 top-0 z-40",
      isDark ? "bg-[#0f1419] border-[#1f2937]" : "bg-white border-gray-200"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-teal-400 flex items-center justify-center">
          <span className="text-white font-bold text-sm">≡</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href ||
            (item.href !== '/crypto/dashboard' && location.pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? isDark
                    ? 'bg-[#1a1f2e] text-white'
                    : 'bg-gray-100 text-gray-900'
                  : isDark
                    ? 'text-[#9ca3af] hover:text-white hover:bg-[#1a1f2e]/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className={cn(
        "px-3 py-4 border-t",
        isDark ? "border-[#1f2937]" : "border-gray-200"
      )}>
        <Link
          to="/crypto/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            location.pathname === '/crypto/settings'
              ? isDark
                ? 'bg-[#1a1f2e] text-white'
                : 'bg-gray-100 text-gray-900'
              : isDark
                ? 'text-[#9ca3af] hover:text-white hover:bg-[#1a1f2e]/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}

