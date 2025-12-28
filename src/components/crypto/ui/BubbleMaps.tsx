import React, { useState, useEffect, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/components/ThemeProvider';
import {
  fetchHolderDistribution,
  fetchTokensForBubbleMap,
  generateHolderDistributionBubbles,
  generatePriceVolumeBubbles,
  generateMarketCapLiquidityBubbles,
  type BubbleMapDataPoint,
} from '@/lib/bubble-map-service';
import { fetchDexPairData } from '@/lib/dex-screener-service';

interface BubbleMapsProps {
  pairSymbol?: string;
  tokenMint?: string;
  theme?: 'dark' | 'light';
}

type BubbleMapType = 'holder-distribution' | 'price-volume' | 'marketcap-liquidity';

export default function BubbleMaps({ pairSymbol, tokenMint, theme = 'dark' }: BubbleMapsProps) {
  const [mapType, setMapType] = useState<BubbleMapType>('price-volume');
  const [loading, setLoading] = useState(false);
  const [bubbleData, setBubbleData] = useState<BubbleMapDataPoint[]>([]);
  const { theme: systemTheme } = useTheme();
  const isDark = theme === 'dark' || (systemTheme === 'dark');

  // Fetch data based on map type
  useEffect(() => {
    const loadBubbleData = async () => {
      setLoading(true);
      try {
        if (mapType === 'holder-distribution') {
          // For holder distribution, we need the token mint address
          if (tokenMint) {
            const holders = await fetchHolderDistribution(tokenMint, 100);
            const bubbles = generateHolderDistributionBubbles(holders);
            setBubbleData(bubbles);
          } else if (pairSymbol) {
            // Try to get token mint from pair data
            const pairData = await fetchDexPairData(pairSymbol);
            if (pairData?.pairAddress) {
              // Extract base token address from pair
              // This is a simplified approach - in production, parse the pair address
              const holders = await fetchHolderDistribution(pairData.pairAddress, 100);
              const bubbles = generateHolderDistributionBubbles(holders);
              setBubbleData(bubbles);
            }
          }
        } else {
          // For price/volume and market cap/liquidity, fetch multiple tokens
          const tokens = await fetchTokensForBubbleMap(50);
          if (mapType === 'price-volume') {
            const bubbles = generatePriceVolumeBubbles(tokens);
            setBubbleData(bubbles);
          } else if (mapType === 'marketcap-liquidity') {
            const bubbles = generateMarketCapLiquidityBubbles(tokens);
            setBubbleData(bubbles);
          }
        }
      } catch (error) {
        console.error('Error loading bubble map data:', error);
        setBubbleData([]);
      } finally {
        setLoading(false);
      }
    };

    loadBubbleData();
  }, [mapType, tokenMint, pairSymbol]);

  const getChartConfig = () => {
    switch (mapType) {
      case 'holder-distribution':
        return {
          xLabel: 'Wallet Balance (Log Scale)',
          yLabel: 'Number of Holders',
          xFormatter: (value: number) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toFixed(0);
          },
          yFormatter: (value: number) => value.toString(),
        };
      case 'price-volume':
        return {
          xLabel: '24h Volume (USD)',
          yLabel: 'Price (USD)',
          xFormatter: (value: number) => {
            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
            return `$${value.toFixed(0)}`;
          },
          yFormatter: (value: number) => {
            if (value >= 1) return `$${value.toFixed(4)}`;
            if (value >= 0.01) return `$${value.toFixed(6)}`;
            return `$${value.toFixed(8)}`;
          },
        };
      case 'marketcap-liquidity':
        return {
          xLabel: 'Liquidity (USD)',
          yLabel: 'Market Cap (USD)',
          xFormatter: (value: number) => {
            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
            return `$${value.toFixed(0)}`;
          },
          yFormatter: (value: number) => {
            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
            return `$${value.toFixed(0)}`;
          },
        };
    }
  };

  const chartConfig = getChartConfig();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const metadata = data.metadata || {};

      return (
        <div className={cn(
          "p-3 rounded-lg border shadow-lg",
          isDark 
            ? "bg-[#1a1f2e] border-[#374151] text-white" 
            : "bg-white border-gray-200 text-gray-900"
        )}>
          {data.label && (
            <div className="font-semibold mb-2">{data.label}</div>
          )}
          {mapType === 'holder-distribution' && (
            <>
              <div className="text-xs">Balance Range: {chartConfig.xFormatter(metadata.range || 0)}</div>
              <div className="text-xs">Holders: {metadata.holderCount || 0}</div>
              <div className="text-xs">Total Value: ${(metadata.totalValue || 0).toLocaleString()}</div>
              <div className="text-xs">
                Risk: {metadata.concentrationRisk ? (metadata.concentrationRisk > 0.5 ? 'Low' : metadata.concentrationRisk > 0.2 ? 'Medium' : 'High') : 'Unknown'}
              </div>
            </>
          )}
          {mapType === 'price-volume' && (
            <>
              <div className="text-xs">Price: {chartConfig.yFormatter(metadata.price || 0)}</div>
              <div className="text-xs">24h Volume: {chartConfig.xFormatter(metadata.volume24h || 0)}</div>
              <div className="text-xs">Market Cap: ${(metadata.marketCap || 0).toLocaleString()}</div>
              <div className={cn(
                "text-xs",
                (metadata.change24h || 0) >= 0 ? "text-green-500" : "text-red-500"
              )}>
                24h Change: {(metadata.change24h || 0) >= 0 ? '+' : ''}{(metadata.change24h || 0).toFixed(2)}%
              </div>
            </>
          )}
          {mapType === 'marketcap-liquidity' && (
            <>
              <div className="text-xs">Market Cap: {chartConfig.yFormatter(metadata.marketCap || 0)}</div>
              <div className="text-xs">Liquidity: {chartConfig.xFormatter(metadata.liquidity || 0)}</div>
              <div className="text-xs">24h Volume: {chartConfig.xFormatter(metadata.volume24h || 0)}</div>
              <div className="text-xs">
                Liquidity Ratio: {((metadata.liquidityRatio || 0) * 100).toFixed(2)}%
              </div>
              <div className={cn(
                "text-xs mt-1",
                (metadata.liquidityRatio || 0) > 0.1 ? "text-green-500" : 
                (metadata.liquidityRatio || 0) > 0.05 ? "text-yellow-500" : "text-red-500"
              )}>
                {(metadata.liquidityRatio || 0) > 0.1 ? 'Healthy' : 
                 (metadata.liquidityRatio || 0) > 0.05 ? 'Moderate' : 'Low Liquidity Risk'}
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  // Calculate bubble sizes
  const maxZ = useMemo(() => {
    if (bubbleData.length === 0) return 1;
    return Math.max(...bubbleData.map(d => d.z || 0));
  }, [bubbleData]);

  if (loading) {
    return (
      <div className={cn(
        "flex items-center justify-center h-[400px]",
        isDark ? "text-[#6b7280]" : "text-gray-500"
      )}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-sm">Loading bubble map data...</div>
        </div>
      </div>
    );
  }

  if (bubbleData.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center h-[400px]",
        isDark ? "text-[#6b7280]" : "text-gray-500"
      )}>
        <div className="text-center">
          <div className="text-sm mb-2">No data available for bubble map</div>
          {mapType === 'holder-distribution' && !tokenMint && (
            <div className="text-xs">Token mint address required for holder distribution</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-4",
      isDark ? "text-white" : "text-gray-900"
    )}>
      {/* Map Type Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bubble Maps</h3>
        <Select value={mapType} onValueChange={(v: BubbleMapType) => setMapType(v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="holder-distribution">Holder Distribution</SelectItem>
            <SelectItem value="price-volume">Price vs Volume</SelectItem>
            <SelectItem value="marketcap-liquidity">Market Cap vs Liquidity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      <div className={cn(
        "rounded-lg border p-4",
        isDark ? "bg-[#1a1f2e] border-[#374151]" : "bg-white border-gray-200"
      )}>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={isDark ? '#374151' : '#e5e7eb'}
              opacity={0.3}
            />
            <XAxis
              type="number"
              dataKey="x"
              name={chartConfig.xLabel}
              tickFormatter={chartConfig.xFormatter}
              stroke={isDark ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '11px' }}
              label={{ 
                value: chartConfig.xLabel, 
                position: 'insideBottom', 
                offset: -10,
                style: { fill: isDark ? '#9ca3af' : '#6b7280' }
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={chartConfig.yLabel}
              tickFormatter={chartConfig.yFormatter}
              stroke={isDark ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '11px' }}
              label={{ 
                value: chartConfig.yLabel, 
                angle: -90, 
                position: 'insideLeft',
                style: { fill: isDark ? '#9ca3af' : '#6b7280' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter
              name="Data Points"
              data={bubbleData}
              fill="#8884d8"
            >
              {bubbleData.map((entry, index) => {
                const size = Math.max(5, Math.sqrt((entry.z || 0) / maxZ) * 30);
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || '#3b82f6'}
                    fillOpacity={0.6}
                    r={size}
                  />
                );
              })}
            </Scatter>
            <Legend
              verticalAlign="top"
              height={36}
              content={({ payload }: any) => {
                if (mapType === 'holder-distribution') {
                  return (
                    <div className="flex justify-center gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs">Low Risk (Distributed)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-xs">Medium Risk</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-xs">High Risk (Concentrated)</span>
                      </div>
                    </div>
                  );
                } else if (mapType === 'price-volume') {
                  return (
                    <div className="flex justify-center gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs">Price Up</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-xs">Price Down</span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex justify-center gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs">Healthy Liquidity</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-xs">Moderate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-xs">Low Liquidity Risk</span>
                      </div>
                    </div>
                  );
                }
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Info Text */}
      <div className={cn(
        "text-xs p-3 rounded-lg",
        isDark ? "bg-[#0f1419] text-[#6b7280]" : "bg-gray-50 text-gray-600"
      )}>
        {mapType === 'holder-distribution' && (
          <p>
            <strong>Holder Distribution:</strong> Shows wallet balance distribution vs number of holders. 
            Red bubbles indicate high concentration risk (few large holders), green indicates distributed ownership.
          </p>
        )}
        {mapType === 'price-volume' && (
          <p>
            <strong>Price vs Volume:</strong> Each bubble represents a token. Size indicates market cap. 
            Green = price up 24h, Red = price down 24h. Click bubbles to view token details.
          </p>
        )}
        {mapType === 'marketcap-liquidity' && (
          <p>
            <strong>Market Cap vs Liquidity:</strong> Shows liquidity health. Green = healthy liquidity ratio (&gt;10%), 
            Yellow = moderate (5-10%), Red = low liquidity risk (&lt;5%). Bubble size = 24h volume.
          </p>
        )}
      </div>
    </div>
  );
}
