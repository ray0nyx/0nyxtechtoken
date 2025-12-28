import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileCode,
  BarChart3,
  Settings,
  TrendingUp,
  Play,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/app/quant',
  },
  {
    title: 'Algorithms',
    icon: FileCode,
    path: '/app/quant/algorithms',
  },
  {
    title: 'Backtest Analysis',
    icon: BarChart3,
    path: '/app/quant/backtests',
  },
  {
    title: 'Optimization',
    icon: TrendingUp,
    path: '/app/quant/optimization',
  },
  {
    title: 'Deployment',
    icon: Play,
    path: '/app/quant/deployment',
  },
  {
    title: 'Equity Chart',
    icon: BarChart3,
    path: '/app/quant/chart',
  },
  {
    title: 'Settings',
    icon: Settings,
    path: '/app/quant/settings',
  },
];

// Mobile navigation items (first 4 primary links: Dashboard, Algorithms, Backtests, Chart)
const mobileMenuItems = [
  menuItems[0], // Dashboard
  menuItems[1], // Algorithms
  menuItems[2], // Backtest Analysis
  menuItems[5], // Equity Chart
];

interface QuantSidebarProps {
  onCollapseChange?: (isCollapsed: boolean) => void;
}

export default function QuantSidebar({ onCollapseChange }: QuantSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapseChange) {
      onCollapseChange(newState);
    }
  };

  const isActive = (path: string) => {
    if (path === '/app/quant') {
      return location.pathname === '/app/quant' || location.pathname === '/app/quant/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-[#1a1f2e] border-r border-[#1f2937] h-screen fixed left-0 top-0 z-40 transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <div className="p-4 border-b border-[#1f2937] flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-xl font-bold text-white">Quant Backtester</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleCollapse}
            className="h-8 w-8 text-[#9ca3af] hover:text-white hover:bg-[#0f1419]"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Back to Dashboard Button */}
        <div className="p-2 border-b border-[#1f2937]">
          <Button
            variant="ghost"
            onClick={() => navigate('/app/analytics')}
            className={cn(
              "w-full flex items-center gap-3 text-sm font-medium transition-colors",
              isCollapsed ? "justify-center px-2" : "px-4",
              "text-[#9ca3af] hover:bg-[#0f1419] hover:text-white"
            )}
            title="Back to Analytics Dashboard"
          >
            <ArrowLeft className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>Back to Dashboard</span>}
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3',
                  active
                    ? 'bg-[#0ea5e9] text-white'
                    : 'text-[#9ca3af] hover:bg-[#0f1419] hover:text-white'
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1f2e] border-t border-[#1f2937] z-50">
        <div className="grid grid-cols-4 h-16">
          {mobileMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                  active
                    ? 'text-[#0ea5e9]'
                    : 'text-[#9ca3af]'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{item.title}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Menu Button (for accessing all items) */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-[#1a1f2e] text-white border border-[#1f2937]"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Full Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-[#1a1f2e] border-l border-[#1f2937] p-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Menu</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-[#0ea5e9] text-white'
                        : 'text-[#9ca3af] hover:bg-[#0f1419] hover:text-white'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

