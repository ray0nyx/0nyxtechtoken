import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Shield,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  Activity,
  Download,
  RefreshCw,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { RiskMetricsCard } from '@/components/risk/RiskMetricsCard';
import { StressTestCard } from '@/components/risk/StressTestCard';
import { CorrelationMatrixCard } from '@/components/risk/CorrelationMatrix';
import { DrawdownAnalysisCard } from '@/components/risk/DrawdownAnalysis';

export default function RiskDashboard() {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const timeRanges = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
    { value: 'all', label: 'All Time' }
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-purple-500">
              Risk Analytics
            </h1>
            <p className="text-muted-foreground">
              Comprehensive risk analysis, stress testing, and portfolio monitoring
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'overview' ? 'detailed' : 'overview')}
            >
              {viewMode === 'overview' ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              {viewMode === 'overview' ? 'Detailed' : 'Overview'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
            
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Risk Alerts */}
        <Card className="border-orange-200 bg-gray-100 dark:border-orange-800 dark:bg-orange-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-800 dark:text-orange-200">
                  Risk Alerts
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  High leverage detected (2.5x), consider reducing position sizes
                </p>
              </div>
              <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Risk Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RiskMetricsCard />
          </div>
          <div className="space-y-6">
            <StressTestCard />
          </div>
        </div>

        {/* Advanced Analytics */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Advanced Analytics</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>
          
          {showAdvanced && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CorrelationMatrixCard />
              <DrawdownAnalysisCard />
            </div>
          )}
        </div>

        {/* Risk Summary */}
        <Card className="bg-gray-100 dark:bg-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary" />
              Risk Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="font-medium text-green-700 dark:text-green-300">Portfolio Health</h3>
                <p className="text-sm text-muted-foreground">Good</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingDown className="h-8 w-8 text-yellow-500" />
                </div>
                <h3 className="font-medium text-yellow-700 dark:text-yellow-300">Drawdown Risk</h3>
                <p className="text-sm text-muted-foreground">Moderate</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="font-medium text-blue-700 dark:text-blue-300">Diversification</h3>
                <p className="text-sm text-muted-foreground">Fair</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Activity className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="font-medium text-orange-700 dark:text-orange-300">Volatility</h3>
                <p className="text-sm text-muted-foreground">High</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-primary" />
              Risk Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2" />
                <div className="flex-1">
                  <h4 className="font-medium">Reduce Leverage</h4>
                  <p className="text-sm text-muted-foreground">
                    Current leverage of 2.5x exceeds recommended 2.0x. Consider reducing position sizes.
                  </p>
                </div>
                <Badge variant="outline" className="text-yellow-600">Medium Priority</Badge>
              </div>
              
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2" />
                <div className="flex-1">
                  <h4 className="font-medium">Improve Diversification</h4>
                  <p className="text-sm text-muted-foreground">
                    Portfolio shows high correlation between positions. Consider adding uncorrelated assets.
                  </p>
                </div>
                <Badge variant="outline" className="text-orange-600">High Priority</Badge>
              </div>
              
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                <div className="flex-1">
                  <h4 className="font-medium">Monitor Drawdowns</h4>
                  <p className="text-sm text-muted-foreground">
                  Current drawdown levels are within acceptable limits. Continue monitoring.
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">Low Priority</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
