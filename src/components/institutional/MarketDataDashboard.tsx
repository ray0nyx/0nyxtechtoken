import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity, 
  Globe, 
  Zap,
  RefreshCw,
  Play,
  Pause,
  Square,
  Settings,
  Download,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  Target,
  PieChart,
  LineChart
} from 'lucide-react';
import { MarketDataService, RealTimeQuote, NewsItem, EconomicIndicator, AlternativeDataPoint } from '@/services/marketDataService';

export const MarketDataDashboard: React.FC = () => {
  const [quotes, setQuotes] = useState<RealTimeQuote[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [economicIndicators, setEconomicIndicators] = useState<EconomicIndicator[]>([]);
  const [alternativeData, setAlternativeData] = useState<AlternativeDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['AAPL', 'GOOGL', 'MSFT', 'TSLA']);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [marketSentiment, setMarketSentiment] = useState<{
    overall: number;
    bySymbol: Record<string, number>;
    breakdown: {
      news: number;
      social: number;
      technical: number;
      fundamental: number;
    };
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Load quotes for selected symbols
        const quotesPromises = selectedSymbols.map(symbol => 
          MarketDataService.getRealTimeQuote(symbol)
        );
        const quotesData = await Promise.all(quotesPromises);
        setQuotes(quotesData.filter(quote => quote !== null) as RealTimeQuote[]);
        
        // Load news
        const newsData = await MarketDataService.getNewsSentiment(selectedSymbols[0], '24h');
        setNews(newsData);
        
        // Load economic indicators
        const economicData = await MarketDataService.getEconomicIndicators();
        setEconomicIndicators(economicData);
        
        // Load alternative data
        const altData = await MarketDataService.getAlternativeData(selectedSymbols[0], 'sentiment', '24h');
        setAlternativeData(altData);
        
        // Load market sentiment
        const sentiment = await MarketDataService.getMarketSentiment(selectedSymbols);
        setMarketSentiment(sentiment);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading market data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedSymbols]);

  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(async () => {
        const quotesPromises = selectedSymbols.map(symbol => 
          MarketDataService.getRealTimeQuote(symbol)
        );
        const quotesData = await Promise.all(quotesPromises);
        setQuotes(quotesData.filter(quote => quote !== null) as RealTimeQuote[]);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isStreaming, selectedSymbols]);

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

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.2) return 'text-green-400';
    if (sentiment < -0.2) return 'text-red-400';
    return 'text-gray-400';
  };

  const getSentimentBadgeColor = (sentiment: number) => {
    if (sentiment > 0.2) return 'bg-green-900/20 border-green-500/30 text-green-400';
    if (sentiment < -0.2) return 'bg-red-900/20 border-red-500/30 text-red-400';
    return 'bg-gray-900/20 border-gray-500/30 text-gray-400';
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.5) return 'Very Bullish';
    if (sentiment > 0.2) return 'Bullish';
    if (sentiment > -0.2) return 'Neutral';
    if (sentiment > -0.5) return 'Bearish';
    return 'Very Bearish';
  };

  const handleStartStreaming = () => {
    setIsStreaming(true);
  };

  const handleStopStreaming = () => {
    setIsStreaming(false);
  };

  if (isLoading) {
    return (
      <div className="institutional-theme p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
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
          <h1 className="text-3xl font-bold text-white">Market Data Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time market data, news, and alternative data feeds</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-24 institutional-btn">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1m</SelectItem>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="1d">1d</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            className="institutional-btn"
            onClick={isStreaming ? handleStopStreaming : handleStartStreaming}
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Market Sentiment Overview */}
      {marketSentiment && (
        <Card className="institutional-card">
          <CardHeader className="institutional-card-header">
            <CardTitle className="institutional-card-title flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-400" />
              Market Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">
                  {formatPercent(marketSentiment.overall)}
                </div>
                <div className="text-sm text-gray-400 mb-2">Overall Sentiment</div>
                <Badge className={getSentimentBadgeColor(marketSentiment.overall)}>
                  {getSentimentLabel(marketSentiment.overall)}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-2">
                  {formatPercent(marketSentiment.breakdown.news)}
                </div>
                <div className="text-sm text-gray-400">News Sentiment</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-2">
                  {formatPercent(marketSentiment.breakdown.social)}
                </div>
                <div className="text-sm text-gray-400">Social Sentiment</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-2">
                  {formatPercent(marketSentiment.breakdown.technical)}
                </div>
                <div className="text-sm text-gray-400">Technical Sentiment</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Quotes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quotes.map((quote) => (
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
              <div className="text-sm text-gray-400 mb-2">
                Vol: {quote.volume.toLocaleString()}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-400">Bid</div>
                  <div className="text-white">{formatCurrency(quote.bid)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Ask</div>
                  <div className="text-white">{formatCurrency(quote.ask)}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {new Date(quote.timestamp).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="news" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="news">News & Sentiment</TabsTrigger>
          <TabsTrigger value="economic">Economic Data</TabsTrigger>
          <TabsTrigger value="alternative">Alternative Data</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        {/* News & Sentiment Tab */}
        <TabsContent value="news" className="space-y-4">
          <div className="space-y-4">
            {news.map((item) => (
              <Card key={item.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-white">{item.title}</h4>
                      <Badge className={
                        item.sentiment === 'positive' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                        item.sentiment === 'negative' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                        'bg-gray-900/20 border-gray-500/30 text-gray-400'
                      }>
                        {item.sentiment.toUpperCase()}
                      </Badge>
                      <Badge className={
                        item.impact === 'high' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                        item.impact === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                        'bg-green-900/20 border-green-500/30 text-green-400'
                      }>
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

        {/* Economic Data Tab */}
        <TabsContent value="economic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {economicIndicators.map((indicator) => (
              <Card key={indicator.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-white">{indicator.name}</h4>
                    <Badge className={
                      indicator.impact === 'high' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                      indicator.impact === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-green-900/20 border-green-500/30 text-green-400'
                    }>
                      {indicator.impact.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-1">Current</div>
                      <div className="text-xl font-bold text-white">
                        {indicator.value}{indicator.unit}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-1">Previous</div>
                      <div className="text-lg text-gray-300">
                        {indicator.previousValue}{indicator.unit}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-1">Forecast</div>
                      <div className="text-lg text-blue-400">
                        {indicator.forecast}{indicator.unit}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    Release: {new Date(indicator.releaseDate).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Alternative Data Tab */}
        <TabsContent value="alternative" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alternativeData.slice(0, 12).map((data) => (
              <Card key={data.id} className="institutional-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{data.type.toUpperCase()}</h4>
                    <Badge className="bg-gray-700 text-gray-300">
                      {data.symbol}
                    </Badge>
                  </div>
                  
                  <div className="text-2xl font-bold text-white mb-2">
                    {data.value.toFixed(2)}
                  </div>
                  
                  <div className="text-sm text-gray-400 mb-2">
                    Confidence: {formatPercent(data.confidence)}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {new Date(data.timestamp).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Price Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <LineChart className="h-12 w-12 mx-auto mb-2" />
                    <div>Price Chart Integration</div>
                    <div className="text-sm">TradingView Pro integration coming soon</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="institutional-card">
              <CardHeader className="institutional-card-header">
                <CardTitle className="institutional-card-title">Volume Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                    <div>Volume Chart Integration</div>
                    <div className="text-sm">Advanced charting coming soon</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
