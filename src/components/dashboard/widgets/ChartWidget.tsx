import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Settings,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  PieChart as RechartsPieChart,
  AreaChart as RechartsAreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Bar,
  Pie,
  Cell,
  Area
} from 'recharts';

export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'pie' | 'scatter';
  title: string;
  dataSource: string;
  xAxis: string;
  yAxis: string;
  groupBy?: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  colors: string[];
  showLegend: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  smooth: boolean;
  stacked: boolean;
  timeFormat?: string;
}

interface ChartWidgetProps {
  config: ChartConfig;
  data?: any[];
  onConfigChange?: (config: ChartConfig) => void;
  isEditing?: boolean;
  className?: string;
}

const CHART_TYPES = [
  { value: 'line', label: 'Line Chart', icon: LineChart, description: 'Show trends over time' },
  { value: 'bar', label: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { value: 'area', label: 'Area Chart', icon: TrendingUp, description: 'Show cumulative values' },
  { value: 'pie', label: 'Pie Chart', icon: PieChart, description: 'Show proportions' },
  { value: 'scatter', label: 'Scatter Plot', icon: TrendingUp, description: 'Show correlations' }
];

const DATA_SOURCES = [
  { value: 'trades', label: 'Trades', description: 'Individual trade data' },
  { value: 'daily_pnl', label: 'Daily P&L', description: 'Daily profit/loss' },
  { value: 'monthly_pnl', label: 'Monthly P&L', description: 'Monthly profit/loss' },
  { value: 'strategy_performance', label: 'Strategy Performance', description: 'Performance by strategy' },
  { value: 'asset_performance', label: 'Asset Performance', description: 'Performance by asset' },
  { value: 'hourly_trades', label: 'Hourly Trades', description: 'Trades by hour of day' },
  { value: 'weekly_trades', label: 'Weekly Trades', description: 'Trades by day of week' }
];

const AGGREGATION_OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' }
];

const COLOR_PALETTES = [
  ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'],
  ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'],
  ['#a8e6cf', '#dcedc1', '#ffd3a5', '#fd9853', '#a8e6cf'],
  ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'],
  ['#ffecd2', '#fcb69f', '#ff8a80', '#ff80ab', '#ea80fc']
];

