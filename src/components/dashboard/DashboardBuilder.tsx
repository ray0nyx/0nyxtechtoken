import React, { useState, useCallback, useMemo } from 'react';
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
  Move,
  Trash2,
  Copy,
  Edit,
  Download
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'heatmap';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: any;
  data?: any;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  timeRange: {
    type: 'preset' | 'custom';
    value: string;
    startDate?: string;
    endDate?: string;
  };
  layout: 'grid' | 'freeform';
  createdAt: string;
  updatedAt: string;
}

export interface DashboardFilter {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'between' | 'in' | 'not_in';
  value: any;
  label: string;
}

interface DashboardBuilderProps {
  onSave: (dashboard: Dashboard) => void;
  onPreview: (dashboard: Dashboard) => void;
  initialDashboard?: Dashboard;
  className?: string;
}

const WIDGET_TYPES = [
  {
    type: 'kpi',
    name: 'KPI Metric',
    icon: TrendingUp,
    description: 'Display key performance indicators',
    defaultSize: { w: 2, h: 1 }
  },
  {
    type: 'chart',
    name: 'Chart',
    icon: BarChart3,
    description: 'Visualize data with charts',
    defaultSize: { w: 4, h: 3 }
  },
  {
    type: 'table',
    name: 'Data Table',
    icon: Grid3X3,
    description: 'Display data in tabular format',
    defaultSize: { w: 6, h: 4 }
  },
  {
    type: 'heatmap',
    name: 'Heatmap',
    icon: Layers,
    description: 'Show data density and patterns',
    defaultSize: { w: 4, h: 3 }
  }
];

