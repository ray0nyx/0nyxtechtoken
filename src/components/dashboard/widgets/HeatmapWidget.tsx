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
  Layers,
  Settings,
  Eye,
  Calendar,
  Clock,
  TrendingUp,
  BarChart3,
  Activity
} from 'lucide-react';

export interface HeatmapConfig {
  type: 'hour_day' | 'day_week' | 'month_year' | 'strategy_asset' | 'pnl_time';
  title: string;
  dataSource: string;
  xAxis: string;
  yAxis: string;
  valueField: string;
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  colorScheme: 'green_red' | 'blue_red' | 'purple_green' | 'gray' | 'custom';
  customColors?: string[];
  showValues: boolean;
  showTooltip: boolean;
  normalize: boolean;
}

interface HeatmapWidgetProps {
  config: HeatmapConfig;
  data?: any[];
  onConfigChange?: (config: HeatmapConfig) => void;
  isEditing?: boolean;
  className?: string;
}

const HEATMAP_TYPES = [
  { 
    value: 'hour_day', 
    label: 'Trades by Hour & Day', 
    icon: Clock, 
    description: 'Show trading activity by hour of day and day of week',
    xAxis: 'hour',
    yAxis: 'day_of_week'
  },
  { 
    value: 'day_week', 
    label: 'Performance by Day', 
    icon: Calendar, 
    description: 'Show performance by day of week',
    xAxis: 'day_of_week',
    yAxis: 'week'
  },
  { 
    value: 'month_year', 
    label: 'Monthly Performance', 
    icon: TrendingUp, 
    description: 'Show performance by month and year',
    xAxis: 'month',
    yAxis: 'year'
  },
  { 
    value: 'strategy_asset', 
    label: 'Strategy vs Asset', 
    icon: BarChart3, 
    description: 'Show performance by strategy and asset',
    xAxis: 'strategy',
    yAxis: 'asset'
  },
  { 
    value: 'pnl_time', 
    label: 'P&L Heatmap', 
    icon: Activity, 
    description: 'Show P&L distribution over time',
    xAxis: 'date',
    yAxis: 'time'
  }
];

