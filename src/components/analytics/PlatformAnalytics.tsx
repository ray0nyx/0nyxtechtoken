/**
 * Platform Analytics Dashboard
 * Comprehensive analytics and monitoring for the backtesting platform
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity, 
  Clock, 
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { toast } from 'sonner';

interface SystemMetrics {
  timestamp: string;
  activeUsers: number;
  totalBacktests: number;
  runningBacktests: number;
  completedBacktests: number;
  failedBacktests: number;
  queueLength: number;
  activeWorkers: number;
  systemLoad: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  averageBacktestDuration: number;
  totalRevenue: number;
  newUsers: number;
  strategiesCreated: number;
  marketplaceListings: number;
}

interface UserActivity {
  timestamp: string;
  activeUsers: number;
  newRegistrations: number;
  backtestsStarted: number;
  strategiesCreated: number;
  marketplacePurchases: number;
}

interface BacktestMetrics {
  timestamp: string;
  totalBacktests: number;
  successfulBacktests: number;
  failedBacktests: number;
  averageDuration: number;
  queueDepth: number;
}

interface RevenueMetrics {
  timestamp: string;
  totalRevenue: number;
  subscriptionRevenue: number;
  marketplaceRevenue: number;
  newSubscriptions: number;
  marketplacePurchases: number;
}

interface ErrorMetrics {
  timestamp: string;
  totalErrors: number;
  backtestErrors: number;
  dataErrors: number;
  systemErrors: number;
  errorRate: number;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
  purple: '#8b5cf6',
  pink: '#ec4899',
  gray: '#6b7280'
};

export const PlatformAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [backtestMetrics, setBacktestMetrics] = useState<BacktestMetrics[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics[]>([]);
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  // Load analytics data
  useEffect(() => {
    loadAnalyticsData();
    const interval = setInterval(loadAnalyticsData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      const [systemData, userData, backtestData, revenueData, errorData] = await Promise.all([
        fetch(`/api/analytics/system?range=${timeRange}`).then(res => res.json()),
        fetch(`/api/analytics/users?range=${timeRange}`).then(res => res.json()),
        fetch(`/api/analytics/backtests?range=${timeRange}`).then(res => res.json()),
        fetch(`/api/analytics/revenue?range=${timeRange}`).then(res => res.json()),
        fetch(`/api/analytics/errors?range=${timeRange}`).then(res => res.json())
      ]);

      setSystemMetrics(systemData.metrics || []);
      setUserActivity(userData.metrics || []);
      setBacktestMetrics(backtestData.metrics || []);
      setRevenueMetrics(revenueData.metrics || []);
      setErrorMetrics(errorData.metrics || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const currentMetrics = useMemo(() => {
    if (systemMetrics.length === 0) return null;
    return systemMetrics[systemMetrics.length - 1];
  }, [systemMetrics]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return COLORS.success;
    if (value >= thresholds.warning) return COLORS.warning;
    return COLORS.danger;
  };

  if (loading && systemMetrics.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and analytics for the backtesting platform
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadAnalyticsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="backtests">Backtests</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Users</p>
                        <p className="text-2xl font-bold">{formatNumber(currentMetrics?.activeUsers || 0)}</p>
                      </div>
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Running Backtests</p>
                        <p className="text-2xl font-bold">{formatNumber(currentMetrics?.runningBacktests || 0)}</p>
                      </div>
                      <Activity className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">System Load</p>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: getStatusColor(currentMetrics?.systemLoad || 0, { good: 0.7, warning: 0.9 }) }}
                        >
                          {formatPercentage(currentMetrics?.systemLoad || 0)}
                        </p>
                      </div>
                      <Zap className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Error Rate</p>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: getStatusColor(currentMetrics?.errorRate || 0, { good: 0.01, warning: 0.05 }) }}
                        >
                          {formatPercentage(currentMetrics?.errorRate || 0)}
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* System Health Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={systemMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="activeUsers" 
                          stackId="1" 
                          stroke={COLORS.primary} 
                          fill={COLORS.primary}
                          fillOpacity={0.6}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="runningBacktests" 
                          stackId="1" 
                          stroke={COLORS.success} 
                          fill={COLORS.success}
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Backtest Performance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Backtest Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Successful', value: currentMetrics?.completedBacktests || 0, color: COLORS.success },
                              { name: 'Failed', value: currentMetrics?.failedBacktests || 0, color: COLORS.danger }
                            ]}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                          >
                            {data.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Resource Utilization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>CPU Usage</span>
                          <span>{formatPercentage(currentMetrics?.cpuUsage || 0)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(currentMetrics?.cpuUsage || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Memory Usage</span>
                          <span>{formatPercentage(currentMetrics?.memoryUsage || 0)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-success h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(currentMetrics?.memoryUsage || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Queue Depth</span>
                          <span>{formatNumber(currentMetrics?.queueLength || 0)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-warning h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentMetrics?.queueLength || 0) / 10)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="users" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userActivity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="activeUsers" 
                          stroke={COLORS.primary} 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="newRegistrations" 
                          stroke={COLORS.success} 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="backtests" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Backtest Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={backtestMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                        />
                        <Bar dataKey="totalBacktests" fill={COLORS.primary} />
                        <Bar dataKey="successfulBacktests" fill={COLORS.success} />
                        <Bar dataKey="failedBacktests" fill={COLORS.danger} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="revenue" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="totalRevenue" 
                          stroke={COLORS.success} 
                          fill={COLORS.success}
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="errors" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Error Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={errorMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="totalErrors" 
                          stroke={COLORS.danger} 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="backtestErrors" 
                          stroke={COLORS.warning} 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="systemErrors" 
                          stroke={COLORS.info} 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlatformAnalytics;
