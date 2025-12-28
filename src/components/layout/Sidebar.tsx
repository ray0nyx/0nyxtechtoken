import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart2,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LineChart,
  Settings,
  TrendingUp,
  Trophy,
  Shield,
  Copy,
  Link2,
  Target,
  Brain,
  Activity,
  AlertTriangle,
  PieChart,
  Zap,
  FileText,
  Square,
  Bitcoin,
  Wallet,
  User,
  TrendingDown,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';

const menuItems = [
  {
    title: 'Analytics',
    icon: BarChart2,
    path: '/app/analytics',
  },
  {
    title: 'Crypto Analytics',
    icon: Bitcoin,
    path: '/app/crypto-analytics',
    badge: 'Elite',
  },
  {
    title: 'Trades',
    icon: TrendingUp,
    path: '/app/trades',
  },
  {
    title: 'Journal',
    icon: BookOpen,
    path: '/app/journal',
  },
  {
    title: 'Backtesting',
    icon: BarChart2,
    path: '/app/backtesting',
  },
  {
    title: 'Performance',
    icon: LineChart,
    path: '/app/performance',
  },
  {
    title: 'Reports',
    icon: BarChart3,
    path: '/app/reports',
  },
  {
    title: 'P&L Statements & Tax',
    icon: FileText,
    path: '/app/pl-statements',
  },
  {
    title: 'Leaderboard',
    icon: Trophy,
    path: '/app/leaderboard',
  },
  {
    title: 'API Keys',
    icon: Key,
    path: '/api/keys',
  },
  {
    title: 'Settings',
    icon: Settings,
    path: '/app/settings',
  },
];

// Developer menu items (visible to developers only)
const developerMenuItems = [
  {
    title: 'QuantTesting',
    icon: Brain,
    path: '/app/quanttesting',
  },
];

// Crypto Dashboard menu items
const cryptoMenuItems = [
  {
    title: 'Wallets',
    icon: Wallet,
    path: '/crypto/wallets',
  },
  {
    title: 'Copy Trading',
    icon: User,
    path: '/crypto/copy-trading',
  },
  {
    title: 'On-Chain Analysis',
    icon: Activity,
    path: '/crypto/on-chain',
  },
  {
    title: 'Surge',
    icon: Zap,
    path: '/crypto/surge',
  },
  {
    title: 'Tokens',
    icon: TrendingDown,
    path: '/crypto/tokens',
  },
  {
    title: 'Explore',
    icon: Zap,
    path: '/crypto/explore',
  },
];