const COLOR_SCHEMES = [
  { value: 'green_red', label: 'Green-Red', colors: ['#d32f2f', '#ffeb3b', '#4caf50'] },
  { value: 'blue_red', label: 'Blue-Red', colors: ['#1976d2', '#ff9800', '#f44336'] },
  { value: 'purple_green', label: 'Purple-Green', colors: ['#7b1fa2', '#ffc107', '#388e3c'] },
  { value: 'gray', label: 'Gray Scale', colors: ['#f5f5f5', '#9e9e9e', '#424242'] },
  { value: 'custom', label: 'Custom', colors: [] }
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function HeatmapWidget({ config, data, onConfigChange, isEditing = false, className }: HeatmapWidgetProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<HeatmapConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Process data for heatmap
  const processedData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return {};

    const heatmapData: Record<string, Record<string, number>> = {};
    
    data.forEach(item => {
      const xValue = item[localConfig.xAxis];
      const yValue = item[localConfig.yAxis];
      const value = parseFloat(item[localConfig.valueField]) || 0;
      
      if (!heatmapData[yValue]) {
        heatmapData[yValue] = {};
      }
      
      if (!heatmapData[yValue][xValue]) {
        heatmapData[yValue][xValue] = 0;
      }
      
      switch (localConfig.aggregation) {
        case 'sum':
          heatmapData[yValue][xValue] += value;
          break;
        case 'avg':
          heatmapData[yValue][xValue] = (heatmapData[yValue][xValue] + value) / 2;
          break;
        case 'count':
          heatmapData[yValue][xValue] += 1;
          break;
        case 'max':
          heatmapData[yValue][xValue] = Math.max(heatmapData[yValue][xValue], value);
          break;
        case 'min':
          heatmapData[yValue][xValue] = Math.min(heatmapData[yValue][xValue], value);
          break;
      }
    });

    return heatmapData;
  }, [data, localConfig]);

  // Get color for value
  const getColor = (value: number, maxValue: number, minValue: number) => {
    if (maxValue === minValue) return localConfig.colorScheme === 'gray' ? '#9e9e9e' : '#ffc107';
    
    const normalized = (value - minValue) / (maxValue - minValue);
    const colors = COLOR_SCHEMES.find(scheme => scheme.value === localConfig.colorScheme)?.colors || ['#f5f5f5', '#9e9e9e', '#424242'];
    
    if (normalized <= 0.5) {
      const t = normalized * 2;
      const color1 = colors[0];
      const color2 = colors[1];
      return interpolateColor(color1, color2, t);
    } else {
      const t = (normalized - 0.5) * 2;
      const color1 = colors[1];
      const color2 = colors[2];
      return interpolateColor(color1, color2, t);
    }
  };

  // Interpolate between two hex colors
  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);
    
    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Get all unique values for axes
  const getAxisValues = (axis: 'x' | 'y') => {
    const field = axis === 'x' ? localConfig.xAxis : localConfig.yAxis;
    const values = new Set<string>();
    
    Object.values(processedData).forEach(row => {
      Object.keys(row).forEach(key => {
        if (axis === 'x') values.add(key);
      });
    });
    
    Object.keys(processedData).forEach(key => {
      if (axis === 'y') values.add(key);
    });
    
    return Array.from(values).sort();
  };

  const xValues = getAxisValues('x');
  const yValues = getAxisValues('y');
  
  // Calculate min/max for color scaling
  const allValues = Object.values(processedData).flatMap(row => Object.values(row));
  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues);

  if (isEditing && isConfigOpen) {
    return (
      <Card className={cn("border shadow-sm", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Configure Heatmap</CardTitle>
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
          {/* Heatmap Type */}
          <div className="space-y-2">
            <Label>Heatmap Type</Label>
            <div className="grid grid-cols-1 gap-2">
              {HEATMAP_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant={localConfig.type === type.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => 
                      setLocalConfig(prev => ({ 
                        ...prev, 
                        type: type.value as any,
                        xAxis: type.xAxis,
                        yAxis: type.yAxis
                      }))
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

          {/* Value Field */}
          <div className="space-y-2">
            <Label>Value Field</Label>
            <Select
              value={localConfig.valueField}
              onValueChange={(value) => 
                setLocalConfig(prev => ({ ...prev, valueField: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pnl">P&L</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="win_rate">Win Rate</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="max">Maximum</SelectItem>
                <SelectItem value="min">Minimum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color Scheme */}
          <div className="space-y-2">
            <Label>Color Scheme</Label>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_SCHEMES.map(scheme => (
                <Button
                  key={scheme.value}
                  variant={localConfig.colorScheme === scheme.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => 
                    setLocalConfig(prev => ({ ...prev, colorScheme: scheme.value as any }))
                  }
                  className="justify-start"
                >
                  <div className="flex space-x-1 mr-2">
                    {scheme.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  {scheme.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Show Values</Label>
              <Switch
                checked={localConfig.showValues}
                onCheckedChange={(checked) => 
                  setLocalConfig(prev => ({ ...prev, showValues: checked }))
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
            <div className="flex items-center justify-between">
              <Label>Normalize Values</Label>
              <Switch
                checked={localConfig.normalize}
                onCheckedChange={(checked) => 
                  setLocalConfig(prev => ({ ...prev, normalize: checked }))
                }
              />
            </div>
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
            <Layers className="h-4 w-4 text-primary" />
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
        <div className="space-y-4">
          {/* Heatmap Grid */}
          <div className="overflow-auto">
            <div className="min-w-max">
              {/* X-axis labels */}
              <div className="flex mb-2">
                <div className="w-20"></div>
                {xValues.map(xValue => (
                  <div key={xValue} className="w-16 text-center text-xs font-medium text-muted-foreground">
                    {xValue}
                  </div>
                ))}
              </div>
              
              {/* Heatmap rows */}
              {yValues.map(yValue => (
                <div key={yValue} className="flex items-center mb-1">
                  <div className="w-20 text-xs font-medium text-muted-foreground pr-2">
                    {yValue}
                  </div>
                  {xValues.map(xValue => {
                    const value = processedData[yValue]?.[xValue] || 0;
                    const color = getColor(value, maxValue, minValue);
                    
                    return (
                      <div
                        key={`${yValue}-${xValue}`}
                        className="w-16 h-8 border border-border rounded-sm flex items-center justify-center text-xs font-medium"
                        style={{ backgroundColor: color }}
                        title={`${yValue} - ${xValue}: ${value}`}
                      >
                        {localConfig.showValues && value !== 0 && (
                          <span className={cn(
                            "text-xs",
                            value > (maxValue + minValue) / 2 ? "text-white" : "text-gray-900"
                          )}>
                            {localConfig.aggregation === 'count' ? value : value.toFixed(1)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Min: {minValue.toFixed(1)}</span>
            <div className="flex items-center space-x-2">
              <span>Value Range</span>
              <div className="w-20 h-2 rounded" style={{
                background: `linear-gradient(to right, ${getColor(minValue, maxValue, minValue)}, ${getColor(maxValue, maxValue, minValue)})`
              }} />
            </div>
            <span>Max: {maxValue.toFixed(1)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
