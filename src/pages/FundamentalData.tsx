import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, PieChart as PieChartIcon, DollarSign, BarChart2, Calendar, Clock } from 'lucide-react';
import { format, addDays, isAfter, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';

// Mock data for initial display
const mockEconomicData = {
  gdp: [
    { date: '2023-Q1', value: 2.2 },
    { date: '2023-Q2', value: 2.1 },
    { date: '2023-Q3', value: 4.9 },
    { date: '2023-Q4', value: 3.3 },
    { date: '2024-Q1', value: 1.6 },
  ],
  inflation: [
    { date: 'Jan 2024', value: 3.1 },
    { date: 'Feb 2024', value: 3.2 },
    { date: 'Mar 2024', value: 3.5 },
    { date: 'Apr 2024', value: 3.4 },
    { date: 'May 2024', value: 3.3 },
  ],
  unemployment: [
    { date: 'Jan 2024', value: 3.7 },
    { date: 'Feb 2024', value: 3.9 },
    { date: 'Mar 2024', value: 3.8 },
    { date: 'Apr 2024', value: 3.9 },
    { date: 'May 2024', value: 4.0 },
  ],
  interestRates: [
    { date: 'Jan 2024', value: 5.50 },
    { date: 'Feb 2024', value: 5.50 },
    { date: 'Mar 2024', value: 5.50 },
    { date: 'Apr 2024', value: 5.50 },
    { date: 'May 2024', value: 5.50 },
  ],
};

// Current market news
const mockNewsEvents = [
  {
    id: 1,
    title: 'Gold Surges Past $3,000 as Trade Tensions Escalate',
    date: 'May 7, 2025',
    source: 'BullionVault',
    summary: 'Gold prices rallied back above $3,000 per ounce while silver topped $30 as investors seek safe-haven assets amid escalating trade tensions and market volatility.',
    impact: 'Positive for precious metals, negative for risk assets'
  },
  {
    id: 2,
    title: 'Fed Ready to Intervene if Market Liquidity Issues Arise',
    date: 'May 5, 2025',
    source: 'Federal Reserve',
    summary: 'Boston Fed President Susan Collins stated the central bank is prepared to step in if financial markets face liquidity issues, though current conditions remain stable.',
    impact: 'Supportive for market stability, mixed for USD'
  },
  {
    id: 3,
    title: 'U.S. Jobs Report Shows Mixed Signals',
    date: 'May 4, 2025',
    source: 'Bureau of Labor Statistics',
    summary: 'March payrolls increased by 228,000, beating expectations, but unemployment rate rose to 4.2%. Average hourly earnings grew 3.8% annually, the lowest since July 2024.',
    impact: 'Mixed implications for Fed policy and markets'
  },
  {
    id: 4,
    title: 'Global Markets Tumble on Trade Policy Uncertainty',
    date: 'May 3, 2025',
    source: 'Bloomberg',
    summary: 'Major stock indices worldwide saw significant declines as new trade policies and tariffs sparked concerns about global economic growth and supply chain disruptions.',
    impact: 'Negative for global equities and risk assets'
  },
  {
    id: 5,
    title: 'Treasury Yields Surge Amid Market Volatility',
    date: 'May 2, 2025',
    source: 'Reuters',
    summary: 'The 10-year U.S. Treasury yield climbed to 4.5% as markets grapple with trade uncertainty and potential Fed policy shifts, raising concerns about market stability.',
    impact: 'Negative for bonds, challenging for equity valuations'
  }
];

// Upcoming market events with scheduled release times
const mockUpcomingEvents = [
  {
    id: 1,
    title: 'FOMC Meeting Minutes Release',
    date: format(addDays(new Date(), 2), 'MMMM d, yyyy'),
    time: '2:00 PM ET',
    source: 'Federal Reserve',
    description: 'Minutes from the Federal Reserve\'s latest policy meeting, providing insights into discussions about interest rates and economic outlook.',
    importance: 'high'
  },
  {
    id: 2,
    title: 'US Initial Jobless Claims',
    date: format(addDays(new Date(), 1), 'MMMM d, yyyy'),
    time: '8:30 AM ET',
    source: 'Department of Labor',
    description: 'Weekly report on the number of individuals who filed for unemployment insurance for the first time.',
    importance: 'medium'
  },
  {
    id: 3,
    title: 'ECB President Lagarde Speech',
    date: format(addDays(new Date(), 3), 'MMMM d, yyyy'),
    time: '9:00 AM ET',
    source: 'European Central Bank',
    description: 'ECB President Christine Lagarde will discuss monetary policy and economic outlook for the Eurozone.',
    importance: 'high'
  },
  {
    id: 4,
    title: 'US Retail Sales',
    date: format(addDays(new Date(), 5), 'MMMM d, yyyy'),
    time: '8:30 AM ET',
    source: 'Census Bureau',
    description: 'Monthly measurement of retail store sales, showing consumer spending trends across different categories.',
    importance: 'high'
  },
  {
    id: 5,
    title: 'UK Consumer Price Index (CPI)',
    date: format(addDays(new Date(), 4), 'MMMM d, yyyy'),
    time: '2:00 AM ET',
    source: 'Office for National Statistics',
    description: 'Monthly measurement of changes in the prices of consumer goods and services purchased by UK households.',
    importance: 'medium'
  },
  {
    id: 6,
    title: 'Bank of Japan Interest Rate Decision',
    date: format(addDays(new Date(), 7), 'MMMM d, yyyy'),
    time: '11:00 PM ET (Previous Day)',
    source: 'Bank of Japan',
    description: 'The BOJ\'s monetary policy decision, including potential changes to interest rates and asset purchases.',
    importance: 'high'
  },
  {
    id: 7,
    title: 'US GDP (2nd Estimate)',
    date: format(addDays(new Date(), 8), 'MMMM d, yyyy'),
    time: '8:30 AM ET',
    source: 'Bureau of Economic Analysis',
    description: 'Second estimate of U.S. Gross Domestic Product growth, providing updated data on economic expansion.',
    importance: 'high'
  }
];

// Interface for news event
interface NewsEvent {
  id: string;
  title: string;
  date: string;
  source: string;
  summary: string;
  impact: string;
  url?: string;
}

export default function FundamentalData() {
  const [activeTab, setActiveTab] = useState('economic');
  const [economicData, setEconomicData] = useState(mockEconomicData);
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState(mockUpcomingEvents);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const { toast } = useToast();

  // Function to fetch news from Yahoo Finance API
  const fetchMarketNews = async () => {
    try {
      const response = await axios.get('/api/market-news');
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      const newsData = response.data.map((item: any) => ({
        id: item.uuid,
        title: item.title,
        date: format(new Date(item.published_at), 'MMMM d, yyyy'),
        source: item.publisher,
        summary: item.summary,
        impact: determineImpactText(item.sentiment, item.categories),
        url: item.link
      }));
      setNewsEvents(newsData);
      setLastRefreshed(new Date());
    } catch (error: any) {
      console.error('Error fetching market news:', error);
      toast({
        title: "Error fetching news",
        description: error.message || "Unable to fetch latest market news. Please try again later.",
        variant: "destructive"
      });
    }
  };

  // Helper function to format impact text
  const determineImpactText = (sentiment: string, categories: string[]) => {
    const sentimentText = {
      positive: 'Positive',
      negative: 'Negative',
      neutral: 'Mixed'
    }[sentiment] || 'Mixed';

    if (categories.includes('stocks')) return `${sentimentText} for equities`;
    if (categories.includes('bonds')) return `${sentimentText} for fixed income`;
    if (categories.includes('forex')) return `${sentimentText} for currencies`;
    if (categories.includes('commodities')) return `${sentimentText} for commodities`;
    return `${sentimentText} impact on markets`;
  };

  // Function to fetch latest data
  const fetchLatestData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchMarketNews(),
        // Add other data fetching functions here
      ]);
      toast({
        title: "Data refreshed",
        description: "Market news and data have been updated",
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to refresh some data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if data needs to be refreshed (daily)
  useEffect(() => {
    const checkDataFreshness = () => {
      const now = new Date();
      const lastRefreshDate = lastRefreshed.toDateString();
      const currentDate = now.toDateString();
      
      if (lastRefreshDate !== currentDate) {
        fetchLatestData();
      }
    };
    
    // Check data freshness when component mounts
    checkDataFreshness();
    
    // Set up interval to check data freshness (every hour)
    const intervalId = setInterval(checkDataFreshness, 3600000); // 1 hour
    
    // Fetch news immediately on mount
    fetchLatestData();
    
    return () => clearInterval(intervalId);
  }, [lastRefreshed, fetchLatestData]);

  const formatPercent = (value) => `${value}%`;
  const formatGDP = (value) => `${value}%`;
  const formatRate = (value) => `${value}%`;

  // Helper function to render importance badge
  const renderImportanceBadge = (importance) => {
    const styles = {
      high: "bg-red-100 text-red-800 border-red-200",
      medium: "bg-amber-100 text-amber-800 border-amber-200",
      low: "bg-blue-100 text-blue-800 border-blue-200"
    };
    
    return (
      <Badge variant="outline" className={`${styles[importance]} text-xs font-medium px-2 py-0.5`}>
        {importance.charAt(0).toUpperCase() + importance.slice(1)} Impact
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-purple-500">
            Economic & Fundamental Data
          </h1>
          <p className="text-gray-600 mt-1">Track key economic indicators and market-moving events</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-4 sm:mt-0">
          <p className="text-sm text-gray-500 mr-2">
            Last updated: {lastRefreshed.toLocaleString()}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchLatestData} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="economic" onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="economic" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>Economic Indicators</span>
          </TabsTrigger>
          <TabsTrigger value="news" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            <span>Market News</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Upcoming Events</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span>Company Fundamentals</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="economic" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GDP Growth Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  GDP Growth Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={economicData.gdp}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={formatGDP} />
                      <Tooltip formatter={(value) => [`${value}%`, 'GDP Growth']} />
                      <Bar dataKey="value" fill="#3b82f6" name="GDP Growth %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <p>Latest: <span className="font-medium text-blue-600">{economicData.gdp[economicData.gdp.length - 1].value}%</span> ({economicData.gdp[economicData.gdp.length - 1].date})</p>
                  <p>Source: Bureau of Economic Analysis (BEA)</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Inflation Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-magenta-500" />
                  Inflation Rate (CPI)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={economicData.inflation}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={formatPercent} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Inflation Rate']} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#d946ef" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Inflation %" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <p>Latest: <span className="font-medium text-magenta-600">{economicData.inflation[economicData.inflation.length - 1].value}%</span> ({economicData.inflation[economicData.inflation.length - 1].date})</p>
                  <p>Source: Bureau of Labor Statistics (BLS)</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Unemployment Rate Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-green-500" />
                  Unemployment Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={economicData.unemployment}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={formatPercent} domain={[3, 5]} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Unemployment Rate']} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Unemployment %" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <p>Latest: <span className="font-medium text-green-600">{economicData.unemployment[economicData.unemployment.length - 1].value}%</span> ({economicData.unemployment[economicData.unemployment.length - 1].date})</p>
                  <p>Source: Bureau of Labor Statistics (BLS)</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Interest Rates Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                  Federal Funds Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={economicData.interestRates}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={formatRate} domain={[0, 6]} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Fed Funds Rate']} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Interest Rate %" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <p>Latest: <span className="font-medium text-amber-600">{economicData.interestRates[economicData.interestRates.length - 1].value}%</span> ({economicData.interestRates[economicData.interestRates.length - 1].date})</p>
                  <p>Source: Federal Reserve</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="news" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Market-Moving News & Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : newsEvents.length > 0 ? (
                  newsEvents.map(news => (
                    <div key={news.id} className="border-b border-gray-200 pb-4 last:border-0">
                      <h3 className="text-lg font-bold text-gray-900">
                        {news.url ? (
                          <a href={news.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                            {news.title}
                          </a>
                        ) : news.title}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <span>{news.date}</span>
                        <span className="mx-2">•</span>
                        <span>{news.source}</span>
                      </div>
                      <p className="mt-2 text-gray-700">{news.summary}</p>
                      <div className="mt-2">
                        <span className="text-sm font-medium">Market Impact: </span>
                        <span className="text-sm text-gray-700">{news.impact}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No market news available at the moment
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* New tab for upcoming market events */}
        <TabsContent value="upcoming" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Market Events & Releases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingEvents.map(event => (
                  <div key={event.id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-gray-900">{event.title}</h3>
                      {renderImportanceBadge(event.importance)}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{event.date}</span>
                      <span className="mx-2">•</span>
                      <Clock className="h-4 w-4 mr-1" />
                      <span className="font-medium">{event.time}</span>
                      <span className="mx-2">•</span>
                      <span>{event.source}</span>
                    </div>
                    <p className="mt-2 text-gray-700">{event.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="companies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Fundamentals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Coming Soon</h3>
                <p className="text-gray-600">
                  We're working on adding company-specific fundamental data, including:
                </p>
                <ul className="mt-4 space-y-2 max-w-md mx-auto text-left">
                  <li className="flex items-start">
                    <span className="h-6 flex items-center">
                      <svg className="flex-shrink-0 h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="ml-2">Earnings reports & financial metrics</span>
                  </li>
                  <li className="flex items-start">
                    <span className="h-6 flex items-center">
                      <svg className="flex-shrink-0 h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="ml-2">Stock performance & technical indicators</span>
                  </li>
                  <li className="flex items-start">
                    <span className="h-6 flex items-center">
                      <svg className="flex-shrink-0 h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="ml-2">Valuation metrics (P/E, EV/EBITDA, etc.)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="h-6 flex items-center">
                      <svg className="flex-shrink-0 h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="ml-2">Analyst ratings & price targets</span>
                  </li>
                  <li className="flex items-start">
                    <span className="h-6 flex items-center">
                      <svg className="flex-shrink-0 h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="ml-2">Insider trading activity</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8 text-sm text-gray-500 text-center">
        <p>Data is updated daily. Sources include Federal Reserve, BEA, BLS, and major financial news outlets.</p>
        <p className="mt-1">This information is provided for educational purposes only and should not be considered financial advice.</p>
      </div>
    </div>
  );
} 