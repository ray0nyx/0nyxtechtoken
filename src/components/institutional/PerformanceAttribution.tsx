import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Target,
  Settings,
  Download,
  Filter,
  Calendar,
  DollarSign,
  Percent,
  Activity
} from 'lucide-react';

interface AttributionData {
  period: string;
  totalReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  alpha: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  rSquared: number;
  correlation: number;
}

interface FactorAttribution {
  factor: string;
  exposure: number;
  return: number;
  contribution: number;
  risk: number;
  type: 'market' | 'size' | 'value' | 'momentum' | 'quality' | 'volatility' | 'custom';
}

interface SectorAttribution {
  sector: string;
  weight: number;
  benchmarkWeight: number;
  activeWeight: number;
  return: number;
  benchmarkReturn: number;
  contribution: number;
  risk: number;
}

interface SecurityAttribution {
  symbol: string;
  weight: number;
  benchmarkWeight: number;
  activeWeight: number;
  return: number;
  benchmarkReturn: number;
  contribution: number;
  risk: number;
  sector: string;
}

export const PerformanceAttribution: React.FC = () => {
  const [attributionData, setAttributionData] = useState<AttributionData[]>([]);
  const [factorAttribution, setFactorAttribution] = useState<FactorAttribution[]>([]);
  const [sectorAttribution, setSectorAttribution] = useState<SectorAttribution[]>([]);
  const [securityAttribution, setSecurityAttribution] = useState<SecurityAttribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAttributionData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      setAttributionData([
        {
          period: '2024 Q1',
          totalReturn: 0.125,
          benchmarkReturn: 0.092,
          activeReturn: 0.033,
          alpha: 0.028,
          beta: 0.89,
          trackingError: 0.045,
          informationRatio: 0.73,
          rSquared: 0.78,
          correlation: 0.88
        },
        {
          period: '2024 Q2',
          totalReturn: 0.089,
          benchmarkReturn: 0.076,
          activeReturn: 0.013,
          alpha: 0.015,
          beta: 0.92,
          trackingError: 0.038,
          informationRatio: 0.34,
          rSquared: 0.82,
          correlation: 0.91
        },
        {
          period: '2024 Q3',
          totalReturn: 0.156,
          benchmarkReturn: 0.134,
          activeReturn: 0.022,
          alpha: 0.018,
          beta: 0.85,
          trackingError: 0.052,
          informationRatio: 0.42,
          rSquared: 0.75,
          correlation: 0.87
        }
      ]);

      setFactorAttribution([
        {
          factor: 'Market Factor',
          exposure: 0.89,
          return: 0.092,
          contribution: 0.082,
          risk: 0.045,
          type: 'market'
        },
        {
          factor: 'Size Factor',
          exposure: 0.23,
          return: 0.034,
          contribution: 0.008,
          risk: 0.012,
          type: 'size'
        },
        {
          factor: 'Value Factor',
          exposure: 0.41,
          return: 0.028,
          contribution: 0.011,
          risk: 0.018,
          type: 'value'
        },
        {
          factor: 'Momentum Factor',
          exposure: 0.67,
          return: 0.045,
          contribution: 0.030,
          risk: 0.025,
          type: 'momentum'
        },
        {
          factor: 'Quality Factor',
          exposure: 0.34,
          return: 0.019,
          contribution: 0.006,
          risk: 0.015,
          type: 'quality'
        },
        {
          factor: 'Volatility Factor',
          exposure: -0.28,
          return: -0.012,
          contribution: 0.003,
          risk: 0.008,
          type: 'volatility'
        }
      ]);

      setSectorAttribution([
        {
          sector: 'Technology',
          weight: 0.35,
          benchmarkWeight: 0.28,
          activeWeight: 0.07,
          return: 0.142,
          benchmarkReturn: 0.118,
          contribution: 0.012,
          risk: 0.025
        },
        {
          sector: 'Healthcare',
          weight: 0.20,
          benchmarkWeight: 0.22,
          activeWeight: -0.02,
          return: 0.089,
          benchmarkReturn: 0.095,
          contribution: -0.001,
          risk: 0.018
        },
        {
          sector: 'Financials',
          weight: 0.15,
          benchmarkWeight: 0.18,
          activeWeight: -0.03,
          return: 0.076,
          benchmarkReturn: 0.082,
          contribution: -0.002,
          risk: 0.022
        },
        {
          sector: 'Consumer Discretionary',
          weight: 0.18,
          benchmarkWeight: 0.16,
          activeWeight: 0.02,
          return: 0.098,
          benchmarkReturn: 0.085,
          contribution: 0.003,
          risk: 0.020
        },
        {
          sector: 'Industrials',
          weight: 0.12,
          benchmarkWeight: 0.16,
          activeWeight: -0.04,
          return: 0.067,
          benchmarkReturn: 0.074,
          contribution: -0.003,
          risk: 0.015
        }
      ]);

      setSecurityAttribution([
        {
          symbol: 'AAPL',
          weight: 0.15,
          benchmarkWeight: 0.12,
          activeWeight: 0.03,
          return: 0.156,
          benchmarkReturn: 0.134,
          contribution: 0.007,
          risk: 0.018,
          sector: 'Technology'
        },
        {
          symbol: 'MSFT',
          weight: 0.18,
          benchmarkWeight: 0.16,
          activeWeight: 0.02,
          return: 0.142,
          benchmarkReturn: 0.128,
          contribution: 0.004,
          risk: 0.015,
          sector: 'Technology'
        },
        {
          symbol: 'GOOGL',
          weight: 0.22,
          benchmarkWeight: 0.20,
          activeWeight: 0.02,
          return: 0.134,
          benchmarkReturn: 0.118,
          contribution: 0.003,
          risk: 0.022,
          sector: 'Technology'
        },
        {
          symbol: 'JNJ',
          weight: 0.08,
          benchmarkWeight: 0.10,
          activeWeight: -0.02,
          return: 0.067,
          benchmarkReturn: 0.072,
          contribution: -0.001,
          risk: 0.012,
          sector: 'Healthcare'
        },
        {
          symbol: 'JPM',
          weight: 0.06,
          benchmarkWeight: 0.08,
          activeWeight: -0.02,
          return: 0.089,
          benchmarkReturn: 0.095,
          contribution: -0.001,
          risk: 0.014,
          sector: 'Financials'
        }
      ]);

      setIsLoading(false);
    };

    loadAttributionData();
  }, []);

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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

  const getContributionColor = (value: number) => {
    if (value > 0.01) return 'text-green-400';
    if (value > 0) return 'text-green-300';
    if (value > -0.01) return 'text-yellow-400';
    return 'text-red-400';
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
          <h1 className="text-3xl font-bold text-white">Performance Attribution</h1>
          <p className="text-gray-400 mt-1">Factor analysis, sector allocation, and security-level attribution</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="institutional-btn">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="institutional-btn">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="institutional-tabs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="factors">Factor Analysis</TabsTrigger>
          <TabsTrigger value="sectors">Sector Allocation</TabsTrigger>
          <TabsTrigger value="securities">Security Level</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {attributionData.map((data, index) => (
              <Card key={index} className="institutional-card">
                <CardHeader className="institutional-card-header">
                  <CardTitle className="institutional-card-title">{data.period}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Return</span>
                    <span className={`font-mono text-lg ${data.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(data.totalReturn)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Benchmark Return</span>
                    <span className="font-mono text-lg text-blue-400">
                      {formatPercent(data.benchmarkReturn)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Active Return</span>
                    <span className={`font-mono text-lg ${data.activeReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(data.activeReturn)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Alpha</span>
                    <span className={`font-mono text-lg ${data.alpha >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(data.alpha)}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Information Ratio</span>
                      <span className="font-mono text-blue-400">
                        {data.informationRatio.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Factor Analysis Tab */}
        <TabsContent value="factors" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title">Factor Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {factorAttribution.map((factor, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-white">{factor.factor}</h4>
                        <Badge className={`${getFactorTypeColor(factor.type)} bg-gray-800`}>
                          {factor.type.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Contribution</div>
                        <div className={`font-mono text-lg ${getContributionColor(factor.contribution)}`}>
                          {formatPercent(factor.contribution)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Exposure</div>
                        <div className="font-mono text-lg text-blue-400">
                          {factor.exposure.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Factor Return</div>
                        <div className="font-mono text-lg text-green-400">
                          {formatPercent(factor.return)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Risk</div>
                        <div className="font-mono text-lg text-orange-400">
                          {formatPercent(factor.risk)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Contribution</div>
                        <div className={`font-mono text-lg ${getContributionColor(factor.contribution)}`}>
                          {formatPercent(factor.contribution)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sector Allocation Tab */}
        <TabsContent value="sectors" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title">Sector Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sectorAttribution.map((sector, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">{sector.sector}</h4>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          sector.activeWeight > 0 ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                          'bg-red-900/20 border-red-500/30 text-red-400'
                        }>
                          {sector.activeWeight > 0 ? '+' : ''}{formatPercent(sector.activeWeight)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Portfolio Weight</div>
                        <div className="font-mono text-lg text-white">
                          {formatPercent(sector.weight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Benchmark Weight</div>
                        <div className="font-mono text-lg text-blue-400">
                          {formatPercent(sector.benchmarkWeight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Sector Return</div>
                        <div className="font-mono text-lg text-green-400">
                          {formatPercent(sector.return)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Contribution</div>
                        <div className={`font-mono text-lg ${getContributionColor(sector.contribution)}`}>
                          {formatPercent(sector.contribution)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Risk</span>
                        <span className="text-sm text-orange-400">
                          {formatPercent(sector.risk)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Level Tab */}
        <TabsContent value="securities" className="space-y-4">
          <Card className="institutional-card">
            <CardHeader className="institutional-card-header">
              <CardTitle className="institutional-card-title">Security Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityAttribution.map((security, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-white">{security.symbol}</h4>
                        <Badge className="bg-gray-700 text-gray-300">
                          {security.sector}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Contribution</div>
                        <div className={`font-mono text-lg ${getContributionColor(security.contribution)}`}>
                          {formatPercent(security.contribution)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Portfolio Weight</div>
                        <div className="font-mono text-lg text-white">
                          {formatPercent(security.weight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Benchmark Weight</div>
                        <div className="font-mono text-lg text-blue-400">
                          {formatPercent(security.benchmarkWeight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Security Return</div>
                        <div className="font-mono text-lg text-green-400">
                          {formatPercent(security.return)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Contribution</div>
                        <div className={`font-mono text-lg ${getContributionColor(security.contribution)}`}>
                          {formatPercent(security.contribution)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Risk</span>
                        <span className="text-sm text-orange-400">
                          {formatPercent(security.risk)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
