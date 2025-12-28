import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { SearchPopup } from '@/components/search/SearchPopup';
import {
    LogOut,
    Settings,
    Home,
    Search,
    Search as Bell,
    Search as Star,
    Search as Wallet,
    ChevronDown,
    Search as Menu,
    Search as LayoutDashboard,
    Search as BookOpen,
    TrendingUp as LineChart,
    Search as NotebookPen,
    BarChart2 as BarChart3,
    Search as BookMarked,
    TrendingUp,
    Plus,
    Zap as Coins,
    Search as Copy,
    Zap as Activity,
    BarChart2,
    Search as Users,
    Wifi,
    Search as AlignJustify, // Extra safety
    Search as LayoutGrid, // Extra safety
    Search as Book, // Extra safety
    Search as Pen, // Extra safety
    Search as Bookmark, // Extra safety
    Zap as CircleDollarSign, // Extra safety
    Search as Clipboard, // Extra safety
    Settings as Shield // For admin (aliased)
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { useAffiliate } from "@/hooks/useAffiliate";
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { BrokerSyncModal } from '@/components/trades/BrokerSyncModal';
import { useToast } from '@/components/ui/use-toast';

export function AppNavigation() {
    const navigate = useNavigate();
    const location = useLocation();
    const supabase = createClient();
    const [userInitials, setUserInitials] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const { isAffiliate } = useAffiliate();
    const { canAccessTradeSync } = useSubscription();
    const [showBrokerSyncModal, setShowBrokerSyncModal] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    setUserInitials('G');
                    return;
                }
                setUserInitials(user.email?.charAt(0).toUpperCase() || 'U');

                // Check if user is admin
                const adminEmails = ['rayhan@arafatcapital.com', 'sevemadsen18@gmail.com'];
                setIsAdmin(adminEmails.includes(user.email || ''));
            } catch (error) {
                console.error("Error fetching user data:", error);
                setUserInitials('U');
            }
        };
        fetchUserProfile();
    }, [supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/signin');
    };

    const navigation = [
        { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
        { name: "Tokens", href: "/crypto/tokens", icon: BarChart2 },
        { name: "Trades", href: "/app/trades", icon: LineChart },
        { name: "Journal", href: "/app/journal", icon: BookOpen },
        { name: "Analytics", href: "/app/performance", icon: BarChart3 },
        { name: "Backtesting", href: "/app/backtesting", icon: TrendingUp },
        { name: "Quantbacktesting", href: "/app/quantbacktesting", icon: Activity },
    ];

    const secondaryNavigation = [
        ...(isAffiliate ? [{ name: "Affiliates", href: "/app/affiliate", icon: Users }] : []),
        ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: Shield }] : []),
        { name: "Taxes", href: "/app/pl-statements", icon: BookMarked },
    ];

    const cryptoNavigation = [
        { name: "Crypto Dashboard", href: "/crypto/dashboard", icon: Coins },
        { name: "Wallets", href: "/crypto/wallets", icon: Wallet },
        { name: "Copy Trading", href: "/crypto/copy-trading", icon: Copy },
        { name: "On-Chain", href: "/crypto/on-chain", icon: Activity },
    ];

    return (
        <nav className="border-b border-white/10 bg-[#0b0b0f] text-white">
            <div className="flex h-16 items-center px-4 w-full justify-between">

                {/* Left Section: Logo + Navigation */}
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <Link to="/app/analytics" className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-white text-black flex items-center justify-center rounded-sm font-bold text-lg">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 22H22L12 2Z" fill="currentColor" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold tracking-tight">0nyx</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-1">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={cn(
                                    "px-3 py-2 text-sm font-medium rounded-md transition-colors hover:text-white",
                                    location.pathname === item.href || location.pathname.startsWith(item.href)
                                        ? "text-white"
                                        : "text-gray-400"
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}

                        {/* More / Validation Dropdown for remaining items to save space */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-md transition-colors">
                                    More <ChevronDown className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 bg-[#18181b] border-white/10 text-gray-300">
                                <DropdownMenuLabel>Tools</DropdownMenuLabel>
                                {secondaryNavigation.map((item) => (
                                    <DropdownMenuItem key={item.name} onClick={() => navigate(item.href)} className="cursor-pointer hover:bg-white/5 hover:text-white focus:bg-white/5 focus:text-white">
                                        <item.icon className="mr-2 h-4 w-4" />
                                        <span>{item.name}</span>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuLabel>Crypto</DropdownMenuLabel>
                                {cryptoNavigation.map((item) => (
                                    <DropdownMenuItem key={item.name} onClick={() => navigate(item.href)} className="cursor-pointer hover:bg-white/5 hover:text-white focus:bg-white/5 focus:text-white">
                                        <item.icon className="mr-2 h-4 w-4" />
                                        <span>{item.name}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Right Section: Search, Action, Profile */}
                <div className="flex items-center gap-4">

                    {/* Search Bar - Visual Only */}
                    {/* Search Bar - Visual Only - Now a Trigger for SearchPopup */}
                    <SearchPopup>
                        <div className="hidden md:flex items-center bg-[#18181b] rounded-full px-4 py-1.5 border border-white/10 w-64 cursor-pointer hover:bg-white/5 transition-colors">
                            <Search className="h-4 w-4 text-gray-500 mr-2" />
                            <div className="text-sm text-gray-600 w-full text-left">Search...</div>
                            <div className="text-xs text-gray-600 border border-white/10 rounded px-1.5 py-0.5">/</div>
                        </div>
                    </SearchPopup>

                    <div className="flex items-center gap-3">
                        {/* Sync Trades Button */}
                        {canAccessTradeSync ? (
                            <Button
                                size="sm"
                                onClick={() => setShowBrokerSyncModal(true)}
                                className="hidden sm:flex items-center gap-2 bg-none bg-black border border-white/20 text-white hover:bg-white/10 rounded-full px-4 font-medium"
                            >
                                <Wifi className="h-4 w-4" />
                                <span className="hidden lg:inline">Sync Trades</span>
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={() => {
                                    toast({
                                        title: "Pro Feature",
                                        description: "This feature requires a Pro subscription ($39.99/month). Please upgrade to access real-time trade sync.",
                                        variant: "destructive"
                                    });
                                }}
                                className="hidden sm:flex items-center gap-2 bg-none bg-black border border-white/20 text-white hover:bg-white/10 rounded-full px-4 font-medium"
                            >
                                <Wifi className="h-4 w-4" />
                                <span className="hidden lg:inline">Sync Trades</span>
                            </Button>
                        )}
                        {/* Add Trade Button (Primary Action) */}
                        <Button
                            size="sm"
                            className="bg-none bg-black border border-white/20 text-white hover:bg-white/10 rounded-full px-4 font-medium hidden sm:flex"
                            onClick={() => navigate('/app/trades/add')}
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add Trade
                        </Button>

                        {/* Network / Status - Mocking SOL from screenshot */}
                        <div className="hidden sm:flex items-center gap-2 bg-[#18181b] rounded-full px-3 py-1.5 border border-white/10">
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                            <span className="text-xs font-medium text-gray-300">SOL</span>
                        </div>

                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                            <Star className="h-5 w-5" />
                        </Button>

                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                            <Bell className="h-5 w-5" />
                        </Button>

                        {/* Profile Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8 ring-2 ring-white/10">
                                        <AvatarImage src={avatarUrl} alt="User" />
                                        <AvatarFallback className="bg-[#6366f1] text-white">{userInitials}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-[#18181b] border-white/10 text-gray-300" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none text-white">My Account</p>
                                        <p className="text-xs leading-none text-muted-foreground">User Settings</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem onClick={() => navigate('/app/settings')} className="hover:bg-white/5 hover:text-white cursor-pointer focus:bg-white/5 focus:text-white">
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Settings</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/app/billing')} className="hover:bg-white/5 hover:text-white cursor-pointer focus:bg-white/5 focus:text-white">
                                    <SubscriptionStatus />
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem onClick={handleSignOut} className="hover:bg-white/5 hover:text-white cursor-pointer focus:bg-white/5 focus:text-white">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Broker Sync Modal */}
            <BrokerSyncModal
                isOpen={showBrokerSyncModal}
                onClose={() => setShowBrokerSyncModal(false)}
                onBrokerSelected={(brokerId) => {
                    toast({
                        title: "Broker Connected",
                        description: `Successfully connected to ${brokerId}. Your trades will now sync automatically.`,
                    });
                }}
            />
        </nav>
    );
}
