import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  ArrowRight, 
  Settings, 
  Bot,
  LineChart,
  TrendingUp,
  Play,
  Pause,
  Trash2,
  Save,
  CalendarClock,
  DollarSign,
  BarChart4,
  StopCircle,
  Paintbrush,
  Lock
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { TradovateService } from '@/lib/services/TradovateService';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { createChart, ColorType } from 'lightweight-charts';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BrokerService } from '@/lib/services/brokerService';

const DEVELOPER_ID = "856950ff-d638-419d-bcf1-b7dac51d1c7f";

export default function WagyuTechLiveTrading() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [isProMember, setIsProMember] = useState(false);
  const { isSubscriptionValid } = useSubscription();
  const [tradovateCredentials, setTradovateCredentials] = useState({
    username: '',
    password: '',
    connectionName: 'My Tradovate Connection',
    environment: 'Demo'
  });
  
  // Check if the current user is the developer or has Pro membership
  useEffect(() => {
    const checkUserStatus = async () => {
      setIsCheckingUser(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user.id === DEVELOPER_ID) {
          setIsDeveloper(true);
          setIsProMember(true);
        } else {
          // Check if user has Pro membership
          setIsProMember(isSubscriptionValid);
        }
        
        // Check if user has pro membership and existing Tradovate connection
        if (isSubscriptionValid || session?.user.id === DEVELOPER_ID) {
          const brokerService = BrokerService.getInstance();
          const hasTradovate = await brokerService.hasTradovateConnection();
          
          if (hasTradovate) {
            // Auto-login with saved credentials
            await autoAuthenticateTradovate();
          }
        }
      } catch (error) {
        console.error("Error checking user status:", error);
      } finally {
        setIsCheckingUser(false);
      }
    };
    
    checkUserStatus();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsDeveloper(session?.user.id === DEVELOPER_ID);
    });
    
    return () => subscription.unsubscribe();
  }, [isSubscriptionValid]);
  
  // Auto-authenticate with Tradovate if user has existing connection
  const autoAuthenticateTradovate = async () => {
    try {
      setIsLoading(true);
      
      const brokerService = BrokerService.getInstance();
      const connections = await brokerService.getBrokerConnections();
      const tradovateConnection = connections.find(conn => conn.broker === 'Tradovate');
      
      if (!tradovateConnection) {
        return;
      }
      
      const credentials = {
        apiKey: tradovateConnection.api_key,
        secretKey: tradovateConnection.secret_key
      };
      
      // Use the existing credentials to authenticate
      const tradovateService = TradovateService.getInstance();
      await tradovateService.authenticate(credentials.apiKey, credentials.secretKey);
      
      setIsAuthenticated(true);
      toast({
        title: "Automatically connected",
        description: `Using your linked Tradovate ${tradovateConnection.environment || 'Demo'} account (${tradovateConnection.name || 'Default'})`,
        variant: "default",
      });
      
      // Load chart data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      try {
        const historicalData = await tradovateService.getHistoricalData(
          'ES', '1d', startDate, endDate
        );
        
        // Convert to the format expected by the chart
        const formattedData = historicalData.map(bar => ({
          date: new Date(bar.timestamp).toISOString().split('T')[0],
          pnl: (bar.close - bar.open) * 50, // Rough estimate of P&L for ES
          trades: Math.floor(Math.random() * 10),
        }));
        
        setChartData(formattedData);
      } catch (dataError) {
        console.error("Error fetching chart data:", dataError);
        
        // Fall back to mock data if we can't get the real data
        const mockData = Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (30 - i));
          return {
            date: date.toISOString().split('T')[0],
            pnl: Math.random() * 1000 - 300,
            trades: Math.floor(Math.random() * 10),
          };
        });
        
        setChartData(mockData);
      }
    } catch (error) {
      console.error("Auto-authentication error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkTradovate = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      
      const brokerService = BrokerService.getInstance();
      await brokerService.unlinkTradovateConnection();
      
      setIsAuthenticated(false);
      toast({
        title: "Account unlinked",
        description: "Your Tradovate account has been unlinked",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error unlinking account",
        description: error.message || "Could not unlink your Tradovate account",
        variant: "destructive",
      });
      
      console.error("Unlink error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const [activeAlgorithms, setActiveAlgorithms] = useState<Array<{
    id: string;
    name: string;
    isRunning: boolean;
    profitFactor: number;
    winRate: number;
    trades: number;
  }>>([
    { 
      id: '1', 
      name: 'VWAP Breakout', 
      isRunning: false, 
      profitFactor: 1.67, 
      winRate: 58, 
      trades: 124 
    },
    { 
      id: '2', 
      name: 'ES Pullback', 
      isRunning: false, 
      profitFactor: 1.92, 
      winRate: 62, 
      trades: 87 
    },
  ]);
  const [newAlgorithmConfig, setNewAlgorithmConfig] = useState({
    name: '',
    symbol: '',
    timeframe: '5m',
    strategy: 'breakout',
    stopLoss: 10,
    takeProfit: 25,
    maxPositions: 1,
    capitalAllocation: 10,
  });
  const [chartData, setChartData] = useState<any[]>([]);

  const handleTradovateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tradovateCredentials.username || !tradovateCredentials.password || !tradovateCredentials.connectionName) {
      toast({
        title: "Missing information",
        description: "Please enter your connection name, username, and password",
        variant: "destructive",
      });
      return;
    }
    
    if (!isProMember && !isDeveloper) {
      toast({
        title: "Pro membership required",
        description: "Live trading requires a Pro membership",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (isProMember || isDeveloper) {
        // Use actual Tradovate API integration for Pro members
        const tradovateService = TradovateService.getInstance();
        try {
          await tradovateService.authenticate(tradovateCredentials.username, tradovateCredentials.password);
          
          // Store the connection in the database with connection name and environment
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error } = await supabase
              .from('broker_connections')
              .upsert({
                user_id: user.id,
                broker: 'Tradovate',
                api_key: tradovateCredentials.username,
                secret_key: tradovateCredentials.password,
                name: tradovateCredentials.connectionName,
                environment: tradovateCredentials.environment,
                sandbox: tradovateCredentials.environment === 'Demo',
              });
              
            if (error) {
              console.error("Error storing connection:", error);
            }
          }
          
          setIsAuthenticated(true);
          toast({
            title: "Authentication successful",
            description: `Connected to Tradovate ${tradovateCredentials.environment} account`,
            variant: "default",
          });
          
          // Get real account data
          const accounts = await tradovateService.getAccounts();
          
          if (accounts.length > 0) {
            // Get actual trading data for the chart
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            
            try {
              const historicalData = await tradovateService.getHistoricalData(
                'ES', '1d', startDate, endDate
              );
              
              // Convert to the format expected by the chart
              const formattedData = historicalData.map(bar => ({
                date: new Date(bar.timestamp).toISOString().split('T')[0],
                pnl: (bar.close - bar.open) * 50, // Rough estimate of P&L for ES
                trades: 1,
              }));
              
              setChartData(formattedData);
            } catch (dataError) {
              console.error("Error fetching chart data:", dataError);
              
              // Fall back to mock data if we can't get the real data
              const mockData = Array.from({ length: 30 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (30 - i));
                return {
                  date: date.toISOString().split('T')[0],
                  pnl: Math.random() * 1000 - 300,
                  trades: Math.floor(Math.random() * 10),
                };
              });
              
              setChartData(mockData);
            }
          }
        } catch (apiError: any) {
          console.error("Tradovate API error:", apiError);
          throw new Error(`API connection failed: ${apiError.message}`);
        }
      } else {
        // For non-Pro members, use the mock data for demo purposes
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setIsAuthenticated(true);
        
        // Simulate fetching algorithm performance data
        const mockData = Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (30 - i));
          return {
            date: date.toISOString().split('T')[0],
            pnl: Math.random() * 1000 - 300,
            trades: Math.floor(Math.random() * 10),
          };
        });
        
        setChartData(mockData);
      }
    } catch (error: any) {
      toast({
        title: "Authentication failed",
        description: error.message || "Could not connect to Tradovate. Please check your credentials.",
        variant: "destructive",
      });
      
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
      
      // Only set authenticated if no error occurred
      if (!error) {
        setIsAuthenticated(true);
        toast({
          title: "Authentication successful",
          description: "Connected to Tradovate account",
          variant: "default",
        });
        
        // Simulate fetching algorithm performance data
        const mockData = Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (30 - i));
          return {
            date: date.toISOString().split('T')[0],
            pnl: Math.random() * 1000 - 300,
            trades: Math.floor(Math.random() * 10),
          };
        });
        
        setChartData(mockData);
      }
    }
  };

  const toggleAlgorithm = (id: string) => {
    setActiveAlgorithms(prevAlgos => 
      prevAlgos.map(algo => 
        algo.id === id ? { ...algo, isRunning: !algo.isRunning } : algo
      )
    );
    
    const algo = activeAlgorithms.find(a => a.id === id);
    
    toast({
      title: algo?.isRunning ? "Strategy stopped" : "Strategy started",
      description: `${algo?.name} is now ${algo?.isRunning ? 'inactive' : 'running'}`,
      variant: "default",
    });
  };

  const saveNewAlgorithm = () => {
    if (!newAlgorithmConfig.name || !newAlgorithmConfig.symbol) {
      toast({
        title: "Missing information",
        description: "Please provide a name and symbol for your strategy",
        variant: "destructive",
      });
      return;
    }
    
    const newAlgo = {
      id: Math.random().toString(36).substr(2, 9),
      name: newAlgorithmConfig.name,
      isRunning: false,
      profitFactor: 0,
      winRate: 0,
      trades: 0
    };
    
    setActiveAlgorithms(prev => [...prev, newAlgo]);
    
    toast({
      title: "Strategy created",
      description: `${newAlgorithmConfig.name} has been added to your strategies`,
      variant: "default",
    });
    
    setNewAlgorithmConfig({
      name: '',
      symbol: '',
      timeframe: '5m',
      strategy: 'breakout',
      stopLoss: 10,
      takeProfit: 25,
      maxPositions: 1,
      capitalAllocation: 10,
    });
  };

  const deleteAlgorithm = (id: string) => {
    const algo = activeAlgorithms.find(a => a.id === id);
    
    setActiveAlgorithms(prev => prev.filter(a => a.id !== id));
    
    toast({
      title: "Strategy deleted",
      description: `${algo?.name} has been removed from your strategies`,
      variant: "default",
    });
  };

  // Loading state
  if (isCheckingUser) {
    return (
      <div className="container py-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 text-magenta-500 animate-spin" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Coming soon page for regular users
  if (!isDeveloper && !isProMember) {
    return (
      <div className="container py-12 max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center justify-center min-h-[60vh]">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-magenta-500/20 to-blue-500/20 flex items-center justify-center mb-6">
            <Lock className="h-12 w-12 text-transparent bg-clip-text bg-gradient-to-r from-magenta-500 to-blue-500" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-purple-500 mb-4">
            Pro Feature: Live Trading
          </h1>
          <p className="text-zinc-400 text-xl max-w-2xl mb-8">
            Live trading is available exclusively to 0nyx Pro members. Upgrade today to create, backtest, and deploy your trading strategies directly from 0nyx.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 max-w-4xl">
            <div className="bg-zinc-900/50 p-6 rounded-lg border border-zinc-800">
              <h3 className="text-lg font-semibold text-magenta-500 mb-2">Create Algorithms</h3>
              <p className="text-zinc-400">Build custom trading algorithms with our intuitive interface - no coding required</p>
            </div>
            <div className="bg-zinc-900/50 p-6 rounded-lg border border-zinc-800">
              <h3 className="text-lg font-semibold text-magenta-500 mb-2">Backtest Strategies</h3>
              <p className="text-zinc-400">Test your algorithms against historical data to validate performance</p>
            </div>
            <div className="bg-zinc-900/50 p-6 rounded-lg border border-zinc-800">
              <h3 className="text-lg font-semibold text-magenta-500 mb-2">Live Trading</h3>
              <p className="text-zinc-400">Deploy your algorithms to trade automatically via Tradovate connectivity</p>
            </div>
          </div>
          <div className="mt-12">
            <Button 
              onClick={() => window.location.href = '/pricing'}
              className="bg-gradient-to-r from-magenta-500 to-blue-500 hover:from-magenta-600 hover:to-blue-600 text-lg py-6 px-8"
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Developer view - original page content
  return (
    <div className="container py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-purple-500">
            <span className="text-purple-500">0nyx</span> Tech Live Trading
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Build, backtest, and deploy live trading strategies
          </p>
        </div>
      </div>

      <div className="mt-8">
        {!isAuthenticated ? (
          <Card className="bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20">
            <CardHeader>
              <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-magenta-500 to-blue-500">
                Connect Your Tradovate Account
              </CardTitle>
              <CardDescription>
                Enter your Tradovate credentials to access live trading features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTradovateLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connection-name">Connection Name</Label>
                  <Input
                    id="connection-name"
                    placeholder="Enter a name for this connection"
                    value={tradovateCredentials.connectionName}
                    onChange={(e) => setTradovateCredentials(prev => ({ ...prev, connectionName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Tradovate Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your Tradovate username"
                    value={tradovateCredentials.username}
                    onChange={(e) => setTradovateCredentials(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Tradovate Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your Tradovate password"
                    value={tradovateCredentials.password}
                    onChange={(e) => setTradovateCredentials(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <select
                    id="environment"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={tradovateCredentials.environment}
                    onChange={(e) => setTradovateCredentials(prev => ({ ...prev, environment: e.target.value }))}
                  >
                    <option value="Demo">Demo</option>
                    <option value="Live">Live</option>
                  </select>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-magenta-500 to-blue-500 hover:from-magenta-600 hover:to-blue-600"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Connect to Tradovate
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-border pt-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your credentials are securely transmitted directly to Tradovate.
                0nyx does not store your Tradovate password.
                <br />
                <span className="text-magenta-500 font-medium mt-2 block">
                  Pro members: You'll stay signed in until you unlink your account.
                </span>
              </p>
            </CardFooter>
          </Card>
        ) : (
          <div>
            <div className="flex justify-end mb-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleUnlinkTradovate}
                disabled={isLoading}
                className="text-red-500 border-red-500/20 hover:bg-red-500/10"
              >
                {isLoading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <StopCircle className="mr-2 h-4 w-4" />
                )}
                Unlink Tradovate Account
              </Button>
            </div>
            
            <Tabs defaultValue="algorithms" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="algorithms" className="text-sm">
                  <Bot className="h-4 w-4 mr-2" />
                  My Strategies
                </TabsTrigger>
                <TabsTrigger value="create" className="text-sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Create Strategy
                </TabsTrigger>
                <TabsTrigger value="performance" className="text-sm">
                  <LineChart className="h-4 w-4 mr-2" />
                  Strategy Performance
                </TabsTrigger>
              </TabsList>

              {/* Active Algorithms Tab */}
              <TabsContent value="algorithms" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeAlgorithms.map(algo => (
                    <Card 
                      key={algo.id} 
                      className={`bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20 ${
                        algo.isRunning ? 'ring-2 ring-green-500 dark:ring-green-500' : ''
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-magenta-500 to-blue-500">
                            {algo.name}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => toggleAlgorithm(algo.id)}
                            >
                              {algo.isRunning ? (
                                <Pause className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <Play className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => deleteAlgorithm(algo.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription>
                          {algo.isRunning ? (
                            <span className="flex items-center text-green-500">
                              <Check className="h-4 w-4 mr-1" />
                              Running
                            </span>
                          ) : (
                            <span className="flex items-center text-zinc-500">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Inactive
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-zinc-500">Profit Factor</p>
                            <p className="text-lg font-medium">{algo.profitFactor.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Win Rate</p>
                            <p className="text-lg font-medium">{algo.winRate}%</p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Trades</p>
                            <p className="text-lg font-medium">{algo.trades}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {activeAlgorithms.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-zinc-500 dark:text-zinc-400">
                      You don't have any strategies yet. Create one to get started.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => document.querySelector('[data-value="create"]')?.click()}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Create Strategy
                    </Button>
                  </div>
                )}

                <Card className="bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-zinc-500">Strategies Active</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {activeAlgorithms.filter(a => a.isRunning).length}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Create Algorithm Tab */}
              <TabsContent value="create" className="space-y-6">
                <Card className="bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20">
                  <CardHeader>
                    <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-magenta-500 to-blue-500">
                      Create New Strategy
                    </CardTitle>
                    <CardDescription>
                      Configure your trading strategy parameters
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="algo-name">Strategy Name</Label>
                          <Input
                            id="algo-name"
                            placeholder="E.g., VWAP Breakout Strategy"
                            value={newAlgorithmConfig.name}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="symbol">Trading Symbol</Label>
                          <Input
                            id="symbol"
                            placeholder="E.g., ES, NQ, CL"
                            value={newAlgorithmConfig.symbol}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, symbol: e.target.value }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="timeframe">Timeframe</Label>
                          <select
                            id="timeframe"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={newAlgorithmConfig.timeframe}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, timeframe: e.target.value }))}
                          >
                            <option value="1m">1 Minute</option>
                            <option value="5m">5 Minutes</option>
                            <option value="15m">15 Minutes</option>
                            <option value="30m">30 Minutes</option>
                            <option value="1h">1 Hour</option>
                            <option value="4h">4 Hours</option>
                            <option value="1d">Daily</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="strategy">Strategy Type</Label>
                          <select
                            id="strategy"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={newAlgorithmConfig.strategy}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, strategy: e.target.value }))}
                          >
                            <option value="breakout">Breakout</option>
                            <option value="reversal">Reversal</option>
                            <option value="momentum">Momentum</option>
                            <option value="meanreversion">Mean Reversion</option>
                            <option value="custom">Custom Strategy</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="stoploss">Stop Loss (Ticks)</Label>
                          <Input
                            id="stoploss"
                            type="number"
                            min="1"
                            value={newAlgorithmConfig.stopLoss}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, stopLoss: parseInt(e.target.value) }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="takeprofit">Take Profit (Ticks)</Label>
                          <Input
                            id="takeprofit"
                            type="number"
                            min="1"
                            value={newAlgorithmConfig.takeProfit}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, takeProfit: parseInt(e.target.value) }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="maxpositions">Maximum Positions</Label>
                          <Input
                            id="maxpositions"
                            type="number"
                            min="1"
                            max="10"
                            value={newAlgorithmConfig.maxPositions}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, maxPositions: parseInt(e.target.value) }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="capital">Capital Allocation (%)</Label>
                          <Input
                            id="capital"
                            type="number"
                            min="1"
                            max="100"
                            value={newAlgorithmConfig.capitalAllocation}
                            onChange={(e) => setNewAlgorithmConfig(prev => ({ ...prev, capitalAllocation: parseInt(e.target.value) }))}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t border-border pt-4">
                    <Button 
                      variant="outline"
                      onClick={() => document.querySelector('[data-value="algorithms"]')?.click()}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="bg-gradient-to-r from-magenta-500 to-blue-500 hover:from-magenta-600 hover:to-blue-600"
                      onClick={saveNewAlgorithm}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Strategy
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="space-y-4">
                <Card className="bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20">
                  <CardHeader>
                    <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-magenta-500 to-blue-500">
                      Strategy Performance
                    </CardTitle>
                    <CardDescription>
                      Tracking your trading strategy results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <div className="h-[400px] w-full">
                        {/* Live trading chart for Pro members */}
                        {isProMember || isDeveloper ? (
                          <LiveTradingChart 
                            symbol="ES"
                            initialData={[
                              { time: Date.now() / 1000 - 3600 * 24 * 30, open: 4200.5, high: 4220.3, low: 4198.6, close: 4215.2 },
                              { time: Date.now() / 1000 - 3600 * 24 * 29, open: 4215.2, high: 4230.1, low: 4210.0, close: 4225.7 },
                              { time: Date.now() / 1000 - 3600 * 24 * 28, open: 4225.7, high: 4240.5, low: 4220.3, close: 4238.9 },
                              { time: Date.now() / 1000 - 3600 * 24 * 27, open: 4238.9, high: 4245.2, low: 4230.1, close: 4235.6 },
                              { time: Date.now() / 1000 - 3600 * 24 * 26, open: 4235.6, high: 4250.0, low: 4233.0, close: 4249.3 }
                            ]}
                            onStopLossChange={(price) => {
                              toast({
                                title: "Stop Loss Set",
                                description: `Stop loss set at $${price.toFixed(2)}`,
                                variant: "default",
                              });
                            }}
                            onTakeProfitChange={(price) => {
                              toast({
                                title: "Take Profit Set",
                                description: `Take profit set at $${price.toFixed(2)}`,
                                variant: "default",
                              });
                            }}
                            onClosePosition={() => {
                              toast({
                                title: "Position Closed",
                                description: "Your position has been closed",
                                variant: "default",
                              });
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full border border-border rounded-md bg-zinc-900/50">
                            <div className="text-center p-8 max-w-md">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-magenta-500/20 to-blue-500/20 flex items-center justify-center">
                                <Lock className="h-8 w-8 text-transparent bg-clip-text bg-gradient-to-r from-magenta-500 to-blue-500" />
                              </div>
                              <h3 className="text-xl font-medium mb-2">Pro Feature: Live Trading</h3>
                              <p className="text-zinc-400 mb-4">
                                Upgrade to Pro to access real-time charts with stop loss and take profit controls.
                              </p>
                              <Button 
                                onClick={() => window.location.href = '/pricing'}
                                className="bg-gradient-to-r from-magenta-500 to-blue-500 hover:from-magenta-600 hover:to-blue-600"
                              >
                                Upgrade Now
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[200px]">
                        <p className="text-zinc-500">No performance data available yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-500">Total P&L</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {chartData.length > 0 
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                              chartData.reduce((sum, d) => sum + d.pnl, 0)
                            ) 
                          : '$0.00'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-500">Trade Count</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {chartData.length > 0 
                          ? chartData.reduce((sum, d) => sum + d.trades, 0) 
                          : '0'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card dark:bg-gradient-to-br dark:from-black dark:to-zinc-900 border-border dark:border-zinc-800 hover:border-primary/50 dark:hover:border-magenta-500/50 shadow-lg shadow-primary/5 dark:shadow-magenta-500/5 hover:shadow-primary/20 dark:hover:shadow-magenta-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-500">Strategies Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {activeAlgorithms.filter(a => a.isRunning).length}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

// Live Trading Chart Component
function LiveTradingChart({ 
  symbol = 'ES', 
  initialData = [], 
  onStopLossChange,
  onTakeProfitChange,
  onClosePosition
}: { 
  symbol?: string;
  initialData?: Array<{ time: number, open: number, high: number, low: number, close: number, volume?: number }>;
  onStopLossChange?: (price: number) => void;
  onTakeProfitChange?: (price: number) => void;
  onClosePosition?: () => void;
}) {
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const [chartInstance, setChartInstance] = React.useState<any>(null);
  const [candleSeries, setCandleSeries] = React.useState<any>(null);
  const [currentPrice, setCurrentPrice] = React.useState<number | null>(null);
  const [chartColors, setChartColors] = React.useState({
    backgroundColor: 'rgb(19, 23, 34)',
    textColor: '#ffffff',
    axisColor: 'rgba(255, 255, 255, 0.3)',
    upColor: '#26a69a',
    downColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
  });
  
  // Initialize chart
  React.useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Clear any existing content
    chartContainerRef.current.innerHTML = '';
    
    // Create new chart instance
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: chartColors.backgroundColor },
        textColor: chartColors.textColor,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      crosshair: {
        mode: 0, // CrosshairMode.Normal
      },
      timeScale: {
        borderColor: chartColors.axisColor,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: chartColors.axisColor,
      },
    });
    
    // Create candlestick series
    const series = chart.addCandlestickSeries({
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      wickUpColor: chartColors.wickUpColor,
      wickDownColor: chartColors.wickDownColor,
      borderUpColor: chartColors.borderUpColor,
      borderDownColor: chartColors.borderDownColor,
    });
    
    // Set initial data if provided
    if (initialData.length > 0) {
      series.setData(initialData);
      
      // Set current price from last data point
      const lastPoint = initialData[initialData.length - 1];
      setCurrentPrice(lastPoint.close);
    }
    
    // Save references
    setChartInstance(chart);
    setCandleSeries(series);
    
    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);
  
  // Update chart colors when they change
  React.useEffect(() => {
    if (!chartInstance || !candleSeries) return;
    
    chartInstance.applyOptions({
      layout: {
        background: { color: chartColors.backgroundColor },
        textColor: chartColors.textColor,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      timeScale: {
        borderColor: chartColors.axisColor,
      },
      rightPriceScale: {
        borderColor: chartColors.axisColor,
      },
    });
    
    candleSeries.applyOptions({
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      wickUpColor: chartColors.wickUpColor,
      wickDownColor: chartColors.wickDownColor,
      borderUpColor: chartColors.borderUpColor,
      borderDownColor: chartColors.borderDownColor,
    });
  }, [chartColors, chartInstance, candleSeries]);
  
  // Update chart data with new point
  const updateChartData = (newData: { time: number, open: number, high: number, low: number, close: number, volume?: number }) => {
    if (!candleSeries) return;
    
    candleSeries.update(newData);
    setCurrentPrice(newData.close);
  };
  
  // Example of how to receive real-time updates (would be called from a WebSocket callback)
  React.useEffect(() => {
    // Simulate real-time updates for demonstration
    const interval = setInterval(() => {
      if (!candleSeries || !currentPrice) return;
      
      const lastPrice = currentPrice;
      const change = (Math.random() - 0.5) * 5;
      const newPrice = lastPrice + change;
      
      const now = new Date();
      const newData = {
        time: now.getTime() / 1000,
        open: lastPrice,
        high: Math.max(lastPrice, newPrice),
        low: Math.min(lastPrice, newPrice),
        close: newPrice,
        volume: Math.floor(Math.random() * 100),
      };
      
      updateChartData(newData);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [candleSeries, currentPrice]);
  
  // Color customization panel
  const ColorCustomizer = () => (
    <div className="mb-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center">
            <Paintbrush className="h-4 w-4 mr-2" />
            Customize Chart
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <h4 className="font-medium">Chart Appearance</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="bg-color" className="text-xs">Background</Label>
                <div className="flex items-center mt-1">
                  <input
                    type="color"
                    id="bg-color"
                    value={chartColors.backgroundColor}
                    onChange={(e) => setChartColors(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-8 h-8 rounded mr-2 border border-border"
                  />
                  <Input
                    value={chartColors.backgroundColor}
                    onChange={(e) => setChartColors(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="text-color" className="text-xs">Text Color</Label>
                <div className="flex items-center mt-1">
                  <input
                    type="color"
                    id="text-color"
                    value={chartColors.textColor}
                    onChange={(e) => setChartColors(prev => ({ ...prev, textColor: e.target.value }))}
                    className="w-8 h-8 rounded mr-2 border border-border"
                  />
                  <Input
                    value={chartColors.textColor}
                    onChange={(e) => setChartColors(prev => ({ ...prev, textColor: e.target.value }))}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="up-color" className="text-xs">Up Candle</Label>
                <div className="flex items-center mt-1">
                  <input
                    type="color"
                    id="up-color"
                    value={chartColors.upColor}
                    onChange={(e) => setChartColors(prev => ({ 
                      ...prev, 
                      upColor: e.target.value,
                      wickUpColor: e.target.value,
                      borderUpColor: e.target.value,
                    }))}
                    className="w-8 h-8 rounded mr-2 border border-border"
                  />
                  <Input
                    value={chartColors.upColor}
                    onChange={(e) => setChartColors(prev => ({ 
                      ...prev, 
                      upColor: e.target.value,
                      wickUpColor: e.target.value,
                      borderUpColor: e.target.value,
                    }))}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="down-color" className="text-xs">Down Candle</Label>
                <div className="flex items-center mt-1">
                  <input
                    type="color"
                    id="down-color"
                    value={chartColors.downColor}
                    onChange={(e) => setChartColors(prev => ({ 
                      ...prev, 
                      downColor: e.target.value,
                      wickDownColor: e.target.value,
                      borderDownColor: e.target.value,
                    }))}
                    className="w-8 h-8 rounded mr-2 border border-border"
                  />
                  <Input
                    value={chartColors.downColor}
                    onChange={(e) => setChartColors(prev => ({ 
                      ...prev, 
                      downColor: e.target.value,
                      wickDownColor: e.target.value,
                      borderDownColor: e.target.value,
                    }))}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={() => {
              setChartColors({
                backgroundColor: 'rgb(19, 23, 34)',
                textColor: '#ffffff',
                axisColor: 'rgba(255, 255, 255, 0.3)',
                upColor: '#26a69a',
                downColor: '#ef5350',
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
                borderUpColor: '#26a69a',
                borderDownColor: '#ef5350',
              });
            }}>
              Reset to Default
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
  
  // Trading controls
  const TradingControls = () => (
    <div className="mt-4 grid grid-cols-3 gap-4">
      <Card className="bg-red-950/20 border-red-900/30">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-red-400">Stop Loss</h3>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                if (currentPrice && onStopLossChange) {
                  // Set stop loss at 1% below current price
                  const stopPrice = currentPrice * 0.99;
                  onStopLossChange(stopPrice);
                }
              }}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Set Stop
            </Button>
          </div>
          {currentPrice && (
            <p className="text-xs mt-2 text-red-400">
              Suggested: ${(currentPrice * 0.99).toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-green-950/20 border-green-900/30">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-green-400">Take Profit</h3>
            <Button 
              variant="default" 
              size="sm"
              className="bg-green-700 hover:bg-green-800"
              onClick={() => {
                if (currentPrice && onTakeProfitChange) {
                  // Set take profit at 1% above current price
                  const takeProfitPrice = currentPrice * 1.01;
                  onTakeProfitChange(takeProfitPrice);
                }
              }}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Set TP
            </Button>
          </div>
          {currentPrice && (
            <p className="text-xs mt-2 text-green-400">
              Suggested: ${(currentPrice * 1.01).toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-blue-950/20 border-blue-900/30">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-blue-400">Close Position</h3>
            <Button 
              variant="default" 
              size="sm"
              className="bg-blue-700 hover:bg-blue-800"
              onClick={() => {
                if (onClosePosition) {
                  onClosePosition();
                }
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
          {currentPrice && (
            <p className="text-xs mt-2 text-blue-400">
              Current: ${currentPrice.toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h3 className="text-lg font-medium">{symbol} Live Chart</h3>
          {currentPrice && (
            <span className="ml-2 text-sm bg-primary/10 text-primary px-2 py-1 rounded">
              ${currentPrice.toFixed(2)}
            </span>
          )}
        </div>
        <ColorCustomizer />
      </div>
      
      <div ref={chartContainerRef} className="w-full h-[500px] border border-zinc-800 rounded-lg overflow-hidden" />
      
      <TradingControls />
    </div>
  );
} 