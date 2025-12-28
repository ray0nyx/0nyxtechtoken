import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Target,
  BarChart3,
  Activity,
  Zap,
  Shield,
  Clock,
  Calendar,
  Settings,
  Eye
} from 'lucide-react';

export interface KPIConfig {
  metric: string;
  title: string;
  format: 'currency' | 'percentage' | 'number' | 'decimal';
  comparison?: {
    enabled: boolean;
    period: 'previous' | 'ytd' | 'custom';
    customStart?: string;
    customEnd?: string;
  };
  threshold?: {
    enabled: boolean;
    value: number;
    operator: 'greater_than' | 'less_than' | 'equals';
    color: 'green' | 'red' | 'yellow' | 'blue';
  };
  color: 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'gray';
  size: 'small' | 'medium' | 'large';
}

interface KPIWidgetProps {
  config: KPIConfig;
  data?: any;
  onConfigChange?: (config: KPIConfig) => void;
  isEditing?: boolean;
  className?: string;
}

const METRIC_OPTIONS = [
  { value: 'total_pnl', label: 'Total P&L', icon: DollarSign, category: 'Performance' },
  { value: 'daily_pnl', label: 'Daily P&L', icon: DollarSign, category: 'Performance' },
  { value: 'win_rate', label: 'Win Rate', icon: Percent, category: 'Performance' },
  { value: 'profit_factor', label: 'Profit Factor', icon: Target, category: 'Performance' },
  { value: 'total_trades', label: 'Total Trades', icon: BarChart3, category: 'Activity' },
  { value: 'avg_win', label: 'Average Win', icon: TrendingUp, category: 'Performance' },
  { value: 'avg_loss', label: 'Average Loss', icon: TrendingDown, category: 'Performance' },
  { value: 'max_drawdown', label: 'Max Drawdown', icon: Shield, category: 'Risk' },
  { value: 'sharpe_ratio', label: 'Sharpe Ratio', icon: Activity, category: 'Risk' },
  { value: 'trades_per_day', label: 'Trades per Day', icon: Clock, category: 'Activity' },
  { value: 'monthly_return', label: 'Monthly Return', icon: Calendar, category: 'Performance' },
  { value: 'volatility', label: 'Volatility', icon: Zap, category: 'Risk' }
];

const FORMAT_OPTIONS = [
  { value: 'currency', label: 'Currency ($)', symbol: '$' },
  { value: 'percentage', label: 'Percentage (%)', symbol: '%' },
  { value: 'number', label: 'Number', symbol: '' },
  { value: 'decimal', label: 'Decimal', symbol: '' }
];

const COLOR_OPTIONS = [
  { value: 'green', label: 'Green', class: 'text-green-500' },
  { value: 'red', label: 'Red', class: 'text-red-500' },
  { value: 'blue', label: 'Blue', class: 'text-blue-500' },
  { value: 'purple', label: 'Purple', class: 'text-purple-500' },
  { value: 'orange', label: 'Orange', class: 'text-orange-500' },
  { value: 'gray', label: 'Gray', class: 'text-gray-500' }
];