// Institutional menu items (hidden by default)
const SHOW_INSTITUTIONAL = false;
const institutionalMenuItems = [
  {
    title: 'Institutional',
    icon: Shield,
    path: '/app/institutional',
  },
  {
    title: 'Risk Dashboard',
    icon: AlertTriangle,
    path: '/app/risk-dashboard',
  },
  {
    title: 'Portfolio Management',
    icon: Target,
    path: '/app/portfolio-management',
  },
  {
    title: 'Quantitative Research',
    icon: Brain,
    path: '/app/quantitative-research',
  },
  {
    title: 'Advanced Backtesting',
    icon: BarChart2,
    path: '/app/advanced-backtesting',
  },
  {
    title: 'Performance Attribution',
    icon: PieChart,
    path: '/app/performance-attribution',
  },
  {
    title: 'Risk Monitoring',
    icon: AlertTriangle,
    path: '/app/risk-monitoring',
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed by default
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const supabase = createClient();
  const { canAccessQuantTesting } = useSubscription();

  // Check if the current user is the admin, affiliate, or developer
  useEffect(() => {
    const checkUserRoles = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if admin
        const adminIds = ["856950ff-d638-419d-bcf1-b7dac51d1c7f"];
        if (adminIds.includes(session.user.id)) {
          setIsAdmin(true);
        }

        // Check if developer (same as admin for now, but can be expanded)
        const developerIds = [
          "856950ff-d638-419d-bcf1-b7dac51d1c7f", // rayhan@arafatcapital.com
          "8538e0b7-6dcd-4673-b39f-00d273c7fc76"  // sevemadsen18@gmail.com
        ];
        if (developerIds.includes(session.user.id)) {
          setIsDeveloper(true);
        }

        // Check if affiliate
        try {
          const { data: affiliate } = await supabase
            .from('affiliates')
            .select('id')
            .eq('email', session.user.email)
            .eq('status', 'active')
            .single();

          setIsAffiliate(!!affiliate);
        } catch (error) {
          // User is not an affiliate
          setIsAffiliate(false);
        }
      }
    };

    checkUserRoles();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session) {
        const adminIds = ["856950ff-d638-419d-bcf1-b7dac51d1c7f"];
        const developerIds = [
          "856950ff-d638-419d-bcf1-b7dac51d1c7f", // rayhan@arafatcapital.com
          "8538e0b7-6dcd-4673-b39f-00d273c7fc76"  // sevemadsen18@gmail.com
        ];
        setIsAdmin(adminIds.includes(session.user.id));
        setIsDeveloper(developerIds.includes(session.user.id));

        // Check affiliate status
        try {
          const { data: affiliate } = await supabase
            .from('affiliates')
            .select('id')
            .eq('email', session.user.email)
            .eq('status', 'active')
            .single();

          setIsAffiliate(!!affiliate);
        } catch (error) {
          setIsAffiliate(false);
        }
      } else {
        setIsAdmin(false);
        setIsDeveloper(false);
        setIsAffiliate(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className={cn(
      "flex flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      isCollapsed ? "w-16" : "w-64",
      "transition-all duration-300"
    )}>
      <div className="flex h-14 items-center border-b px-4">
        <div
          className={cn(
            "flex items-center gap-2",
            isCollapsed ? "justify-center" : "justify-between w-full"
          )}
        >
          {/* Clickable Logo */}
          <div
            className="cursor-pointer flex items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={() => navigate('/app/analytics')}
          >
            <img
              src="/onyxtech-logo.png"
              alt="OnyxTech"
              className={cn(
                "h-8 w-auto transition-all duration-300",
                isCollapsed ? "h-8" : "h-8"
              )}
            />
            {!isCollapsed && (
              <span className="font-semibold text-foreground">OnyxTech</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isCollapsed ? "px-2" : "px-4"
              )}
              onClick={() => navigate(item.path)}
            >
              <item.icon className={cn(
                "h-4 w-4",
                isActive ? "text-purple-500" : "text-muted-foreground"
              )} />
              <span className={cn(
                "ml-2",
                isCollapsed ? "hidden" : "block",
                isActive ? "text-purple-500" : "text-muted-foreground"
              )}>
                {item.title}
              </span>
            </Button>
          );
        })}

        {/* Crypto Dashboard menu items - always visible */}
        <div className="mt-4 border-t pt-4">
          <div className={cn(
            "text-xs font-semibold text-muted-foreground mb-2 px-2",
            isCollapsed ? "hidden" : "block"
          )}>
            CRYPTO
          </div>
          {cryptoMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start mb-1",
                  isCollapsed ? "px-2" : "px-4"
                )}
                onClick={() => navigate(item.path)}
              >
                <item.icon className={cn(
                  "h-4 w-4",
                  isActive ? "text-purple-500" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "ml-2",
                  isCollapsed ? "hidden" : "block",
                  isActive ? "text-purple-500" : "text-muted-foreground"
                )}>
                  {item.title}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Developer menu items - only visible to developers with proper access */}
        {isDeveloper && (
          <>
            {developerMenuItems
              .filter((item) => {
                // Filter out QuantTesting for users without access
                if (item.title === 'QuantTesting' && !canAccessQuantTesting) {
                  return false;
                }
                return true;
              })
              .map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start mt-2 border-t pt-2",
                      isCollapsed ? "px-2" : "px-4"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className={cn(
                      "h-4 w-4",
                      isActive ? "text-cyan-500" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "ml-2",
                      isCollapsed ? "hidden" : "block",
                      isActive ? "text-cyan-500" : "text-muted-foreground"
                    )}>
                      {item.title}
                    </span>
                  </Button>
                );
              })}
          </>
        )}

        {/* Affiliate Dashboard - only visible to active affiliates */}
        {isAffiliate && (
          <Button
            variant={location.pathname === '/app/affiliate' ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start mt-4 border-t pt-4",
              isCollapsed ? "px-2" : "px-4"
            )}
            onClick={() => navigate('/app/affiliate')}
          >
            <Link2 className={cn(
              "h-4 w-4",
              location.pathname === '/app/affiliate' ? "text-green-500" : "text-muted-foreground"
            )} />
            <span className={cn(
              "ml-2",
              isCollapsed ? "hidden" : "block",
              location.pathname === '/app/affiliate' ? "text-green-500" : "text-muted-foreground"
            )}>
              Affiliate Dashboard
            </span>
          </Button>
        )}

        {/* Institutional Features - hidden unless SHOW_INSTITUTIONAL is enabled */}
        {SHOW_INSTITUTIONAL && (
          <div className="mt-4 border-t pt-4">
            <div className={cn(
              "text-xs font-semibold text-muted-foreground mb-2",
              isCollapsed ? "hidden" : "block"
            )}>
              INSTITUTIONAL
            </div>
            {institutionalMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start mb-1",
                    isCollapsed ? "px-2" : "px-4"
                  )}
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className={cn(
                    "h-4 w-4",
                    isActive ? "text-purple-500" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "ml-2",
                    isCollapsed ? "hidden" : "block",
                    isActive ? "text-purple-500" : "text-muted-foreground"
                  )}>
                    {item.title}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        {/* Admin link - only visible to authorized admin */}
        {isAdmin && (
          <Button
            variant={location.pathname.startsWith('/admin') ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start mt-4 border-t pt-4",
              isCollapsed ? "px-2" : "px-4"
            )}
            onClick={() => navigate('/admin')}
          >
            <Shield className={cn(
              "h-4 w-4",
              location.pathname.startsWith('/admin') ? "text-red-500" : "text-muted-foreground"
            )} />
            <span className={cn(
              "ml-2",
              isCollapsed ? "hidden" : "block",
              location.pathname.startsWith('/admin') ? "text-red-500" : "text-muted-foreground"
            )}>
              Admin Panel
            </span>
          </Button>
        )}
      </nav>
    </div>
  );
} 