import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  LineChart,
  NotebookPen,
  BookMarked,
  Bell,
  Plus,
  BarChart3,
  Moon,
  Sun,
  Settings as SettingsIcon,
  TrendingUp,
  Users,
  Wallet,
  Copy,
  Activity,
  TrendingDown,
  Coins,
  BarChart2,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/providers/theme-provider";
import { useAffiliate } from "@/hooks/useAffiliate";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { isAffiliate, loading: affiliateLoading } = useAffiliate();

  const navigation = [
    {
      name: "Add Trade",
      icon: Plus,
      href: "/app/add-trade",
      variant: "default" as const,
      showText: true,
    },
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      href: "/app/dashboard",
      current: true,
    },
    {
      name: "Daily Journal",
      icon: BookOpen,
      href: "/app/journal",
    },
    {
      name: "Trades",
      icon: LineChart,
      href: "/app/trades",
    },
    {
      name: "Backtesting",
      icon: TrendingUp,
      href: "/app/backtesting",
    },
    {
      name: "Notebook",
      icon: NotebookPen,
      href: "/app/notebook",
    },
    {
      name: "Reports",
      icon: BarChart3,
      href: "/app/reports",
    },
    {
      name: "Playbooks",
      icon: BookMarked,
      href: "/app/playbooks",
    },
  ];

  // Crypto navigation items
  const cryptoNavigation = [
    {
      name: "Crypto Dashboard",
      icon: Coins,
      href: "/crypto/dashboard",
    },
    {
      name: "Crypto Wallets",
      icon: Wallet,
      href: "/crypto/wallets",
    },
    {
      name: "Copy Trading",
      icon: Copy,
      href: "/crypto/copy-trading",
    },
    {
      name: "On-Chain Analysis",
      icon: Activity,
      href: "/crypto/on-chain",
    },
    {
      name: "Tokens",
      icon: BarChart2,
      href: "/crypto/tokens",
    },
  ];

  // Add affiliate navigation item if user is an approved affiliate
  const allNavigation = isAffiliate ? [
    ...navigation,
    {
      name: "Affiliates",
      icon: Users,
      href: "/app/affiliate",
      isAffiliate: true,
    },
  ] : navigation;

  return (
    <div className="flex h-screen flex-col gap-y-5 bg-[#121212] w-[60px] hover:w-[240px] transition-all duration-300 group fixed top-0 left-0 z-40">
      <div className="flex h-16 shrink-0 items-center px-3">
        <img
          className="h-8 w-8"
          src="/traderlog-icon.png"
          alt="TraderLog"
        />
        <span className="ml-3 text-xl font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          TRADERLOG
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 overflow-y-auto">
        {allNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "group/item flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6",
                location.pathname === item.href
                  ? "bg-[#1c1c1c] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#1c1c1c]",
                item.variant === "default" && "bg-indigo-600 text-white hover:bg-indigo-500"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Crypto Section Separator */}
        <div className="my-2 border-t border-gray-700" />

        {/* Crypto Navigation - Always visible */}
        {cryptoNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href ||
            (item.href !== '/crypto/dashboard' && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "group/item flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 min-w-[60px]",
                isActive
                  ? "bg-[#1c1c1c] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#1c1c1c]"
              )}
              title={item.name}
            >
              <Icon className="h-5 w-5 shrink-0 flex-shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-y-2 px-3 pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-full flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:text-white hover:bg-[#1c1c1c]"
        >
          <Bell className="h-5 w-5" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Notifications
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-full flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:text-white hover:bg-[#1c1c1c]"
            >
              <img
                className="h-6 w-6 rounded-full bg-gray-800"
                src="/avatar.png"
                alt="User avatar"
              />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Profile
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? (
                <Sun className="h-4 w-4 mr-2" />
              ) : (
                <Moon className="h-4 w-4 mr-2" />
              )}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/app/settings")}>
              <SettingsIcon className="h-4 w-4 mr-2" />
              <span>Settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
} 