export function KPIWidget({ config, data, onConfigChange, isEditing = false, className }: KPIWidgetProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<KPIConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(value);
      case 'percentage':
        return `${value.toFixed(2)}%`;
      case 'decimal':
        return value.toFixed(2);
      case 'number':
        return Math.round(value).toLocaleString();
      default:
        return value.toString();
    }
  };

  const getValueColor = (value: number, config: KPIConfig) => {
    if (config.threshold?.enabled) {
      const { value: threshold, operator, color } = config.threshold;
      let meetsThreshold = false;
      
      switch (operator) {
        case 'greater_than':
          meetsThreshold = value > threshold;
          break;
        case 'less_than':
          meetsThreshold = value < threshold;
          break;
        case 'equals':
          meetsThreshold = Math.abs(value - threshold) < 0.01;
          break;
      }
      
      if (meetsThreshold) {
        return COLOR_OPTIONS.find(c => c.value === color)?.class || 'text-gray-500';
      }
    }
    
    return COLOR_OPTIONS.find(c => c.value === config.color)?.class || 'text-gray-500';
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getTrendText = (current: number, previous: number) => {
    const diff = current - previous;
    const percentChange = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 0;
    
    if (diff > 0) return `+${formatValue(diff, localConfig.format)} (+${percentChange.toFixed(1)}%)`;
    if (diff < 0) return `${formatValue(diff, localConfig.format)} (${percentChange.toFixed(1)}%)`;
    return 'No change';
  };

  const currentValue = data?.current || 0;
  const previousValue = data?.previous || 0;
  const selectedMetric = METRIC_OPTIONS.find(m => m.value === localConfig.metric);
  const MetricIcon = selectedMetric?.icon || Activity;

  if (isEditing && isConfigOpen) {
    return (
      <Card className={cn("border shadow-sm", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Configure KPI</CardTitle>
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
          {/* Metric Selection */}
          <div className="space-y-2">
            <Label>Metric</Label>
            <Select
              value={localConfig.metric}
              onValueChange={(value) => 
                setLocalConfig(prev => ({ ...prev, metric: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(
                  METRIC_OPTIONS.reduce((acc, option) => {
                    if (!acc[option.category]) acc[option.category] = [];
                    acc[option.category].push(option);
                    return acc;
                  }, {} as Record<string, typeof METRIC_OPTIONS>)
                ).map(([category, options]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      {category}
                    </div>
                    {options.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          <option.icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={localConfig.title}
              onChange={(e) => 
                setLocalConfig(prev => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter KPI title"
            />
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={localConfig.format}
              onValueChange={(value: any) => 
                setLocalConfig(prev => ({ ...prev, format: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  variant={localConfig.color === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => 
                    setLocalConfig(prev => ({ ...prev, color: option.value as any }))
                  }
                  className="justify-start"
                >
                  <div className={cn("w-3 h-3 rounded-full mr-2", option.class.replace('text-', 'bg-'))} />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label>Size</Label>
            <Select
              value={localConfig.size}
              onValueChange={(value: any) => 
                setLocalConfig(prev => ({ ...prev, size: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border shadow-sm transition-all duration-200 hover:shadow-md", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "font-medium flex items-center space-x-2",
            localConfig.size === 'small' ? 'text-sm' : localConfig.size === 'large' ? 'text-lg' : 'text-base'
          )}>
            <MetricIcon className={cn(
              "text-primary",
              localConfig.size === 'small' ? 'h-4 w-4' : localConfig.size === 'large' ? 'h-6 w-6' : 'h-5 w-5'
            )} />
            <span>{localConfig.title}</span>
          </CardTitle>
          {isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsConfigOpen(true)}
            >
              <Settings className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Main Value */}
          <div className={cn(
            "font-bold",
            localConfig.size === 'small' ? 'text-2xl' : localConfig.size === 'large' ? 'text-4xl' : 'text-3xl',
            getValueColor(currentValue, localConfig)
          )}>
            {formatValue(currentValue, localConfig.format)}
          </div>

          {/* Comparison */}
          {localConfig.comparison?.enabled && previousValue !== undefined && (
            <div className="flex items-center space-x-2 text-sm">
              {getTrendIcon(currentValue, previousValue)}
              <span className="text-muted-foreground">
                {getTrendText(currentValue, previousValue)}
              </span>
            </div>
          )}

          {/* Threshold Indicator */}
          {localConfig.threshold?.enabled && (
            <div className={cn(
              "text-xs px-2 py-1 rounded-full inline-flex items-center",
              getValueColor(currentValue, localConfig).replace('text-', 'bg-').replace('-500', '-100'),
              getValueColor(currentValue, localConfig)
            )}>
              {localConfig.threshold.operator === 'greater_than' && 'Above threshold'}
              {localConfig.threshold.operator === 'less_than' && 'Below threshold'}
              {localConfig.threshold.operator === 'equals' && 'At threshold'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
