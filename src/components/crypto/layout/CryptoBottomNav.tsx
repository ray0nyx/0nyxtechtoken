import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Wallet,
  Users,
  Activity,
  BarChart3,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/crypto/dashboard', icon: LayoutDashboard },
  { name: 'Wallets', href: '/crypto/wallets', icon: Wallet },
  { name: 'Copy', href: '/crypto/copy-trading', icon: Users },
  { name: 'On-Chain', href: '/crypto/on-chain', icon: Activity },
  { name: 'Tokens', href: '/crypto/tokens', icon: BarChart3 },
];

export default function CryptoBottomNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f1419] border-t border-[#1f2937] z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around py-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href ||
            (item.href !== '/crypto/dashboard' && location.pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200 min-w-[60px]',
                isActive
                  ? 'text-[#3b82f6]'
                  : 'text-[#6b7280]'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 transition-all duration-200',
                isActive && 'scale-110'
              )} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

