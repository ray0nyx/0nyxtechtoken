import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bot, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Plus,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { AlgorithmicTradingService, Order, AlgorithmicStrategy } from '@/services/algorithmicTrading';
import { MarketDataService, RealTimeQuote, NewsItem, EconomicIndicator } from '@/services/marketDataService';

export const AlgorithmicTradingDashboard: React.FC = () => {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [strategies, setStrategies] = useState<AlgorithmicStrategy[]>([]);
  const [marketData, setMarketData] = useState<RealTimeQuote[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [economicIndicators, setEconomicIndicators] = useState<EconomicIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    type: 'TWAP' as const,
    description: '',
    parameters: {} as Record<string, any>
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Load strategies
        const strategiesData = await AlgorithmicTradingService.getUserStrategies('user-id');
        setStrategies(strategiesData);
        
        // Load market data
        const quote = await MarketDataService.getRealTimeQuote(selectedSymbol);
        if (quote) {
          setMarketData([quote]);
        }
        
        // Load news
        const newsData = await MarketDataService.getNewsSentiment(selectedSymbol);
        setNews(newsData);
        
        // Load economic indicators
        const economicData = await MarketDataService.getEconomicIndicators();
        setEconomicIndicators(economicData);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedSymbol]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'filled': return 'text-green-400';
      case 'pending': return 'text-yellow-400';
      case 'cancelled': return 'text-red-400';
      case 'rejected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getOrderStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'filled': return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'pending': return 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400';
      case 'cancelled': return 'bg-red-900/20 border-red-500/30 text-red-400';
      case 'rejected': return 'bg-red-900/20 border-red-500/30 text-red-400';
      default: return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      case 'neutral': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getSentimentBadgeColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'negative': return 'bg-red-900/20 border-red-500/30 text-red-400';
      case 'neutral': return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
      default: return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
    }
  };

  const handleCreateStrategy = async () => {
    try {
      const strategy = await AlgorithmicTradingService.createStrategy('user-id', {
        ...newStrategy,
        isActive: true
      });
      
      setStrategies([...strategies, strategy]);
      setNewStrategy({
        name: '',
        type: 'TWAP',
        description: '',
        parameters: {}
      });
    } catch (error) {
      console.error('Error creating strategy:', error);
    }
  };

  const handleExecuteTWAP = async () => {
    try {
      const orders = await AlgorithmicTradingService.executeTWAP(
        selectedSymbol,
        1000, // quantity
        60, // duration in minutes
        5, // interval in minutes
        'user-id'
      );
      
      setActiveOrders([...activeOrders, ...orders]);
    } catch (error) {
      console.error('Error executing TWAP:', error);
    }
  };

  const handleExecuteVWAP = async () => {
    try {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();
      
      const orders = await AlgorithmicTradingService.executeVWAP(
        selectedSymbol,
        1000, // quantity
        startTime,
        endTime,
        'user-id'
      );
      
      setActiveOrders([...activeOrders, ...orders]);
    } catch (error) {
      console.error('Error executing VWAP:', error);
    }
  };

  const handleExecuteIceberg = async () => {
    try {
      const orders = await AlgorithmicTradingService.executeIceberg(
        selectedSymbol,
        1000, // total quantity
        100, // visible quantity
        150.00, // price
        'user-id'
      );
      
      setActiveOrders([...activeOrders, ...orders]);
    } catch (error) {
      console.error('Error executing Iceberg:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="institutional-theme p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="institutional-theme p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Algorithmic Trading</h1>
          <p className="text-gray-400 mt-1">Advanced order execution and smart routing</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-32 institutional-btn">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AAPL">AAPL</SelectItem>
              <SelectItem value="GOOGL">GOOGL</SelectItem>
              <SelectItem value="MSFT">MSFT</SelectItem>
              <SelectItem value="TSLA">TSLA</SelectItem>
              <SelectItem value="AMZN">AMZN</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Market Data Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketData.map((quote) => (
          <Card key={quote.symbol} className="institutional-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">{quote.symbol}</h3>
                <Badge className={
                  quote.change >= 0 ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                  'bg-red-900/20 border-red-500/30 text-red-400'
                }>
                  {quote.change >= 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                  {formatPercent(quote.changePercent / 100)}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {formatCurrency(quote.price)}
              </div>
              <div className="text-sm text-gray-400">
                Vol: {quote.volume.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(quote.timestamp).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="strategies" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="orders">Active Orders</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="market-data">Market Data</TabsTrigger>
          <TabsTrigger value="news">News & Sentiment</TabsTrigger>
        </TabsList>

        {/* Strategies Tab */}
        <TabsContent value="strategies" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {strategy.name}
                    </CardTitle>
                    <Badge className={
                      strategy.isActive ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                      'bg-gray-900/20 border-gray-500/30 text-gray-400'
                    }>
                      {strategy.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Type</div>
                    <div className="text-white">{strategy.type}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Description</div>
                    <div className="text-white text-sm">{strategy.description}</div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="institutional-btn flex-1">
                      <Play className="h-4 w-4 mr-1" />
                      Execute
                    </Button>
                    <Button variant="outline" size="sm" className="institutional-btn">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Create New Strategy Card */}
            <Card className="institutional-card border-dashed border-2 border-gray-600">
              <CardContent className="p-6 text-center">
                <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Create Strategy</h3>
                <p className="text-gray-400 mb-4">Build custom algorithmic trading strategies</p>
                <Button className="institutional-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  New Strategy
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Active Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div className="space-y-4">
            {activeOrders.length > 0 ? activeOrders.map((order) => (
              <Card key={order.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{order.symbol}</h4>
                      <Badge className={
                        order.side === 'buy' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                        'bg-red-900/20 border-red-500/30 text-red-400'
                      }>
                        {order.side.toUpperCase()}
                      </Badge>
                      <Badge className={getOrderStatusBadgeColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
                      <Badge className="bg-gray-700 text-gray-300">
                        {order.strategy}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-gray-400">Quantity</div>
                      <div className="font-mono text-lg text-white">{order.quantity}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Price</div>
                      <div className="font-mono text-lg text-green-400">
                        {order.price ? formatCurrency(order.price) : 'Market'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Filled</div>
                      <div className="font-mono text-lg text-blue-400">
                        {order.filledQuantity || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Remaining</div>
                      <div className="font-mono text-lg text-orange-400">
                        {order.remainingQuantity || order.quantity}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="institutional-btn">
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="institutional-btn">
                      <Square className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-8 text-gray-400">
                No active orders
              </div>
            )}
          </div>
        </TabsContent>

        {/* Execution Tab */}
        <TabsContent value="execution" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  TWAP Execution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-400">
                  Time-Weighted Average Price execution splits large orders over time
                </div>
                <Button onClick={handleExecuteTWAP} className="institutional-btn w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Execute TWAP
                </Button>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-400" />
                  VWAP Execution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-400">
                  Volume-Weighted Average Price execution based on historical volume
                </div>
                <Button onClick={handleExecuteVWAP} className="institutional-btn w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Execute VWAP
                </Button>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-400" />
                  Iceberg Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-400">
                  Large orders split into smaller visible portions
                </div>
                <Button onClick={handleExecuteIceberg} className="institutional-btn w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Execute Iceberg
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Market Data Tab */}
        <TabsContent value="market-data" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Real-Time Quotes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {marketData.map((quote) => (
                    <div key={quote.symbol} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold text-sm">{quote.symbol}</div>
                        <div className="text-white">{formatCurrency(quote.price)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm ${quote.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {quote.change >= 0 ? '+' : ''}{formatCurrency(quote.change)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatPercent(quote.changePercent / 100)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Economic Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {economicIndicators.map((indicator) => (
                    <div key={indicator.id} className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-white">{indicator.name}</h4>
                        <Badge className={
                          indicator.impact === 'high' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                          indicator.impact === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                          'bg-green-900/20 border-green-500/30 text-green-400'
                        }>
                          {indicator.impact.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-gray-400">Current</div>
                          <div className="text-white">{indicator.value}{indicator.unit}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Previous</div>
                          <div className="text-white">{indicator.previousValue}{indicator.unit}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Forecast</div>
                          <div className="text-white">{indicator.forecast}{indicator.unit}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* News & Sentiment Tab */}
        <TabsContent value="news" className="space-y-4">
          <div className="space-y-4">
            {news.map((item) => (
              <Card key={item.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{item.title}</h4>
                      <Badge className={getSentimentBadgeColor(item.sentiment)}>
                        {item.sentiment.toUpperCase()}
                      </Badge>
                      <Badge className="bg-gray-700 text-gray-300">
                        {item.impact.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(item.publishedAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <p className="text-white mb-3">{item.summary}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      Source: {item.source}
                    </div>
                    <div className="text-sm text-gray-400">
                      Confidence: {formatPercent(item.confidence)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
