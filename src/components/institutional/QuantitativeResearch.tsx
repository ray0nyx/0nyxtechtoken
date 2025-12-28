import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Target,
  Settings,
  Play,
  Pause,
  Square,
  Download,
  Upload,
  Code,
  Brain,
  Database,
  Zap
} from 'lucide-react';

interface Factor {
  name: string;
  description: string;
  value: number;
  significance: number;
  pValue: number;
  rSquared: number;
  type: 'market' | 'size' | 'value' | 'momentum' | 'quality' | 'volatility' | 'custom';
}

interface BacktestResult {
  id: string;
  name: string;
  strategy: string;
  startDate: string;
  endDate: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
}

interface MLModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'time_series';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  status: 'training' | 'trained' | 'deployed' | 'failed';
  lastUpdated: string;
}

interface AlternativeData {
  source: string;
  type: 'satellite' | 'sentiment' | 'news' | 'social' | 'economic';
  description: string;
  frequency: string;
  lastUpdate: string;
  quality: 'high' | 'medium' | 'low';
  cost: number;
}

export const QuantitativeResearch: React.FC = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [mlModels, setMlModels] = useState<MLModel[]>([]);
  const [alternativeData, setAlternativeData] = useState<AlternativeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResearchData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      setFactors([
        {
          name: 'Market Factor',
          description: 'Overall market movement',
          value: 0.85,
          significance: 0.95,
          pValue: 0.001,
          rSquared: 0.72,
          type: 'market'
        },
        {
          name: 'Size Factor',
          description: 'Small cap vs large cap',
          value: 0.23,
          significance: 0.78,
          pValue: 0.045,
          rSquared: 0.15,
          type: 'size'
        },
        {
          name: 'Value Factor',
          description: 'Value vs growth stocks',
          value: 0.41,
          significance: 0.82,
          pValue: 0.023,
          rSquared: 0.28,
          type: 'value'
        },
        {
          name: 'Momentum Factor',
          description: 'Price momentum effect',
          value: 0.67,
          significance: 0.91,
          pValue: 0.008,
          rSquared: 0.45,
          type: 'momentum'
        },
        {
          name: 'Quality Factor',
          description: 'High quality vs low quality',
          value: 0.34,
          significance: 0.76,
          pValue: 0.034,
          rSquared: 0.22,
          type: 'quality'
        },
        {
          name: 'Volatility Factor',
          description: 'Low volatility anomaly',
          value: -0.28,
          significance: 0.69,
          pValue: 0.067,
          rSquared: 0.18,
          type: 'volatility'
        }
      ]);

      setBacktests([
        {
          id: '1',
          name: 'Momentum Strategy',
          strategy: '12-month momentum with 1-month skip',
          startDate: '2020-01-01',
          endDate: '2024-01-01',
          totalReturn: 45.2,
          sharpeRatio: 1.85,
          maxDrawdown: -12.3,
          winRate: 0.68,
          status: 'completed',
          progress: 100
        },
        {
          id: '2',
          name: 'Mean Reversion',
          strategy: 'Bollinger Bands with RSI confirmation',
          startDate: '2020-01-01',
          endDate: '2024-01-01',
          totalReturn: 28.7,
          sharpeRatio: 1.42,
          maxDrawdown: -8.9,
          winRate: 0.72,
          status: 'completed',
          progress: 100
        },
        {
          id: '3',
          name: 'Factor Model',
          strategy: 'Multi-factor model with ML optimization',
          startDate: '2020-01-01',
          endDate: '2024-01-01',
          totalReturn: 52.1,
          sharpeRatio: 2.15,
          maxDrawdown: -9.8,
          winRate: 0.75,
          status: 'running',
          progress: 75
        },
        {
          id: '4',
          name: 'Arbitrage Strategy',
          strategy: 'Pairs trading with cointegration',
          startDate: '2020-01-01',
          endDate: '2024-01-01',
          totalReturn: 18.3,
          sharpeRatio: 1.28,
          maxDrawdown: -5.2,
          winRate: 0.65,
          status: 'paused',
          progress: 60
        }
      ]);

      setMlModels([
        {
          id: '1',
          name: 'Price Prediction LSTM',
          type: 'time_series',
          accuracy: 0.78,
          precision: 0.82,
          recall: 0.75,
          f1Score: 0.78,
          status: 'deployed',
          lastUpdated: '2024-01-15'
        },
        {
          id: '2',
          name: 'Sentiment Classifier',
          type: 'classification',
          accuracy: 0.85,
          precision: 0.88,
          recall: 0.83,
          f1Score: 0.85,
          status: 'trained',
          lastUpdated: '2024-01-20'
        },
        {
          id: '3',
          name: 'Risk Clustering',
          type: 'clustering',
          accuracy: 0.72,
          precision: 0.75,
          recall: 0.70,
          f1Score: 0.72,
          status: 'training',
          lastUpdated: '2024-01-22'
        }
      ]);

      setAlternativeData([
        {
          source: 'Satellite Imagery',
          type: 'satellite',
          description: 'Parking lot occupancy data for retail analysis',
          frequency: 'Daily',
          lastUpdate: '2024-01-22',
          quality: 'high',
          cost: 5000
        },
        {
          source: 'Twitter Sentiment',
          type: 'sentiment',
          description: 'Real-time sentiment analysis from social media',
          frequency: 'Real-time',
          lastUpdate: '2024-01-22',
          quality: 'medium',
          cost: 2000
        },
        {
          source: 'News Flow',
          type: 'news',
          description: 'Financial news sentiment and topic analysis',
          frequency: 'Hourly',
          lastUpdate: '2024-01-22',
          quality: 'high',
          cost: 3000
        },
        {
          source: 'Economic Indicators',
          type: 'economic',
          description: 'Real-time economic data and forecasts',
          frequency: 'Daily',
          lastUpdate: '2024-01-22',
          quality: 'high',
          cost: 1500
        }
      ]);

      setIsLoading(false);
    };

    loadResearchData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getFactorTypeColor = (type: string) => {
    switch (type) {
      case 'market': return 'text-blue-400';
      case 'size': return 'text-green-400';
      case 'value': return 'text-purple-400';
      case 'momentum': return 'text-orange-400';
      case 'quality': return 'text-pink-400';
      case 'volatility': return 'text-red-400';
      case 'custom': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-blue-400';
      case 'paused': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      case 'trained': return 'text-green-400';
      case 'training': return 'text-blue-400';
      case 'deployed': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-red-400';
      default: return 'text-gray-400';
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
          <h1 className="text-3xl font-bold text-white">Quantitative Research Platform</h1>
          <p className="text-gray-400 mt-1">Advanced factor analysis, backtesting, and machine learning</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="institutional-btn">
            <Code className="h-4 w-4 mr-2" />
            Python/R
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="factors" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="factors">Factor Analysis</TabsTrigger>
          <TabsTrigger value="backtesting">Backtesting</TabsTrigger>
          <TabsTrigger value="ml">Machine Learning</TabsTrigger>
          <TabsTrigger value="data">Alternative Data</TabsTrigger>
        </TabsList>

        {/* Factor Analysis Tab */}
        <TabsContent value="factors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {factors.map((factor, index) => (
              <Card key={index} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {factor.name}
                    </CardTitle>
                    <Badge className={`${getFactorTypeColor(factor.type)} bg-gray-800`}>
                      {factor.type.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">{factor.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Factor Value</span>
                      <span className={`font-mono text-lg ${factor.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {factor.value.toFixed(3)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Significance</span>
                      <span className="font-mono text-lg text-blue-400">
                        {formatPercent(factor.significance)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">P-Value</span>
                      <span className={`font-mono text-lg ${factor.pValue < 0.05 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {factor.pValue.toFixed(3)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">R²</span>
                      <span className="font-mono text-lg text-purple-400">
                        {formatPercent(factor.rSquared)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Analyze
                      </Button>
                      <Button variant="outline" size="sm" className="institutional-btn">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Backtesting Tab */}
        <TabsContent value="backtesting" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Backtest Results</h3>
            <Button variant="outline" size="sm" className="institutional-btn">
              <Play className="h-4 w-4 mr-2" />
              New Backtest
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {backtests.map((backtest) => (
              <Card key={backtest.id} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {backtest.name}
                    </CardTitle>
                    <Badge className={
                      backtest.status === 'completed' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                      backtest.status === 'running' ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' :
                      backtest.status === 'paused' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-red-900/20 border-red-500/30 text-red-400'
                    }>
                      {backtest.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">{backtest.strategy}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Return</span>
                      <span className={`font-mono text-lg ${backtest.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {backtest.totalReturn >= 0 ? '+' : ''}{backtest.totalReturn.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Sharpe Ratio</span>
                      <span className="font-mono text-lg text-blue-400">
                        {backtest.sharpeRatio.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Max Drawdown</span>
                      <span className="font-mono text-lg text-red-400">
                        {backtest.maxDrawdown.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Win Rate</span>
                      <span className="font-mono text-lg text-purple-400">
                        {formatPercent(backtest.winRate)}
                      </span>
                    </div>
                  </div>
                  
                  {backtest.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-sm text-gray-300">{backtest.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${backtest.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">
                      {backtest.startDate} - {backtest.endDate}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <LineChart className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="institutional-btn">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Machine Learning Tab */}
        <TabsContent value="ml" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mlModels.map((model) => (
              <Card key={model.id} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {model.name}
                    </CardTitle>
                    <Badge className={
                      model.status === 'deployed' ? 'bg-purple-900/20 border-purple-500/30 text-purple-400' :
                      model.status === 'trained' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                      model.status === 'training' ? 'bg-blue-900/20 border-blue-500/30 text-blue-400' :
                      'bg-red-900/20 border-red-500/30 text-red-400'
                    }>
                      {model.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-400">{model.type.toUpperCase()}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Accuracy</span>
                      <span className="font-mono text-lg text-green-400">
                        {formatPercent(model.accuracy)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Precision</span>
                      <span className="font-mono text-lg text-blue-400">
                        {formatPercent(model.precision)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Recall</span>
                      <span className="font-mono text-lg text-purple-400">
                        {formatPercent(model.recall)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">F1 Score</span>
                      <span className="font-mono text-lg text-orange-400">
                        {formatPercent(model.f1Score)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-2">
                      Last Updated: {model.lastUpdated}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <Brain className="h-4 w-4 mr-1" />
                        Deploy
                      </Button>
                      <Button variant="outline" size="sm" className="institutional-btn">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Alternative Data Tab */}
        <TabsContent value="data" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alternativeData.map((data, index) => (
              <Card key={index} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="institutional-card-title">
                      {data.source}
                    </CardTitle>
                    <Badge className={
                      data.quality === 'high' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                      data.quality === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                      'bg-red-900/20 border-red-500/30 text-red-400'
                    }>
                      {data.quality.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-400">{data.type.toUpperCase()}</span>
                  </div>
                  
                  <p className="text-sm text-gray-400">{data.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Frequency</span>
                      <span className="text-sm text-gray-300">{data.frequency}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Last Update</span>
                      <span className="text-sm text-gray-300">{data.lastUpdate}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Cost</span>
                      <span className="font-mono text-lg text-green-400">
                        {formatCurrency(data.cost)}/month
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="institutional-btn flex-1">
                        <Zap className="h-4 w-4 mr-1" />
                        Integrate
                      </Button>
                      <Button variant="outline" size="sm" className="institutional-btn">
                        <Settings className="h-4 w-4" />
                      </Button>
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
