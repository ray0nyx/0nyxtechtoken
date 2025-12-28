import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Plus,
  Settings,
  Save,
  Eye,
  Grid3X3,
  BarChart3,
  PieChart,
  TrendingUp,
  Calendar,
  Filter,
  Layers,
  Download,
  Share,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal
} from 'lucide-react';
import { DashboardBuilder } from '@/components/dashboard/DashboardBuilder';
import { KPIWidget } from '@/components/dashboard/widgets/KPIWidget';
import { ChartWidget } from '@/components/dashboard/widgets/ChartWidget';
import { HeatmapWidget } from '@/components/dashboard/widgets/HeatmapWidget';
import { supabase } from '@/lib/supabase';

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: any[];
  filters: any[];
  timeRange: {
    type: 'preset' | 'custom';
    value: string;
    startDate?: string;
    endDate?: string;
  };
  layout: 'grid' | 'freeform';
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  tags?: string[];
}

const PRESET_DASHBOARDS = [
  {
    id: 'performance-overview',
    name: 'Performance Overview',
    description: 'Key performance metrics and trends',
    widgets: [
      {
        id: 'total-pnl',
        type: 'kpi',
        title: 'Total P&L',
        config: {
          metric: 'total_pnl',
          format: 'currency',
          color: 'green'
        }
      },
      {
        id: 'win-rate',
        type: 'kpi',
        title: 'Win Rate',
        config: {
          metric: 'win_rate',
          format: 'percentage',
          color: 'blue'
        }
      },
      {
        id: 'monthly-returns',
        type: 'chart',
        title: 'Monthly Returns',
        config: {
          type: 'line',
          dataSource: 'monthly_pnl',
          xAxis: 'month',
          yAxis: 'pnl'
        }
      }
    ]
  },
  {
    id: 'trading-activity',
    name: 'Trading Activity',
    description: 'Trading patterns and activity analysis',
    widgets: [
      {
        id: 'trades-heatmap',
        type: 'heatmap',
        title: 'Trades by Hour & Day',
        config: {
          type: 'hour_day',
          valueField: 'count',
          aggregation: 'count'
        }
      },
      {
        id: 'daily-trades',
        type: 'chart',
        title: 'Daily Trade Count',
        config: {
          type: 'bar',
          dataSource: 'daily_trades',
          xAxis: 'date',
          yAxis: 'count'
        }
      }
    ]
  },
  {
    id: 'strategy-analysis',
    name: 'Strategy Analysis',
    description: 'Performance breakdown by strategy',
    widgets: [
      {
        id: 'strategy-pnl',
        type: 'chart',
        title: 'P&L by Strategy',
        config: {
          type: 'pie',
          dataSource: 'strategy_performance',
          xAxis: 'strategy',
          yAxis: 'pnl'
        }
      },
      {
        id: 'strategy-heatmap',
        type: 'heatmap',
        title: 'Strategy vs Asset Performance',
        config: {
          type: 'strategy_asset',
          valueField: 'pnl',
          aggregation: 'sum'
        }
      }
    ]
  }
];

export default function CustomDashboard() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('all');

  // Load dashboards
  const loadDashboards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_dashboards')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDashboards(data || []);
    } catch (error) {
      console.error('Error loading dashboards:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save dashboard
  const saveDashboard = useCallback(async (dashboard: Dashboard) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const dashboardData = {
        ...dashboard,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      if (dashboard.id) {
        // Update existing
        const { error } = await supabase
          .from('user_dashboards')
          .update(dashboardData)
          .eq('id', dashboard.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('user_dashboards')
          .insert([{ ...dashboardData, created_at: new Date().toISOString() }]);

        if (error) throw error;
      }

      await loadDashboards();
      setIsBuilderOpen(false);
    } catch (error) {
      console.error('Error saving dashboard:', error);
    }
  }, [loadDashboards]);

  // Delete dashboard
  const deleteDashboard = useCallback(async (dashboardId: string) => {
    try {
      const { error } = await supabase
        .from('user_dashboards')
        .delete()
        .eq('id', dashboardId);

      if (error) throw error;
      await loadDashboards();
    } catch (error) {
      console.error('Error deleting dashboard:', error);
    }
  }, [loadDashboards]);

  // Create from preset
  const createFromPreset = useCallback(async (preset: any) => {
    const newDashboard: Dashboard = {
      id: '',
      name: preset.name,
      description: preset.description,
      widgets: preset.widgets,
      filters: [],
      timeRange: { type: 'preset', value: '30d' },
      layout: 'grid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setSelectedDashboard(newDashboard);
    setIsBuilderOpen(true);
  }, []);

  // Filter dashboards
  const filteredDashboards = dashboards.filter(dashboard => {
    const matchesSearch = dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dashboard.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = filterTag === 'all' || dashboard.tags?.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  if (isBuilderOpen) {
    return (
      <DashboardBuilder
        initialDashboard={selectedDashboard || undefined}
        onSave={saveDashboard}
        onPreview={(dashboard) => {
          setSelectedDashboard(dashboard);
          setIsBuilderOpen(false);
        }}
      />
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-purple-500">
              Custom Dashboards
            </h1>
            <p className="text-muted-foreground">
              Build personalized analytics dashboards with your own KPIs, charts, and insights
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedDashboard(null);
                setIsBuilderOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New Dashboard
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search dashboards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dashboards</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="trading">Trading</SelectItem>
              <SelectItem value="risk">Risk</SelectItem>
              <SelectItem value="strategy">Strategy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Preset Dashboards */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Quick Start Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRESET_DASHBOARDS.map((preset) => (
              <Card key={preset.id} className="border shadow-sm hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{preset.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{preset.description}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {preset.widgets.length} widget{preset.widgets.length !== 1 ? 's' : ''}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => createFromPreset(preset)}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* User Dashboards */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Dashboards</h2>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-8 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDashboards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDashboards.map((dashboard) => (
                <Card key={dashboard.id} className="border shadow-sm hover:shadow-md transition-all duration-200 group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {dashboard.name}
                        </CardTitle>
                        {dashboard.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {dashboard.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {new Date(dashboard.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDashboard(dashboard);
                          setIsBuilderOpen(true);
                        }}
                        className="flex-1"
                      >
                        <Edit className="mr-2 h-3 w-3" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDashboard(dashboard)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteDashboard(dashboard.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 text-muted-foreground">
                <Grid3X3 className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No dashboards yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first custom dashboard to start analyzing your trading data
              </p>
              <Button
                onClick={() => {
                  setSelectedDashboard(null);
                  setIsBuilderOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Create Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