const TIME_RANGES = [
  { value: '1d', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom Range' }
];

export function DashboardBuilder({ 
  onSave, 
  onPreview, 
  initialDashboard,
  className 
}: DashboardBuilderProps) {
  const [dashboard, setDashboard] = useState<Dashboard>(
    initialDashboard || {
      id: '',
      name: 'New Dashboard',
      description: '',
      widgets: [],
      filters: [],
      timeRange: { type: 'preset', value: '30d' },
      layout: 'grid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );

  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Add new widget
  const addWidget = useCallback((widgetType: string) => {
    const widgetTemplate = WIDGET_TYPES.find(w => w.type === widgetType);
    if (!widgetTemplate) return;

    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: widgetType as any,
      title: `New ${widgetTemplate.name}`,
      position: { x: 0, y: 0, w: widgetTemplate.defaultSize.w, h: widgetTemplate.defaultSize.h },
      config: {}
    };

    setDashboard(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
      updatedAt: new Date().toISOString()
    }));
  }, []);

  // Update widget
  const updateWidget = useCallback((widgetId: string, updates: Partial<DashboardWidget>) => {
    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      ),
      updatedAt: new Date().toISOString()
    }));
  }, []);

  // Delete widget
  const deleteWidget = useCallback((widgetId: string) => {
    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId),
      updatedAt: new Date().toISOString()
    }));
    setSelectedWidget(null);
  }, []);

  // Duplicate widget
  const duplicateWidget = useCallback((widgetId: string) => {
    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return;

    const newWidget: DashboardWidget = {
      ...widget,
      id: `widget-${Date.now()}`,
      title: `${widget.title} (Copy)`,
      position: { ...widget.position, x: widget.position.x + 1, y: widget.position.y + 1 }
    };

    setDashboard(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
      updatedAt: new Date().toISOString()
    }));
  }, [dashboard.widgets]);

  // Handle drag end
  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;
    
    if (source.droppableId === 'widget-palette') {
      // Adding new widget from palette
      addWidget(result.draggableId);
    } else if (source.droppableId === 'dashboard-grid') {
      // Reordering existing widgets
      const newWidgets = Array.from(dashboard.widgets);
      const [reorderedWidget] = newWidgets.splice(source.index, 1);
      newWidgets.splice(destination.index, 0, reorderedWidget);

      setDashboard(prev => ({
        ...prev,
        widgets: newWidgets,
        updatedAt: new Date().toISOString()
      }));
    }
  }, [dashboard.widgets, addWidget]);

  // Update dashboard metadata
  const updateDashboard = useCallback((updates: Partial<Dashboard>) => {
    setDashboard(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString()
    }));
  }, []);

  return (
    <div className={cn("flex h-screen bg-background", className)}>
      {/* Sidebar */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-4">Dashboard Builder</h2>
          
          {/* Dashboard Info */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Dashboard Name</label>
              <Input
                value={dashboard.name}
                onChange={(e) => updateDashboard({ name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={dashboard.description || ''}
                onChange={(e) => updateDashboard({ description: e.target.value })}
                className="mt-1"
                placeholder="Optional description"
              />
            </div>
          </div>
        </div>

        {/* Widget Palette */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-medium mb-3">Widgets</h3>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="widget-palette">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2"
                >
                  {WIDGET_TYPES.map((widget, index) => {
                    const Icon = widget.icon;
                    return (
                      <Draggable key={widget.type} draggableId={widget.type} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              "p-3 border rounded-lg cursor-grab hover:shadow-md transition-all duration-200",
                              snapshot.isDragging && "shadow-lg rotate-2"
                            )}
                          >
                            <div className="flex items-center space-x-3">
                              <Icon className="h-5 w-5 text-primary" />
                              <div>
                                <div className="font-medium text-sm">{widget.name}</div>
                                <div className="text-xs text-muted-foreground">{widget.description}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Time Range & Filters */}
        <div className="p-4 border-t space-y-4">
          <div>
            <label className="text-sm font-medium">Time Range</label>
            <Select
              value={dashboard.timeRange.value}
              onValueChange={(value) => 
                updateDashboard({ 
                  timeRange: { 
                    type: value === 'custom' ? 'custom' : 'preset', 
                    value 
                  } 
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Layout</label>
            <Select
              value={dashboard.layout}
              onValueChange={(value: 'grid' | 'freeform') => 
                updateDashboard({ layout: value })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid Layout</SelectItem>
                <SelectItem value="freeform">Freeform Layout</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-2">
          <Button 
            onClick={() => onSave(dashboard)} 
            className="w-full"
            disabled={dashboard.widgets.length === 0}
          >
            <Save className="h-4 w-4 mr-2" /> Save Dashboard
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onPreview(dashboard)}
            className="w-full"
            disabled={dashboard.widgets.length === 0}
          >
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-16 border-b flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">{dashboard.name}</h1>
            <Badge variant="outline">
              {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
            >
              {isPreviewMode ? <Edit className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {isPreviewMode ? 'Edit' : 'Preview'}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="flex-1 p-6 overflow-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="dashboard-grid">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "min-h-full",
                    dashboard.layout === 'grid' 
                      ? "grid grid-cols-12 gap-4 auto-rows-min" 
                      : "relative"
                  )}
                >
                  {dashboard.widgets.map((widget, index) => (
                    <Draggable key={widget.id} draggableId={widget.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "group relative",
                            dashboard.layout === 'grid' 
                              ? `col-span-${widget.position.w} row-span-${widget.position.h}`
                              : "absolute",
                            snapshot.isDragging && "z-50 rotate-2"
                          )}
                          style={
                            dashboard.layout === 'freeform' 
                              ? {
                                  left: widget.position.x,
                                  top: widget.position.y,
                                  width: widget.position.w * 200,
                                  height: widget.position.h * 150
                                }
                              : {}
                          }
                        >
                          <Card className={cn(
                            "h-full transition-all duration-200",
                            selectedWidget === widget.id && "ring-2 ring-primary",
                            snapshot.isDragging && "shadow-2xl"
                          )}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">
                                  {widget.title}
                                </CardTitle>
                                {!isPreviewMode && (
                                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => setSelectedWidget(widget.id)}
                                    >
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => duplicateWidget(widget.id)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-destructive"
                                      onClick={() => deleteWidget(widget.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="h-32 bg-muted/30 rounded flex items-center justify-center">
                                <div className="text-center text-muted-foreground">
                                  <div className="text-2xl mb-2">
                                    {widget.type === 'kpi' && <TrendingUp className="h-8 w-8 mx-auto" />}
                                    {widget.type === 'chart' && <BarChart3 className="h-8 w-8 mx-auto" />}
                                    {widget.type === 'table' && <Grid3X3 className="h-8 w-8 mx-auto" />}
                                    {widget.type === 'heatmap' && <Layers className="h-8 w-8 mx-auto" />}
                                  </div>
                                  <div className="text-sm capitalize">{widget.type} Widget</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  {dashboard.widgets.length === 0 && (
                    <div className="col-span-12 flex flex-col items-center justify-center h-96 text-center">
                      <div className="text-6xl mb-4 text-muted-foreground">
                        <Grid3X3 className="h-16 w-16 mx-auto" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No widgets yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Drag widgets from the sidebar to start building your dashboard
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}
