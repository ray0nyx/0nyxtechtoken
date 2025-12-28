import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Bitcoin,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  fetchBitcoinOnChainMetrics,
  fetchBitcoinWhaleMovements,
  type BitcoinOnChainMetric,
  type BitcoinWhaleMovement
} from '@/lib/bitcoin-onchain';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function BitcoinOnChainDashboard() {
  const [metrics, setMetrics] = useState<BitcoinOnChainMetric[]>([]);
  const [whaleMovements, setWhaleMovements] = useState<BitcoinWhaleMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsData, whaleData] = await Promise.all([
        fetchBitcoinOnChainMetrics(),
        fetchBitcoinWhaleMovements(10),
      ]);

      setMetrics(metricsData.metrics);
      setWhaleMovements(whaleData);
    } catch (error: any) {
      console.error('Error loading Bitcoin on-chain data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load Bitcoin on-chain data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      toast({
        title: 'Success',
        description: 'Bitcoin on-chain data refreshed',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const formatValue = (value: string | number): string => {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return value;
  };

  return (
    <Card className="rounded-xl border transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10 group overflow-hidden bg-gray-100 dark:!bg-[#0a0a0a] border-gray-200 dark:border-slate-700/50 hover:border-orange-500/30 shadow-lg shadow-orange-500/5 hover:shadow-orange-500/20">
      <CardHeader className="group-hover:bg-orange-500/10 transition-colors duration-300 px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors duration-300">
              <Bitcoin className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Bitcoin On-Chain Intelligence
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Real-time Bitcoin network metrics and whale movements
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric, index) => (
                <Card
                  key={index}
                  className="border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/30"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600 dark:text-slate-400">
                      {metric.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-orange-400">
                        {formatValue(metric.value)}
                      </div>
                      {metric.change24h !== undefined && (
                        <Badge
                          variant={metric.change24h >= 0 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {metric.change24h >= 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {Math.abs(metric.change24h).toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                    {metric.description && (
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                        {metric.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Whale Movements */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-400" />
                Recent Whale Movements
              </h3>
              {whaleMovements.length === 0 ? (
                <Card className="border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/30">
                  <CardContent className="py-8 text-center">
                    <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-slate-500">
                      No whale movements detected in the last 24 hours
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {whaleMovements.map((movement, index) => (
                    <Card
                      key={index}
                      className="border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/30"
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {movement.type === 'inflow' ? (
                              <ArrowDownRight className="h-4 w-4 text-green-400" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-400" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {movement.amount.toFixed(2)} BTC
                              </div>
                              <div className="text-xs text-gray-500 dark:text-slate-500 font-mono">
                                {movement.address.slice(0, 16)}...
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-500">
                            {new Date(movement.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