export function ChartWidget({ config, data, onConfigChange, isEditing = false, className }: ChartWidgetProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<ChartConfig>(config);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Process data based on configuration
  const processedData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Group data if groupBy is specified
    if (localConfig.groupBy) {
      const grouped = data.reduce((acc, item) => {
        const key = item[localConfig.groupBy!];
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      // Aggregate data
      return Object.entries(grouped).map(([key, items]) => {
        const aggregated = items.reduce((acc, item) => {
          const value = parseFloat(item[localConfig.yAxis]) || 0;
          return acc + value;
        }, 0);

        return {
          [localConfig.xAxis]: key,
          [localConfig.yAxis]: localConfig.aggregation === 'avg' ? aggregated / items.length : aggregated,
          count: items.length
        };
      });
    }

    return data.map(item => ({
      [localConfig.xAxis]: item[localConfig.xAxis],
      [localConfig.yAxis]: parseFloat(item[localConfig.yAxis]) || 0
    }));
  }, [data, localConfig]);

  const renderChart = () => {
    if (!processedData.length) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No data available</p>
          </div>
        </div>
      );
    }

    const commonProps = {
      data: processedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (localConfig.type) {
      case 'line':
        return (
          <RechartsLineChart {...commonProps}>
            {localConfig.showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={localConfig.xAxis} />
            <YAxis />
            {localConfig.showTooltip && <Tooltip />}
            <Line
              type={localConfig.smooth ? 'monotone' : 'linear'}
              dataKey={localConfig.yAxis}
              stroke={localConfig.colors[0]}
              strokeWidth={2}
              dot={{ fill: localConfig.colors[0], strokeWidth: 2, r: 4 }}
            />
          </RechartsLineChart>
        );

      case 'bar':
        return (
          <RechartsBarChart {...commonProps}>
            {localConfig.showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={localConfig.xAxis} />
            <YAxis />
            {localConfig.showTooltip && <Tooltip />}
            <Bar dataKey={localConfig.yAxis} fill={localConfig.colors[0]} />
          </RechartsBarChart>
        );

      case 'area':
        return (
          <RechartsAreaChart {...commonProps}>
            {localConfig.showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={localConfig.xAxis} />
            <YAxis />
            {localConfig.showTooltip && <Tooltip />}
            <Area
              type={localConfig.smooth ? 'monotone' : 'linear'}
              dataKey={localConfig.yAxis}
              stroke={localConfig.colors[0]}
              fill={localConfig.colors[0]}
              fillOpacity={0.6}
            />
          </RechartsAreaChart>
        );

      case 'pie':
        return (
          <RechartsPieChart {...commonProps}>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={localConfig.yAxis}
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={localConfig.colors[index % localConfig.colors.length]} />
              ))}
            </Pie>
            {localConfig.showTooltip && <Tooltip />}
            {localConfig.showLegend && <Legend />}
          </RechartsPieChart>
        );

      default:
        return null;
    }
  };

  if (isEditing && isConfigOpen) {
    return (
      <Card className={cn("border shadow-sm", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Configure Chart</CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfigOpen(false)}
              >
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onConfigChange?.(localConfig);
                  setIsConfigOpen(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chart Type */}
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {CHART_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant={localConfig.type === type.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => 
                      setLocalConfig(prev => ({ ...prev, type: type.value as any }))
                    }
                    className="justify-start h-auto p-3"
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Data Source */}
          <div className="space-y-2">
            <Label>Data Source</Label>
            <Select
              value={localConfig.dataSource}
              onValueChange={(value) => 
                setLocalConfig(prev => ({ ...prev, dataSource: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map(source => (
                  <SelectItem key={source.value} value={source.value}>
                    <div>
                      <div className="font-medium">{source.label}</div>
                      <div className="text-xs text-muted-foreground">{source.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* X and Y Axis */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>X-Axis</Label>
              <Input
                value={localConfig.xAxis}
                onChange={(e) => 
                  setLocalConfig(prev => ({ ...prev, xAxis: e.target.value }))
                }
                placeholder="e.g., date, strategy"
              />
            </div>
            <div className="space-y-2">
              <Label>Y-Axis</Label>
              <Input
                value={localConfig.yAxis}
                onChange={(e) => 
                  setLocalConfig(prev => ({ ...prev, yAxis: e.target.value }))
                }
                placeholder="e.g., pnl, count"
              />
            </div>
          </div>

          {/* Group By */}
          <div className="space-y-2">
            <Label>Group By (Optional)</Label>
            <Input
              value={localConfig.groupBy || ''}
              onChange={(e) => 
                setLocalConfig(prev => ({ ...prev, groupBy: e.target.value || undefined }))
              }
              placeholder="e.g., strategy, asset"
            />
          </div>

          {/* Aggregation */}
          <div className="space-y-2">
            <Label>Aggregation</Label>
            <Select
              value={localConfig.aggregation}
              onValueChange={(value: any) => 
                setLocalConfig(prev => ({ ...prev, aggregation: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGGREGATION_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <Label>Color Palette</Label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PALETTES.map((palette, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => 
                    setLocalConfig(prev => ({ ...prev, colors: palette }))
                  }
                  className="h-8 p-1"
                >
                  <div className="flex space-x-1">
                    {palette.map((color, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Show Legend</Label>
              <Switch
                checked={localConfig.showLegend}
                onCheckedChange={(checked) => 
                  setLocalConfig(prev => ({ ...prev, showLegend: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Grid</Label>
              <Switch
                checked={localConfig.showGrid}
                onCheckedChange={(checked) => 
                  setLocalConfig(prev => ({ ...prev, showGrid: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Tooltip</Label>
              <Switch
                checked={localConfig.showTooltip}
                onCheckedChange={(checked) => 
                  setLocalConfig(prev => ({ ...prev, showTooltip: checked }))
                }
              />
            </div>
            {localConfig.type === 'line' && (
              <div className="flex items-center justify-between">
                <Label>Smooth Lines</Label>
                <Switch
                  checked={localConfig.smooth}
                  onCheckedChange={(checked) => 
                    setLocalConfig(prev => ({ ...prev, smooth: checked }))
                  }
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border shadow-sm transition-all duration-200 hover:shadow-md", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            {CHART_TYPES.find(t => t.value === localConfig.type)?.icon && 
              React.createElement(CHART_TYPES.find(t => t.value === localConfig.type)!.icon, {
                className: "h-4 w-4 text-primary"
              })
            }
            <span>{localConfig.title}</span>
          </CardTitle>
          {isEditing && (
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsConfigOpen(true)}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsLoading(true)}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
